"""Inventory of the raw mail zone: how many stored messages each allowlist
entry accounts for.

Used to decide which parsers matter most, by measurement rather than guess
(ADR-0017). Counts are keyed by the configured allowlist entry, never by the
actual sender address, so the report contains no personal data.
"""

import logging
import time
from collections import Counter
from datetime import date, timedelta
from email import message_from_bytes
from email.policy import default as default_policy

from pydantic import BaseModel

from tracemail_pipeline.ingest.allowlist import SenderAllowlist
from tracemail_pipeline.ingest.raw_store import RawStore, mail_partition_prefix

logger = logging.getLogger(__name__)

UNMATCHED = "(no longer on allowlist)"
ONE_DAY = timedelta(days=1)


class RawInventoryResult(BaseModel):
    """Counts per allowlist entry, plus the run's operations and timing."""

    messages: int = 0
    by_entry: dict[str, int] = {}
    bytes_read: int = 0
    gcs_lists: int = 0
    gcs_reads: int = 0
    seconds_total: float = 0.0


def raw_inventory(
    store: RawStore, allowlist: SenderAllowlist, start: date, end: date
) -> RawInventoryResult:
    """Count stored messages received in ``[start, end)`` by allowlist entry."""
    started = time.perf_counter()
    result = RawInventoryResult()
    counts: Counter[str] = Counter()
    day = start
    while day < end:
        keys = store.existing_keys(mail_partition_prefix(day))
        result.gcs_lists += 1
        for key in sorted(keys):
            raw = store.read(key)
            result.gcs_reads += 1
            result.bytes_read += len(raw)
            counts[_entry_for(raw, allowlist)] += 1
        day += ONE_DAY
    result.messages = sum(counts.values())
    result.by_entry = dict(counts.most_common())
    result.seconds_total = time.perf_counter() - started
    logger.info("Raw inventory finished: %s", result.model_dump())
    return result


def _entry_for(raw: bytes, allowlist: SenderAllowlist) -> str:
    headers = message_from_bytes(raw, policy=default_policy)
    entry = allowlist.matching_entry(str(headers.get("From", "")))
    return entry if entry is not None else UNMATCHED
