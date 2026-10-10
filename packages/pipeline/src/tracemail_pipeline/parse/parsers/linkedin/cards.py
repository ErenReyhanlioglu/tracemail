"""Shared reader for the job cards every LinkedIn job mail is built from.

In the plain-text part, cards are separated by lines of dashes. Within a
segment, a template's section headers come first, then the card: title,
company, location, optional descriptive lines, and a "view job" line whose URL
carries the job id. Header lines are recognized by the template's patterns;
lines containing a URL are never card content, and contact lines (a name and
headline ending in a "send message" link) are dropped. Descriptive lines that match no
known phrase are kept as ``unrecognized_lines`` instead of being dropped, so a
new LinkedIn badge cannot shift the title/company/location fields.

A long title can wrap over several plain-text lines. The HTML part keeps it in
one job link, so when the first few lines joined together equal one of the
card's link texts, those lines form the title. Without such a match the title
is the first line, as before.
"""

import re
from collections.abc import Mapping, Sequence

from pydantic import BaseModel

from tracemail_pipeline.parse.base import ParseError
from tracemail_pipeline.parse.parsers.linkedin.phrases import (
    ALUMNI,
    CONNECTIONS,
    FLAG_PHRASES,
    SEND_MESSAGE,
)

SEPARATOR = re.compile(r"^-{20,}$")
VIEW_LINE = re.compile(r":\s*https://www\.linkedin\.com/comm/jobs/view/(?P<job_id>\d+)")
CORE_LINES = 3
# Company and location follow the title.
LINES_AFTER_TITLE = CORE_LINES - 1


class Card(BaseModel):
    """One job card and the section headers that preceded it."""

    job_id: str
    title: str
    company: str
    location: str
    flags: list[str] = []
    connections: int | None = None
    alumni: int | None = None
    unrecognized_lines: list[str] = []
    headers: list[str] = []


def read_cards(
    plain_text: str,
    header_patterns: Sequence[re.Pattern[str]],
    link_texts: Mapping[str, Sequence[str]],
) -> list[Card]:
    """Return every card in the message, in order. ``link_texts`` maps a job
    id to the visible texts of its links in the HTML part."""
    cards = []
    for segment in _segments(plain_text):
        card = _card_from_segment(segment, header_patterns, link_texts)
        if card is not None:
            cards.append(card)
    return cards


def _segments(plain_text: str) -> list[list[str]]:
    segments: list[list[str]] = [[]]
    for raw_line in plain_text.splitlines():
        line = " ".join(raw_line.split())
        if SEPARATOR.match(line):
            segments.append([])
        elif line:
            segments[-1].append(line)
    return segments


def _card_from_segment(
    lines: list[str],
    header_patterns: Sequence[re.Pattern[str]],
    link_texts: Mapping[str, Sequence[str]],
) -> Card | None:
    headers: list[str] = []
    content: list[str] = []
    for line in lines:
        view = VIEW_LINE.search(line)
        if view is not None:
            job_id = view["job_id"]
            return _build_card(job_id, content, headers, link_texts.get(job_id, []))
        if any(pattern.match(line) for pattern in header_patterns):
            headers.append(line)
        elif SEND_MESSAGE.match(line):
            # A contact (name, headline) ends here; it is not card content.
            content.clear()
        elif "http" not in line:
            content.append(line)
    return None


def _build_card(
    job_id: str, content: list[str], headers: list[str], link_texts: Sequence[str]
) -> Card:
    if len(content) < CORE_LINES:
        raise ParseError(f"Card for job {job_id} has fewer than {CORE_LINES} lines")
    title_lines = _title_line_count(content, link_texts)
    core_end = title_lines + LINES_AFTER_TITLE
    company, location = content[title_lines:core_end]
    card = Card(
        job_id=job_id,
        title=" ".join(content[:title_lines]),
        company=company,
        location=location,
        headers=headers,
    )
    for line in content[core_end:]:
        _describe(card, line)
    return card


def _title_line_count(content: list[str], link_texts: Sequence[str]) -> int:
    """How many leading lines form the title: the fewest whose joined text is
    one of the card's link texts, else one."""
    for count in range(1, len(content) - LINES_AFTER_TITLE + 1):
        if " ".join(content[:count]) in link_texts:
            return count
    return 1


def _describe(card: Card, line: str) -> None:
    connections = CONNECTIONS.match(line)
    alumni = ALUMNI.match(line)
    if line in FLAG_PHRASES:
        card.flags.append(FLAG_PHRASES[line])
    elif connections is not None:
        card.connections = int(connections["count"])
    elif alumni is not None:
        card.alumni = int(alumni["count"])
    else:
        card.unrecognized_lines.append(line)
