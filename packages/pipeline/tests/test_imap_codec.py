"""Tests for IMAP date, mailbox-name, and response helpers."""

from datetime import UTC, date, datetime

import pytest

from tracemail_pipeline.ingest.imap_codec import (
    ImapResponseError,
    date_window,
    decode_mailbox_name,
    encode_mailbox_name,
    format_imap_date,
    parse_internaldate,
    quote_mailbox,
)


def test_format_imap_date_uses_english_month_without_leading_zero() -> None:
    assert format_imap_date(date(2026, 10, 4)) == "4-Oct-2026"


def test_date_window_for_an_hourly_interval_covers_one_day_of_slack_each_side() -> None:
    start = datetime(2026, 10, 4, 13, tzinfo=UTC)
    end = datetime(2026, 10, 4, 14, tzinfo=UTC)
    assert date_window(start, end) == (date(2026, 10, 3), date(2026, 10, 6))


def test_date_window_treats_a_midnight_end_as_exclusive() -> None:
    start = datetime(2026, 10, 4, tzinfo=UTC)
    end = datetime(2026, 10, 5, tzinfo=UTC)
    assert date_window(start, end) == (date(2026, 10, 3), date(2026, 10, 6))


def test_parse_internaldate_converts_offset_to_utc() -> None:
    line = b'1 (UID 7 INTERNALDATE "04-Oct-2026 09:15:00 +0300" BODY'
    assert parse_internaldate(line) == datetime(2026, 10, 4, 6, 15, tzinfo=UTC)


def test_parse_internaldate_accepts_space_padded_single_digit_day() -> None:
    line = b'1 (UID 7 INTERNALDATE " 4-Oct-2026 23:30:00 -0200" BODY'
    assert parse_internaldate(line) == datetime(2026, 10, 5, 1, 30, tzinfo=UTC)


def test_parse_internaldate_raises_when_missing() -> None:
    with pytest.raises(ImapResponseError):
        parse_internaldate(b"1 (UID 7 BODY")


def test_encode_mailbox_name_uses_modified_utf7_for_turkish_folder() -> None:
    assert encode_mailbox_name("[Gmail]/Tüm Postalar") == "[Gmail]/T&APw-m Postalar"


def test_encode_mailbox_name_escapes_ampersand() -> None:
    assert encode_mailbox_name("A&B") == "A&-B"


@pytest.mark.parametrize(
    "name", ["[Gmail]/Tüm Postalar", "A&B", "INBOX", "Gönderilmiş"]
)
def test_decode_mailbox_name_reverses_encoding(name: str) -> None:
    assert decode_mailbox_name(encode_mailbox_name(name)) == name


def test_quote_mailbox_wraps_and_escapes() -> None:
    assert quote_mailbox('a"b\\c') == '"a\\"b\\\\c"'
