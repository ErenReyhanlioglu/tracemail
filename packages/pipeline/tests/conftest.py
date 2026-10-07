"""Shared fakes for pipeline tests: an in-memory IMAP server and raw store.

All message data here is synthetic (example.com addresses); no real mail is
used in unit tests.
"""

import builtins
from collections.abc import Callable
from typing import Any

import pytest

from tracemail_pipeline.ingest.imap_client import MailboxReader

OK = "OK"


class FakeMessage:
    """One synthetic message as the fake server stores it."""

    def __init__(self, internal_date: str, headers: bytes, raw: bytes) -> None:
        self.internal_date = internal_date
        self.headers = headers
        self.raw = raw


class FakeImap:
    """Records every command; answers SEARCH, FETCH, SELECT, and LIST."""

    def __init__(
        self, messages: dict[str, FakeMessage], mailboxes: list[bytes]
    ) -> None:
        self.messages = messages
        self.mailboxes = mailboxes
        self.calls: list[tuple[Any, ...]] = []
        self.status = OK

    def select(self, mailbox: str = "INBOX", readonly: bool = False) -> tuple[str, Any]:
        self.calls.append(("select", mailbox, readonly))
        return self.status, [str(len(self.messages)).encode()]

    def uid(self, command: str, *args: str) -> tuple[str, Any]:
        self.calls.append(("uid", command, *args))
        if command == "SEARCH":
            return self.status, [" ".join(self.messages).encode()]
        uid_set, items = args
        data: builtins.list[Any] = []
        for message_uid in uid_set.split(","):
            message = self.messages.get(message_uid)
            if message is None:
                continue
            if "HEADER.FIELDS" in items:
                line = (
                    f'1 (UID {message_uid} INTERNALDATE "{message.internal_date}" BODY'
                )
                data.extend([(line.encode(), message.headers), b")"])
            else:
                line = f"1 (UID {message_uid} BODY[]"
                data.extend([(line.encode(), message.raw), b")"])
        return self.status, data

    def list(self, directory: str = '""', pattern: str = "*") -> tuple[str, Any]:
        self.calls.append(("list", directory, pattern))
        return self.status, self.mailboxes

    # The class defines a method named ``list`` (IMAP LIST), which shadows the
    # builtin inside the class body, hence ``builtins.list`` here.
    def fetch_calls(self) -> builtins.list[tuple[Any, ...]]:
        return [call for call in self.calls if call[:2] == ("uid", "FETCH")]


class FakeRawStore:
    """In-memory write-once store."""

    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def exists(self, key: str) -> bool:
        return key in self.objects

    def existing_keys(self, prefix: str) -> set[str]:
        return {key for key in self.objects if key.startswith(prefix)}

    def write_once(self, key: str, data: bytes) -> bool:
        if key in self.objects:
            return False
        self.objects[key] = data
        return True


def make_message(
    sender: str,
    message_id: str | None,
    internal_date: str = "04-Oct-2026 09:15:00 +0300",
) -> FakeMessage:
    """Build a synthetic message with the given sender and Message-ID."""
    header_lines = [f"From: Sender <{sender}>"]
    if message_id is not None:
        header_lines.append(f"Message-ID: {message_id}")
    headers = ("\r\n".join(header_lines) + "\r\n\r\n").encode()
    raw = headers + f"Synthetic body from {sender}\r\n".encode()
    return FakeMessage(internal_date, headers, raw)


@pytest.fixture
def make_fake_imap() -> Callable[..., FakeImap]:
    def factory(
        messages: dict[str, FakeMessage] | None = None,
        mailboxes: list[bytes] | None = None,
    ) -> FakeImap:
        return FakeImap(messages or {}, mailboxes or [])

    return factory


@pytest.fixture
def make_reader() -> Callable[[FakeImap], MailboxReader]:
    return MailboxReader


@pytest.fixture
def fake_store() -> FakeRawStore:
    return FakeRawStore()


@pytest.fixture
def message_factory() -> Callable[..., FakeMessage]:
    return make_message
