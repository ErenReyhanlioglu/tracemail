"""Tests for read-only IMAP access.

The first two tests enforce the rule that the mailbox is never modified:
it is opened read-only and every FETCH uses ``BODY.PEEK`` (CLAUDE.md,
Ingestion and Parsing).
"""

from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import Any

import pytest

from tracemail_pipeline.ingest.imap_client import ImapFetchError


def test_select_read_only_opens_encoded_mailbox_with_readonly_flag(
    make_fake_imap: Callable[..., Any], make_reader: Callable[[Any], Any]
) -> None:
    imap = make_fake_imap()
    make_reader(imap).select_read_only("[Gmail]/Tüm Postalar")
    assert imap.calls == [("select", '"[Gmail]/T&APw-m Postalar"', True)]


def test_every_fetch_uses_peek_so_no_message_is_marked_as_read(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
) -> None:
    imap = make_fake_imap({"7": message_factory("a@example.com", "<id@example.com>")})
    reader = make_reader(imap)
    reader.fetch_headers(["7"])
    reader.fetch_raw("7")
    fetch_items = [call[3] for call in imap.fetch_calls()]
    assert len(fetch_items) == 2
    assert all("BODY.PEEK[" in items for items in fetch_items)
    assert not any("BODY[" in items for items in fetch_items)


def test_search_uids_sends_imap_dates_and_returns_uids(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
) -> None:
    message = message_factory("a@example.com", None)
    imap = make_fake_imap({"3": message, "9": message})
    uids = make_reader(imap).search_uids(date(2026, 10, 3), date(2026, 10, 6))
    assert uids == ["3", "9"]
    assert imap.calls == [
        ("uid", "SEARCH", "SINCE", "3-Oct-2026", "BEFORE", "6-Oct-2026")
    ]


def test_search_uids_returns_empty_list_when_nothing_matches(
    make_fake_imap: Callable[..., Any], make_reader: Callable[[Any], Any]
) -> None:
    uids = make_reader(make_fake_imap()).search_uids(
        date(2026, 10, 3), date(2026, 10, 6)
    )
    assert uids == []


def test_fetch_headers_parses_date_sender_and_message_id(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
) -> None:
    imap = make_fake_imap({"7": message_factory("a@example.com", " <id@example.com> ")})
    [header] = make_reader(imap).fetch_headers(["7"])
    assert header.uid == "7"
    assert header.internal_date == datetime(2026, 10, 4, 6, 15, tzinfo=UTC)
    assert "a@example.com" in header.from_header
    assert header.message_id == "<id@example.com>"


def test_fetch_headers_returns_none_message_id_when_header_is_absent(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
) -> None:
    imap = make_fake_imap({"7": message_factory("a@example.com", None)})
    [header] = make_reader(imap).fetch_headers(["7"])
    assert header.message_id is None


def test_fetch_headers_sends_one_command_per_batch(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
) -> None:
    message = message_factory("a@example.com", None)
    imap = make_fake_imap({str(uid): message for uid in range(1, 6)})
    reader = make_reader(imap)
    headers = reader.fetch_headers(["1", "2", "3", "4", "5"], batch_size=2)
    assert [header.uid for header in headers] == ["1", "2", "3", "4", "5"]
    assert [call[2] for call in imap.fetch_calls()] == ["1,2", "3,4", "5"]
    assert reader.commands_sent == 3


def test_fetch_headers_skips_messages_deleted_after_search(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
) -> None:
    imap = make_fake_imap({"1": message_factory("a@example.com", None)})
    headers = make_reader(imap).fetch_headers(["1", "2"])
    assert [header.uid for header in headers] == ["1"]


def test_fetch_headers_rejects_a_response_without_uid(
    make_fake_imap: Callable[..., Any], make_reader: Callable[[Any], Any]
) -> None:
    imap = make_fake_imap()
    imap.uid = lambda command, *args: ("OK", [(b"1 (BODY", b"From: x\r\n\r\n")])
    with pytest.raises(ImapFetchError):
        make_reader(imap).fetch_headers(["1"])


def test_fetch_raw_returns_original_bytes(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
) -> None:
    message = message_factory("a@example.com", "<id@example.com>")
    imap = make_fake_imap({"7": message})
    assert make_reader(imap).fetch_raw("7") == message.raw


def test_list_mailboxes_decodes_names(
    make_fake_imap: Callable[..., Any], make_reader: Callable[[Any], Any]
) -> None:
    lines = [
        b'(\\HasNoChildren) "/" "INBOX"',
        b'(\\All \\HasNoChildren) "/" "[Gmail]/T&APw-m Postalar"',
    ]
    names = make_reader(make_fake_imap(mailboxes=lines)).list_mailboxes()
    assert names == ["INBOX", "[Gmail]/Tüm Postalar"]


def test_non_ok_status_raises_imap_fetch_error(
    make_fake_imap: Callable[..., Any], make_reader: Callable[[Any], Any]
) -> None:
    imap = make_fake_imap()
    imap.status = "NO"
    with pytest.raises(ImapFetchError):
        make_reader(imap).select_read_only("INBOX")


def test_fetch_without_message_data_raises_imap_fetch_error(
    make_fake_imap: Callable[..., Any], make_reader: Callable[[Any], Any]
) -> None:
    imap = make_fake_imap()
    imap.uid = lambda command, *args: ("OK", [b")"])
    with pytest.raises(ImapFetchError):
        make_reader(imap).fetch_raw("7")
