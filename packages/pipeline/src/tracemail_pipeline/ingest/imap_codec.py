"""Pure helpers for the IMAP protocol: dates, mailbox names, and responses.

IMAP has its own formats that must not depend on the host's locale: dates use
English month abbreviations (RFC 3501 "date"), and mailbox names use modified
UTF-7 (RFC 3501, section 5.1.3), which matters because Gmail localizes folder
names (for example "[Gmail]/Tüm Postalar").
"""

import base64
import re
from datetime import UTC, date, datetime, timedelta

MONTHS = (
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
)
WINDOW_SLACK = timedelta(days=1)
INTERNALDATE_PATTERN = re.compile(
    rb'INTERNALDATE " ?(\d{1,2})-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2}) '
    rb'([+-])(\d{2})(\d{2})"'
)
MODIFIED_BASE64_PATTERN = re.compile(r"&([^-]*)-")
PRINTABLE_ASCII = range(0x20, 0x7F)
UTF16 = "utf-16-be"


class ImapResponseError(Exception):
    """An IMAP server response could not be interpreted."""


def format_imap_date(day: date) -> str:
    """Format a date as IMAP expects in SEARCH, e.g. ``4-Oct-2026``."""
    return f"{day.day}-{MONTHS[day.month - 1]}-{day.year}"


def date_window(interval_start: datetime, interval_end: datetime) -> tuple[date, date]:
    """Return the ``SINCE`` and ``BEFORE`` days covering a data interval.

    IMAP date searches are day-granular and ``BEFORE`` is exclusive. The window
    is widened by one day on each side for timezone slack (ADR-0007); mail
    fetched twice is skipped by the write-once raw store.
    """
    since = interval_start.astimezone(UTC).date() - WINDOW_SLACK
    last_day = (interval_end - timedelta(microseconds=1)).astimezone(UTC).date()
    before = last_day + WINDOW_SLACK + timedelta(days=1)
    return since, before


def parse_internaldate(response_line: bytes) -> datetime:
    """Extract ``INTERNALDATE`` from a FETCH response line as an aware UTC datetime."""
    match = INTERNALDATE_PATTERN.search(response_line)
    if match is None:
        raise ImapResponseError("FETCH response has no INTERNALDATE")
    day, month, year, hour, minute, second, sign, off_h, off_m = (
        part.decode("ascii") for part in match.groups()
    )
    offset = timedelta(hours=int(off_h), minutes=int(off_m))
    if sign == "-":
        offset = -offset
    local = datetime(
        int(year),
        MONTHS.index(month.title()) + 1,
        int(day),
        int(hour),
        int(minute),
        int(second),
        tzinfo=UTC,
    )
    return local - offset


def encode_mailbox_name(name: str) -> str:
    """Encode a mailbox name in modified UTF-7."""
    parts: list[str] = []
    pending: list[str] = []

    def flush() -> None:
        if pending:
            encoded = base64.b64encode("".join(pending).encode(UTF16)).decode("ascii")
            parts.append(f"&{encoded.rstrip('=').replace('/', ',')}-")
            pending.clear()

    for char in name:
        if char == "&":
            flush()
            parts.append("&-")
        elif ord(char) in PRINTABLE_ASCII:
            flush()
            parts.append(char)
        else:
            pending.append(char)
    flush()
    return "".join(parts)


def decode_mailbox_name(encoded: str) -> str:
    """Decode a modified UTF-7 mailbox name."""

    def replace(match: re.Match[str]) -> str:
        chunk = match.group(1)
        if not chunk:
            return "&"
        padded = chunk.replace(",", "/") + "=" * (-len(chunk) % 4)
        return base64.b64decode(padded).decode(UTF16)

    return MODIFIED_BASE64_PATTERN.sub(replace, encoded)


def quote_mailbox(encoded: str) -> str:
    """Quote an encoded mailbox name for use as an IMAP command argument."""
    escaped = encoded.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'
