"""Parser contract and the records parsers produce.

Record schemas are template-independent: a new template adds values (context
types, flags), never columns, so landing tables need no migration when a
template is added (CLAUDE.md, Ingestion and Parsing).

Every message gets exactly one ``MessageParseOutcome``; the parse-quality
metrics on the health panel are computed from those rows.
"""

from datetime import date, datetime
from enum import StrEnum
from typing import Protocol

from pydantic import BaseModel


class ParseError(Exception):
    """A claimed message does not have the structure its template requires."""


class SightingContext(StrEnum):
    """Why a posting appeared in a message."""

    ALERT = "alert"
    APPLIED = "applied"
    SIMILAR_TO_APPLIED = "similar_to_applied"
    SIMILAR_TO_VIEWED = "similar_to_viewed"
    SAVED = "saved"
    SUGGESTED = "suggested"


class ActionType(StrEnum):
    """Something the owner did with a posting, as reported by a message."""

    APPLIED = "applied"
    SAVED = "saved"
    VIEWED = "viewed"


class UpdateType(StrEnum):
    """An employer's reaction to an application; names follow ADR-0024."""

    APPLICATION_VIEWED = "application_viewed"
    REJECTION = "rejection"


class Outcome(StrEnum):
    """What happened when a message was parsed."""

    PARSED = "parsed"
    FAILED = "failed"
    UNCLAIMED = "unclaimed"


class RecordOrigin(BaseModel):
    """Where a record came from and which parser version produced it."""

    source_key: str
    received_date: date
    parser_name: str
    parser_version: str
    template: str


class JobPostingSighting(RecordOrigin):
    """One posting card seen in one message."""

    position: int
    job_id: str
    title: str
    company: str
    location: str
    flags: list[str] = []
    connections: int | None = None
    alumni: int | None = None
    unrecognized_lines: list[str] = []
    context: SightingContext
    context_value: str | None = None
    related_job_id: str | None = None


class JobAction(RecordOrigin):
    """An owner action on a posting (applied, saved, viewed)."""

    job_id: str
    action: ActionType
    action_date: date | None = None
    title: str | None = None
    company: str | None = None
    location: str | None = None


class ApplicationUpdate(RecordOrigin):
    """An employer's reaction to one of the owner's applications."""

    job_id: str
    update_type: UpdateType
    applied_on: date | None = None
    title: str
    company: str
    location: str | None = None


class MessageParseOutcome(BaseModel):
    """Exactly one row per message: the basis of parse-quality metrics."""

    source_key: str
    received_date: date
    outcome: Outcome
    parser_name: str | None = None
    parser_version: str | None = None
    template: str | None = None
    reason: str | None = None
    sightings: int = 0
    actions: int = 0
    updates: int = 0


class ParsedMessage(BaseModel):
    """Everything a parser extracted from one message."""

    template: str
    sightings: list[JobPostingSighting] = []
    actions: list[JobAction] = []
    updates: list[ApplicationUpdate] = []


class SourceMessage(BaseModel):
    """A raw message handed to parsers."""

    source_key: str
    received_date: date
    from_header: str
    sent_at: datetime | None
    plain_text: str | None
    html: str | None = None


class Parser(Protocol):
    """A parser claims messages by sender and extracts records from them."""

    name: str
    version: str

    def claims(self, message: SourceMessage) -> bool: ...

    def parse(self, message: SourceMessage) -> ParsedMessage: ...
