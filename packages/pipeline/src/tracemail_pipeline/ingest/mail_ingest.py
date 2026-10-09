"""Mail ingestion for one data interval: list, filter, and store raw messages.

For the interval's date window: fetch all headers in batches, drop excluded
senders (ADR-0025), list what is already stored once per received date,
and write the rest to the raw zone exactly once. Running the same interval
twice leaves the same end state (CLAUDE.md, Airflow).

The run reports its volume, external operations, and where its time went
(ADR-0017).
"""

import logging
import time
from datetime import date, datetime

from pydantic import BaseModel

from tracemail_pipeline.ingest.imap_client import MailboxReader, MailHeader
from tracemail_pipeline.ingest.imap_codec import date_window
from tracemail_pipeline.ingest.raw_store import (
    RawStore,
    mail_object_key,
    mail_partition_prefix,
    message_digest,
)
from tracemail_pipeline.ingest.sender_exclusions import SenderExclusions
from tracemail_pipeline.load.run_records import RunVolume

logger = logging.getLogger(__name__)

PROGRESS_LOG_EVERY = 25


class MailIngestResult(BaseModel):
    """Volume, operations, and timings for one run; the only thing logged."""

    listed: int = 0
    excluded: int = 0
    already_stored: int = 0
    written: int = 0
    bytes_fetched: int = 0
    bytes_written: int = 0
    imap_commands: int = 0
    gcs_lists: int = 0
    gcs_writes: int = 0
    seconds_total: float = 0.0
    seconds_imap_headers: float = 0.0
    seconds_imap_bodies: float = 0.0
    seconds_gcs: float = 0.0

    def volume(self) -> RunVolume:
        """Common volume fields for the run record (ADR-0020)."""
        return RunVolume(
            records_in=self.listed,
            records_out=self.written,
            bytes_in=self.bytes_fetched,
            bytes_out=self.bytes_written,
        )


def ingest_mail(
    reader: MailboxReader,
    store: RawStore,
    exclusions: SenderExclusions,
    interval_start: datetime,
    interval_end: datetime,
) -> MailIngestResult:
    """Ingest every message in the interval's date window except excluded ones."""
    started = time.perf_counter()
    commands_before = reader.commands_sent
    since, before = date_window(interval_start, interval_end)
    uids = reader.search_uids(since, before)
    result = MailIngestResult(listed=len(uids))
    kept = _kept_headers(reader, exclusions, uids, result)
    existing = _existing_keys(store, kept, result)
    for position, header in enumerate(kept, start=1):
        if _store_message(reader, store, header, existing, result):
            result.written += 1
        else:
            result.already_stored += 1
        if position % PROGRESS_LOG_EVERY == 0:
            logger.info("Mail ingest progress: %d/%d", position, len(kept))
    result.imap_commands = reader.commands_sent - commands_before
    result.seconds_total = time.perf_counter() - started
    logger.info("Mail ingest finished: %s", result.model_dump())
    return result


def _kept_headers(
    reader: MailboxReader,
    exclusions: SenderExclusions,
    uids: list[str],
    result: MailIngestResult,
) -> list[MailHeader]:
    started = time.perf_counter()
    headers = reader.fetch_headers(uids)
    result.seconds_imap_headers += time.perf_counter() - started
    kept = [h for h in headers if not exclusions.excludes(h.from_header, h.subject)]
    result.excluded = len(headers) - len(kept)
    return kept


def _existing_keys(
    store: RawStore, headers: list[MailHeader], result: MailIngestResult
) -> set[str]:
    """List stored keys once per received date covered by the headers."""
    started = time.perf_counter()
    days: set[date] = {header.internal_date.date() for header in headers}
    existing: set[str] = set()
    for day in sorted(days):
        existing |= store.existing_keys(mail_partition_prefix(day))
        result.gcs_lists += 1
    result.seconds_gcs += time.perf_counter() - started
    return existing


def _store_message(
    reader: MailboxReader,
    store: RawStore,
    header: MailHeader,
    existing: set[str],
    result: MailIngestResult,
) -> bool:
    """Store one kept message; return ``False`` if it was already stored."""
    received = header.internal_date.date()
    if header.message_id:
        key = mail_object_key(received, message_digest(header.message_id, None))
        if key in existing:
            return False
        raw = _timed_fetch_raw(reader, header.uid, result)
    else:
        raw = _timed_fetch_raw(reader, header.uid, result)
        key = mail_object_key(received, message_digest(None, raw))
        if key in existing:
            return False
    started = time.perf_counter()
    written = store.write_once(key, raw)
    result.seconds_gcs += time.perf_counter() - started
    result.gcs_writes += 1
    if written:
        result.bytes_written += len(raw)
    logger.debug("Raw mail %s: %s", "written" if written else "exists", key)
    return written


def _timed_fetch_raw(
    reader: MailboxReader, uid: str, result: MailIngestResult
) -> bytes:
    started = time.perf_counter()
    raw = reader.fetch_raw(uid)
    result.seconds_imap_bodies += time.perf_counter() - started
    result.bytes_fetched += len(raw)
    return raw
