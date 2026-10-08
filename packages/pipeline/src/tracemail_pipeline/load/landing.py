"""Load step: parsed zone → BigQuery ``landing`` tables (ADR-0019).

For each received date and record type, one load job replaces that day's
partition with that day's ``parsed/`` file. ``received_date`` is the UTC date
of the source message, the same boundary the parsed files use, so every row of
a file belongs to the partition it is loaded into. An empty file empties the
partition; a missing file fails the run (the day was never parsed). Reloading
any range leaves identical tables; ``landing_fingerprints`` checks exactly that.
"""

import hashlib
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

from google.cloud import bigquery
from pydantic import BaseModel

from tracemail_pipeline.load.bq_schema import schema_for, schema_version
from tracemail_pipeline.load.run_records import RunVolume
from tracemail_pipeline.load.warehouse import LoadStats, Warehouse
from tracemail_pipeline.parse.base import (
    JobAction,
    JobPostingSighting,
    MessageParseOutcome,
)
from tracemail_pipeline.parse.parse_mail import ACTIONS, OUTCOMES, SIGHTINGS
from tracemail_pipeline.parse.parsed_store import parsed_object_key

logger = logging.getLogger(__name__)

LANDING_MODELS: dict[str, type[BaseModel]] = {
    SIGHTINGS: JobPostingSighting,
    ACTIONS: JobAction,
    OUTCOMES: MessageParseOutcome,
}
PARTITION_FIELD = "received_date"
ONE_DAY = timedelta(days=1)
# Each load job spends most of its time queued and starting in BigQuery, so
# independent partitions are loaded concurrently (measured, ADR-0017).
LOAD_CONCURRENCY = 8
FINGERPRINT_SQL = """
SELECT COUNT(*) AS row_count,
       BIT_XOR(FARM_FINGERPRINT(TO_JSON_STRING(t))) AS fingerprint
FROM `{table}` AS t
WHERE received_date >= @start AND received_date < @end
"""


class LoadLandingResult(BaseModel):
    """Volume, operations, and timings for one load run (ADR-0017)."""

    days: int = 0
    partitions_loaded: int = 0
    partitions_emptied: int = 0
    rows_loaded: int = 0
    bytes_loaded: int = 0
    bq_load_jobs: int = 0
    seconds_total: float = 0.0
    seconds_ensure_tables: float = 0.0
    seconds_load: float = 0.0

    def volume(self) -> RunVolume:
        """Common volume fields for the run record."""
        return RunVolume(
            records_in=self.partitions_loaded,
            records_out=self.rows_loaded,
            bytes_out=self.bytes_loaded,
        )


class TableFingerprint(BaseModel):
    """Row count and order-independent content fingerprint of a date range."""

    row_count: int
    fingerprint: int | None


def landing_schema_version() -> str:
    """Fingerprint of all landing schemas together, for run records."""
    combined = ",".join(schema_version(model) for model in LANDING_MODELS.values())
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()[:12]


def load_landing(
    warehouse: Warehouse, dataset: str, bucket: str, start: date, end: date
) -> LoadLandingResult:
    """Replace the ``[start, end)`` partitions of every landing table."""
    started = time.perf_counter()
    result = LoadLandingResult()
    for record_type, model in LANDING_MODELS.items():
        warehouse.ensure_table(dataset, record_type, schema_for(model), PARTITION_FIELD)
    result.seconds_ensure_tables = time.perf_counter() - started
    days = [start + ONE_DAY * offset for offset in range((end - start).days)]
    partitions = [(record_type, day) for day in days for record_type in LANDING_MODELS]
    started_load = time.perf_counter()
    with ThreadPoolExecutor(max_workers=LOAD_CONCURRENCY) as pool:
        outcomes = list(
            pool.map(
                lambda partition: _load_partition(
                    warehouse, dataset, bucket, *partition
                ),
                partitions,
            )
        )
    result.seconds_load = time.perf_counter() - started_load
    result.days = len(days)
    for stats, emptied in outcomes:
        result.bq_load_jobs += 1
        result.partitions_loaded += 1
        result.partitions_emptied += emptied
        result.rows_loaded += stats.rows
        result.bytes_loaded += stats.bytes
    result.seconds_total = time.perf_counter() - started
    logger.info("Landing load finished: %s", result.model_dump())
    return result


def _load_partition(
    warehouse: Warehouse, dataset: str, bucket: str, record_type: str, day: date
) -> tuple[LoadStats, bool]:
    """Load one day of one record type; return its stats and whether the
    partition was emptied."""
    uri = f"gs://{bucket}/{parsed_object_key(record_type, day)}"
    schema = schema_for(LANDING_MODELS[record_type])
    stats = warehouse.load_partition(uri, dataset, record_type, day, schema)
    if stats.rows > 0:
        return stats, False
    # An empty day must leave an empty partition, never earlier rows: delete
    # it explicitly rather than rely on the load job's behavior.
    warehouse.delete_partition(dataset, record_type, day)
    return stats, True


def landing_fingerprints(
    warehouse: Warehouse, dataset: str, start: date, end: date
) -> dict[str, TableFingerprint]:
    """Return each landing table's row count and content fingerprint."""
    parameters = [
        bigquery.ScalarQueryParameter("start", "DATE", start),
        bigquery.ScalarQueryParameter("end", "DATE", end),
    ]
    fingerprints = {}
    for record_type in LANDING_MODELS:
        sql = FINGERPRINT_SQL.format(table=f"{dataset}.{record_type}")
        stats = warehouse.query(sql, parameters)
        fingerprints[record_type] = TableFingerprint.model_validate(stats.rows[0])
        logger.info(
            "Fingerprint %s: bytes_processed=%d bytes_billed=%d",
            record_type,
            stats.bytes_processed,
            stats.bytes_billed,
        )
    return fingerprints
