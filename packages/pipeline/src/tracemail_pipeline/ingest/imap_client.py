"""Read-only IMAP access to the application mailbox (ADR-0007).

The mailbox is opened with ``EXAMINE`` (``select(..., readonly=True)``) and
messages are fetched with ``BODY.PEEK``, so nothing in the mailbox changes:
no message is marked as read, and no flag, folder, or message is modified.
Headers are fetched first so that mail from excluded senders is
never downloaded in full.
"""

import imaplib
import re
import ssl
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from datetime import date, datetime
from email import message_from_bytes
from email.policy import default as default_policy
from typing import Any, Protocol

from pydantic import BaseModel

from tracemail_pipeline.config import PipelineSettings
from tracemail_pipeline.ingest.imap_codec import (
    decode_mailbox_name,
    encode_mailbox_name,
    format_imap_date,
    parse_internaldate,
    quote_mailbox,
)

OK = "OK"
IMAP_TIMEOUT_SECONDS = 60
HEADER_FETCH_ITEMS = "(INTERNALDATE BODY.PEEK[HEADER.FIELDS (FROM SUBJECT MESSAGE-ID)])"
BODY_FETCH_ITEMS = "(BODY.PEEK[])"
# Headers are fetched for many UIDs per command; the batch bounds command length.
HEADER_FETCH_BATCH_SIZE = 100
UID_PATTERN = re.compile(rb"UID (\d+)")


class ImapFetchError(Exception):
    """The IMAP server refused a command or returned an unusable response."""


class ImapConnection(Protocol):
    """The subset of ``imaplib.IMAP4`` used here; lets tests supply a fake."""

    def select(self, mailbox: str = ..., readonly: bool = ...) -> tuple[str, Any]: ...

    def uid(self, command: str, *args: str) -> tuple[str, Any]: ...

    def list(self, directory: str = ..., pattern: str = ...) -> tuple[str, Any]: ...


class MailHeader(BaseModel):
    """Headers needed to decide whether and where to store a message."""

    uid: str
    internal_date: datetime
    from_header: str
    subject: str = ""
    message_id: str | None


class MailboxReader:
    """Read-only operations on one selected mailbox."""

    def __init__(self, connection: ImapConnection) -> None:
        self._connection = connection
        self.commands_sent = 0

    def select_read_only(self, mailbox: str) -> None:
        """Open a mailbox with ``EXAMINE`` semantics."""
        quoted = quote_mailbox(encode_mailbox_name(mailbox))
        self.commands_sent += 1
        status, _ = self._connection.select(quoted, readonly=True)
        _require_ok(status, "EXAMINE")

    def search_uids(self, since: date, before: date) -> list[str]:
        """Return UIDs of messages whose internal date is in ``[since, before)``."""
        status, data = self._uid(
            "SEARCH",
            "SINCE",
            format_imap_date(since),
            "BEFORE",
            format_imap_date(before),
        )
        _require_ok(status, "SEARCH")
        return [uid.decode("ascii") for uid in data[0].split()] if data[0] else []

    def fetch_headers(
        self, uids: Sequence[str], batch_size: int = HEADER_FETCH_BATCH_SIZE
    ) -> list[MailHeader]:
        """Fetch internal date, ``From``, ``Subject``, and ``Message-ID`` for many
        messages.

        One command per batch instead of one per message. Messages deleted
        between SEARCH and FETCH are simply absent from the result.
        """
        headers: list[MailHeader] = []
        for start in range(0, len(uids), batch_size):
            batch = ",".join(uids[start : start + batch_size])
            status, data = self._uid("FETCH", batch, HEADER_FETCH_ITEMS)
            _require_ok(status, "FETCH headers")
            headers.extend(_parse_header_item(item) for item in _literals(data))
        return headers

    def fetch_raw(self, uid: str) -> bytes:
        """Fetch the full original message bytes."""
        status, data = self._uid("FETCH", uid, BODY_FETCH_ITEMS)
        _require_ok(status, "FETCH body")
        return _first_literal(data)[1]

    def list_mailboxes(self) -> list[str]:
        """Return all mailbox names, decoded for display."""
        self.commands_sent += 1
        status, data = self._connection.list()
        _require_ok(status, "LIST")
        return [_mailbox_name_from_list_line(line) for line in data if line]

    def _uid(self, command: str, *args: str) -> tuple[str, Any]:
        """Send one UID command, counting it for the step's metrics (ADR-0017)."""
        self.commands_sent += 1
        return self._connection.uid(command, *args)


@contextmanager
def open_mailbox(settings: PipelineSettings) -> Iterator[MailboxReader]:
    """Connect over TLS, log in, and yield a reader; always logs out."""
    connection = imaplib.IMAP4_SSL(
        settings.imap_host,
        settings.imap_port,
        ssl_context=ssl.create_default_context(),
        timeout=IMAP_TIMEOUT_SECONDS,
    )
    try:
        connection.login(settings.imap_user, settings.imap_password.get_secret_value())
        yield MailboxReader(connection)
    finally:
        connection.logout()


def _require_ok(status: str, command: str) -> None:
    if status != OK:
        raise ImapFetchError(f"IMAP {command} failed with status {status}")


def _literals(data: list[Any]) -> list[tuple[bytes, bytes]]:
    return [
        (item[0], item[1])
        for item in data
        if isinstance(item, tuple) and len(item) == 2
    ]


def _first_literal(data: list[Any]) -> tuple[bytes, bytes]:
    literals = _literals(data)
    if not literals:
        raise ImapFetchError("FETCH response contained no message data")
    return literals[0]


def _parse_header_item(item: tuple[bytes, bytes]) -> MailHeader:
    response_line, header_bytes = item
    uid_match = UID_PATTERN.search(response_line)
    if uid_match is None:
        raise ImapFetchError("FETCH response line has no UID")
    headers = message_from_bytes(header_bytes, policy=default_policy)
    message_id = headers.get("Message-ID")
    return MailHeader(
        uid=uid_match.group(1).decode("ascii"),
        internal_date=parse_internaldate(response_line),
        from_header=str(headers.get("From", "")),
        subject=str(headers.get("Subject", "")),
        message_id=str(message_id).strip() if message_id else None,
    )


def _mailbox_name_from_list_line(line: bytes) -> str:
    # A LIST line looks like: (\HasNoChildren) "/" "[Gmail]/All Mail"
    name = line.decode("ascii").rsplit(' "/" ', maxsplit=1)[-1].strip('"')
    return decode_mailbox_name(name)
