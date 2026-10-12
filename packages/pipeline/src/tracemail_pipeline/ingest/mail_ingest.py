"""Mail ingestion for one data interval: filter and store raw messages.

For the interval's date window: fetch all headers in batches, drop excluded
senders and account-security mail (ADR-0025, ADR-0028) before any body is
downloaded, then attempt a create-only write of every kept message. A message
already stored is rejected by the precondition and left untouched, which
costs nothing; there is no listing of what is stored (ADR-0036). Running the
same interval twice leaves the same end state (CLAUDE.md, Airflow).

Above the GCS client's single-request upload size, an upload becomes a
resumable one, whose billing on a rejected write is not documented; such a
message is checked for existence first (a Class B read) instead.

The run reports its volume, external operations, and where its time went
(ADR-0017).
"""

import logging
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime

from pydantic import BaseModel

from tracemail_pipeline.ingest.imap_client import MailboxReader, MailHeader
from tracemail_pipeline.ingest.imap_codec import date_window
from tracemail_pipeline.ingest.raw_store import (
    RawStore,
    mail_object_key,
    message_digest,
)
from tracemail_pipeline.ingest.sender_exclusions import SenderExclusions
from tracemail_pipeline.load.run_records import RunVolume

logger = logging.getLogger(__name__)

# Bodies are fetched in one IMAP command per batch; the batch bounds how much
# mail is held in memory at once (Gmail accepts messages up to 25 MB).
BODY_FETCH_BATCH_SIZE = 20
# Concurrent create-only uploads within a batch, as parsing reads (READ_CONCURRENCY).
WRITE_CONCURRENCY = 8
# google-cloud-storage uploads larger objects as resumable uploads
# (`google.cloud.storage.blob._MAX_MULTIPART_SIZE`, 8 MiB in 3.16).
SINGLE_REQUEST_UPLOAD_MAX_BYTES = 8 * 1024 * 1024


class MailIngestResult(BaseModel):
    """Volume, operations, and timings for one run; the only thing logged."""

    listed: int = 0
    excluded: int = 0
    already_stored: int = 0
    written: int = 0
    # Received dates that got new raw objects: the days later steps must
    # process (ADR-0021).
    written_days: list[date] = []
    bytes_fetched: int = 0
    bytes_written: int = 0
    imap_commands: int = 0
    # Objects created (Class A).
    gcs_writes: int = 0
    # Writes rejected because the object exists (HTTP 412, not billed).
    gcs_writes_rejected: int = 0
    # Existence checks before large uploads (Class B).
    gcs_existence_checks: int = 0
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
    for start in range(0, len(kept), BODY_FETCH_BATCH_SIZE):
        batch = kept[start : start + BODY_FETCH_BATCH_SIZE]
        bodies = _timed_fetch_bodies(reader, batch, result)
        _store_batch(store, batch, bodies, result)
        logger.info("Mail ingest progress: %d/%d", start + len(batch), len(kept))
    result.imap_commands = reader.commands_sent - commands_before
    result.seconds_total = time.perf_counter() - started
    logger.info("Mail ingest finished: %s", result.model_dump())
    return result


class StoreOutcome(BaseModel):
    """What happened to one message; built in a worker, summed afterwards."""

    day: date
    written: bool
    bytes_written: int = 0
    rejected: bool = False
    existence_checked: bool = False


def _store_batch(
    store: RawStore,
    batch: list[MailHeader],
    bodies: dict[str, bytes],
    result: MailIngestResult,
) -> None:
    """Store a batch with concurrent create-only writes; count in this thread."""
    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=WRITE_CONCURRENCY) as pool:
        outcomes = list(
            pool.map(lambda header: _store_message(store, header, bodies), batch)
        )
    result.seconds_gcs += time.perf_counter() - started
    for outcome in outcomes:
        _count(result, outcome)


def _count(result: MailIngestResult, outcome: StoreOutcome) -> None:
    result.gcs_writes += outcome.written
    result.gcs_writes_rejected += outcome.rejected
    result.gcs_existence_checks += outcome.existence_checked
    result.bytes_written += outcome.bytes_written
    if not outcome.written:
        result.already_stored += 1
        return
    result.written += 1
    if outcome.day not in result.written_days:
        result.written_days = sorted([*result.written_days, outcome.day])


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


def _store_message(
    store: RawStore, header: MailHeader, bodies: dict[str, bytes]
) -> StoreOutcome:
    """Create one message's object unless it exists; never replace one."""
    raw = bodies[header.uid]
    day = header.internal_date.date()
    key = mail_object_key(day, message_digest(header.message_id, raw))
    large = len(raw) > SINGLE_REQUEST_UPLOAD_MAX_BYTES
    if large and store.exists(key):
        outcome = StoreOutcome(day=day, written=False, existence_checked=True)
    elif store.write_once(key, raw):
        outcome = StoreOutcome(
            day=day, written=True, bytes_written=len(raw), existence_checked=large
        )
    else:
        outcome = StoreOutcome(
            day=day, written=False, rejected=True, existence_checked=large
        )
    logger.debug("Raw mail %s: %s", "written" if outcome.written else "exists", key)
    return outcome


def _timed_fetch_bodies(
    reader: MailboxReader, batch: list[MailHeader], result: MailIngestResult
) -> dict[str, bytes]:
    started = time.perf_counter()
    bodies = reader.fetch_raw_many([header.uid for header in batch])
    result.seconds_imap_bodies += time.perf_counter() - started
    result.bytes_fetched += sum(len(raw) for raw in bodies.values())
    return bodies
