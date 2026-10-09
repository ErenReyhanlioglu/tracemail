"""Inventory of the raw mail zone: how many stored messages each sender domain
accounts for.

Used to decide which parsers matter most and which senders to exclude, by
measurement rather than guess (ADR-0017, ADR-0025). Counts are keyed by the
sender's domain, never by the full address, so the report names no person.
Stored mail that has since been excluded (by sender or subject) is counted
under one shared label.
"""

import logging
import time
from collections import Counter
from datetime import date, timedelta
from email import message_from_bytes
from email.policy import default as default_policy
from email.utils import parseaddr

from pydantic import BaseModel

from tracemail_pipeline.ingest.raw_store import RawStore, mail_partition_prefix
from tracemail_pipeline.ingest.sender_exclusions import SenderExclusions

logger = logging.getLogger(__name__)

NOW_EXCLUDED = "(now excluded)"
NO_ADDRESS = "(no sender address)"
ONE_DAY = timedelta(days=1)


class RawInventoryResult(BaseModel):
    """Counts per sender domain, plus the run's operations and timing."""

    messages: int = 0
    by_domain: dict[str, int] = {}
    bytes_read: int = 0
    gcs_lists: int = 0
    gcs_reads: int = 0
    seconds_total: float = 0.0


def raw_inventory(
    store: RawStore, exclusions: SenderExclusions, start: date, end: date
) -> RawInventoryResult:
    """Count stored messages received in ``[start, end)`` by sender domain."""
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
            counts[_label_for(raw, exclusions)] += 1
        day += ONE_DAY
    result.messages = sum(counts.values())
    result.by_domain = dict(counts.most_common())
    result.seconds_total = time.perf_counter() - started
    logger.info("Raw inventory finished: %s", result.model_dump())
    return result


def _label_for(raw: bytes, exclusions: SenderExclusions) -> str:
    headers = message_from_bytes(raw, policy=default_policy)
    from_header = str(headers.get("From", ""))
    if exclusions.excludes(from_header, str(headers.get("Subject", ""))):
        return NOW_EXCLUDED
    address = parseaddr(from_header)[1].strip().lower()
    if "@" not in address:
        return NO_ADDRESS
    return address.rsplit("@", maxsplit=1)[1]
