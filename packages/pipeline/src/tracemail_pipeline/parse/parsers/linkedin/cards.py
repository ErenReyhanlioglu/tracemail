"""Shared reader for the job cards every LinkedIn job mail is built from.

In the plain-text part, cards are separated by lines of dashes. Within a
segment, a template's section headers come first, then the card: title,
company, location, optional descriptive lines, and a "view job" line whose URL
carries the job id. Header lines are recognized by the template's patterns;
lines containing a URL are never card content. Descriptive lines that match no
known phrase are kept as ``unrecognized_lines`` instead of being dropped, so a
new LinkedIn badge cannot shift the title/company/location fields.
"""

import re
from collections.abc import Sequence

from pydantic import BaseModel

from tracemail_pipeline.parse.base import ParseError
from tracemail_pipeline.parse.parsers.linkedin.phrases import (
    ALUMNI,
    CONNECTIONS,
    FLAG_PHRASES,
)

SEPARATOR = re.compile(r"^-{20,}$")
VIEW_LINE = re.compile(r":\s*https://www\.linkedin\.com/comm/jobs/view/(?P<job_id>\d+)")
CORE_LINES = 3


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
    plain_text: str, header_patterns: Sequence[re.Pattern[str]]
) -> list[Card]:
    """Return every card in the message, in order."""
    cards = []
    for segment in _segments(plain_text):
        card = _card_from_segment(segment, header_patterns)
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
    lines: list[str], header_patterns: Sequence[re.Pattern[str]]
) -> Card | None:
    headers: list[str] = []
    content: list[str] = []
    for line in lines:
        view = VIEW_LINE.search(line)
        if view is not None:
            return _build_card(view["job_id"], content, headers)
        if any(pattern.match(line) for pattern in header_patterns):
            headers.append(line)
        elif "http" not in line:
            content.append(line)
    return None


def _build_card(job_id: str, content: list[str], headers: list[str]) -> Card:
    if len(content) < CORE_LINES:
        raise ParseError(f"Card for job {job_id} has fewer than {CORE_LINES} lines")
    title, company, location = content[:CORE_LINES]
    card = Card(
        job_id=job_id, title=title, company=company, location=location, headers=headers
    )
    for line in content[CORE_LINES:]:
        _describe(card, line)
    return card


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
