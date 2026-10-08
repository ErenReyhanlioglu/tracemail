"""Parse step: raw mail of each received date → parsed zone partitions.

Each day is parsed whole and its partitions are overwritten (ADR-0018), so a
rerun, a backfill, or a replay after a parser change all work the same way.
Reports volume, outcomes, operations, and timings (ADR-0017).
"""

import logging
import time
from collections.abc import Sequence
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from email import message_from_bytes
from email.message import EmailMessage
from email.policy import default as default_policy
from email.utils import parsedate_to_datetime

from pydantic import BaseModel

from tracemail_pipeline.ingest.raw_store import RawStore, mail_partition_prefix
from tracemail_pipeline.load.run_records import RunVolume
from tracemail_pipeline.parse.base import (
    JobAction,
    JobPostingSighting,
    MessageParseOutcome,
    Outcome,
    Parser,
    SourceMessage,
)
from tracemail_pipeline.parse.parsed_store import ParsedStore
from tracemail_pipeline.parse.registry import PARSERS, parse_message

logger = logging.getLogger(__name__)

ONE_DAY = timedelta(days=1)
# Raw reads are network-bound (the bucket is on another continent, ADR-0011);
# reading a day's objects concurrently hides the per-request latency.
READ_CONCURRENCY = 8
SIGHTINGS = "job_posting_sightings"
ACTIONS = "job_actions"
OUTCOMES = "message_parse_outcomes"


class ParseMailResult(BaseModel):
    """Volume, outcomes, operations, and timings for one parse run."""

    days: int = 0
    messages: int = 0
    parsed: int = 0
    failed: int = 0
    unclaimed: int = 0
    sightings: int = 0
    actions: int = 0
    bytes_read: int = 0
    bytes_written: int = 0
    gcs_lists: int = 0
    gcs_reads: int = 0
    gcs_writes: int = 0
    seconds_total: float = 0.0
    seconds_gcs_read: float = 0.0
    seconds_parse: float = 0.0
    seconds_gcs_write: float = 0.0

    def volume(self) -> RunVolume:
        """Common volume fields for the run record (ADR-0020)."""
        return RunVolume(
            records_in=self.messages,
            records_out=self.sightings + self.actions,
            records_failed=self.failed,
            bytes_in=self.bytes_read,
            bytes_out=self.bytes_written,
        )


class _DayRecords(BaseModel):
    sightings: list[JobPostingSighting] = []
    actions: list[JobAction] = []
    outcomes: list[MessageParseOutcome] = []


def parse_mail(
    raw_store: RawStore,
    parsed_store: ParsedStore,
    start: date,
    end: date,
    parsers: Sequence[Parser] = PARSERS,
) -> ParseMailResult:
    """Parse every raw message received in ``[start, end)``, one day at a time."""
    started = time.perf_counter()
    result = ParseMailResult()
    day = start
    while day < end:
        records = _parse_day(raw_store, day, parsers, result)
        _write_day(parsed_store, day, records, result)
        result.days += 1
        day += ONE_DAY
    result.seconds_total = time.perf_counter() - started
    logger.info("Parse finished: %s", result.model_dump())
    return result


def _parse_day(
    raw_store: RawStore, day: date, parsers: Sequence[Parser], result: ParseMailResult
) -> _DayRecords:
    records = _DayRecords()
    started = time.perf_counter()
    keys = sorted(raw_store.existing_keys(mail_partition_prefix(day)))
    with ThreadPoolExecutor(max_workers=READ_CONCURRENCY) as pool:
        raws = list(pool.map(raw_store.read, keys))
    result.seconds_gcs_read += time.perf_counter() - started
    result.gcs_lists += 1
    result.gcs_reads += len(raws)
    result.bytes_read += sum(len(raw) for raw in raws)
    for key, raw in zip(keys, raws, strict=True):
        started = time.perf_counter()
        outcome, parsed = parse_message(source_message(key, day, raw), parsers)
        result.seconds_parse += time.perf_counter() - started
        records.outcomes.append(outcome)
        if parsed is not None:
            records.sightings.extend(parsed.sightings)
            records.actions.extend(parsed.actions)
        _count(outcome, result)
    return records


def _count(outcome: MessageParseOutcome, result: ParseMailResult) -> None:
    result.messages += 1
    result.parsed += outcome.outcome == Outcome.PARSED
    result.failed += outcome.outcome == Outcome.FAILED
    result.unclaimed += outcome.outcome == Outcome.UNCLAIMED
    result.sightings += outcome.sightings
    result.actions += outcome.actions
    if outcome.outcome == Outcome.FAILED:
        logger.warning("Parse failed for %s: %s", outcome.source_key, outcome.reason)


def _write_day(
    parsed_store: ParsedStore, day: date, records: _DayRecords, result: ParseMailResult
) -> None:
    started = time.perf_counter()
    for record_type, rows in (
        (SIGHTINGS, records.sightings),
        (ACTIONS, records.actions),
        (OUTCOMES, records.outcomes),
    ):
        result.bytes_written += parsed_store.write_partition(record_type, day, rows)
        result.gcs_writes += 1
    result.seconds_gcs_write += time.perf_counter() - started


def source_message(key: str, received_date: date, raw: bytes) -> SourceMessage:
    """Build the parser input from a raw object's bytes."""
    message = message_from_bytes(raw, policy=default_policy)
    if not isinstance(message, EmailMessage):
        raise TypeError("Expected an EmailMessage with the default policy")
    body = message.get_body(preferencelist=("plain",))
    return SourceMessage(
        source_key=key,
        received_date=received_date,
        from_header=str(message.get("From", "")),
        sent_at=_sent_at(message.get("Date")),
        plain_text=body.get_content() if body is not None else None,
    )


def _sent_at(date_header: object) -> datetime | None:
    if date_header is None:
        return None
    return parsedate_to_datetime(str(date_header))
