"""Entry points the Airflow DAG runs in pipeline_venv, and the steps behind them.

The DAG entry points (``ingest_for_interval``, ``parse_days``,
``load_days``) take plain strings only, never Airflow context (ADR-0003), and
return only what the next task needs: the days to process, as ISO dates in
XCom. The command line runs the same steps for explicit date ranges.

Dirty-day propagation (ADR-0021): ingestion reports the days that received
new raw objects, and only those are parsed and loaded. Once a day, and on
every manual or backfill run, the whole ingestion window is processed
instead, so a run that died after ingesting is repaired within a day.
Every step leaves a run record in ``ops`` (ADR-0020).
"""

import logging
from collections.abc import Sequence
from datetime import UTC, date, datetime

import google.cloud.storage as storage
from google.cloud import bigquery

from tracemail_pipeline.config import PipelineSettings
from tracemail_pipeline.dates import ONE_DAY, day_start_utc, days_between
from tracemail_pipeline.ingest.imap_client import open_mailbox
from tracemail_pipeline.ingest.imap_codec import date_window
from tracemail_pipeline.ingest.mail_ingest import MailIngestResult, ingest_mail
from tracemail_pipeline.ingest.raw_store import RAW_MAIL_PREFIX, GcsRawStore
from tracemail_pipeline.ingest.sender_exclusions import load_sender_exclusions
from tracemail_pipeline.load.landing import (
    LANDING_MODELS,
    landing_schema_version,
    load_landing,
)
from tracemail_pipeline.load.run_records import (
    RunContext,
    WarehouseRunRecordWriter,
    lineage_names,
    run_recorded,
)
from tracemail_pipeline.load.warehouse import BigQueryWarehouse
from tracemail_pipeline.parse.parse_mail import parse_mail
from tracemail_pipeline.parse.parsed_store import PARSED_PREFIX, GcsParsedStore

logger = logging.getLogger(__name__)

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"
# Airflow's run type for runs created by the schedule; manual runs and
# backfills always process the full window.
SCHEDULED_RUN_TYPE = "scheduled"
# The scheduled run whose interval starts at this UTC hour processes the full
# window (the daily safety net of ADR-0021).
FULL_WINDOW_HOUR_UTC = 0


def bucket(settings: PipelineSettings) -> storage.Bucket:
    """The data bucket holding the raw and parsed zones."""
    return storage.Client(project=settings.gcp_project).bucket(settings.data_bucket)


def warehouse(settings: PipelineSettings) -> BigQueryWarehouse:
    """A BigQuery warehouse with the per-query cost guardrail."""
    client = bigquery.Client(project=settings.gcp_project)
    return BigQueryWarehouse(client, settings.bq_location, settings.bq_max_bytes_billed)


def run_writer(settings: PipelineSettings) -> WarehouseRunRecordWriter:
    """The run-record writer for ``ops.pipeline_runs``."""
    return WarehouseRunRecordWriter(
        warehouse(settings), settings.bq_ops_dataset, settings.ops_retention_days
    )


def parsed_names(settings: PipelineSettings) -> list[str]:
    """Lineage names of the parsed zone's record types."""
    return lineage_names(
        "gcs",
        [f"{settings.data_bucket}/{PARSED_PREFIX}/{name}" for name in LANDING_MODELS],
    )


def is_full_window(run_type: str, interval_start: datetime) -> bool:
    """Whether a run processes the whole ingestion window, not only new days."""
    if run_type != SCHEDULED_RUN_TYPE:
        return True
    return interval_start.astimezone(UTC).hour == FULL_WINDOW_HOUR_UTC


def ingest_interval(
    settings: PipelineSettings, interval_start: datetime, interval_end: datetime
) -> MailIngestResult:
    """Ingest the mail of one data interval (its date window, ADR-0007)."""
    exclusions = load_sender_exclusions(settings.sender_exclusions_path)
    store = GcsRawStore(bucket(settings))
    context = RunContext(
        job_name="ingest_mail",
        inputs=lineage_names("imap", [settings.imap_mailbox]),
        outputs=lineage_names("gcs", [f"{settings.data_bucket}/{RAW_MAIL_PREFIX}"]),
        interval_start=interval_start,
        interval_end=interval_end,
        code_version=settings.code_version,
    )
    with open_mailbox(settings) as reader:
        reader.select_read_only(settings.imap_mailbox)
        return run_recorded(
            run_writer(settings),
            context,
            lambda: ingest_mail(
                reader, store, exclusions, interval_start, interval_end
            ),
        )


def parse_mail_days(settings: PipelineSettings, days: Sequence[date]) -> None:
    """Parse the given days' raw mail into the parsed zone."""
    data = bucket(settings)
    context = _days_context(
        settings,
        "parse_mail",
        lineage_names("gcs", [f"{settings.data_bucket}/{RAW_MAIL_PREFIX}"]),
        parsed_names(settings),
        days,
    )
    run_recorded(
        run_writer(settings),
        context,
        lambda: parse_mail(GcsRawStore(data), GcsParsedStore(data), days),
    )


def load_landing_days(settings: PipelineSettings, days: Sequence[date]) -> None:
    """Replace the given days' partitions of every landing table."""
    dataset = settings.bq_landing_dataset
    context = _days_context(
        settings,
        "load_landing",
        parsed_names(settings),
        lineage_names("bq", [f"{dataset}.{name}" for name in LANDING_MODELS]),
        days,
    )
    run_recorded(
        run_writer(settings),
        context,
        lambda: load_landing(warehouse(settings), dataset, settings.data_bucket, days),
    )


def ingest_for_interval(
    interval_start: str, interval_end: str, run_type: str
) -> list[str]:
    """DAG entry point: ingest, then return the days later tasks must process."""
    settings = _settings()
    start = datetime.fromisoformat(interval_start)
    end = datetime.fromisoformat(interval_end)
    result = ingest_interval(settings, start, end)
    if is_full_window(run_type, start):
        days = days_between(*date_window(start, end))
    else:
        days = result.written_days
    logger.info("Days to process: %d", len(days))
    return [day.isoformat() for day in days]


def parse_days(days: Sequence[str]) -> None:
    """DAG entry point: parse the given ISO days."""
    parse_mail_days(_settings(), [date.fromisoformat(day) for day in days])


def load_days(days: Sequence[str]) -> None:
    """DAG entry point: load the given ISO days into landing."""
    load_landing_days(_settings(), [date.fromisoformat(day) for day in days])


def _settings() -> PipelineSettings:
    logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
    return PipelineSettings()  # type: ignore[call-arg]  # values come from env


def _days_context(
    settings: PipelineSettings,
    job_name: str,
    inputs: list[str],
    outputs: list[str],
    days: Sequence[date],
) -> RunContext:
    """A run context spanning the given days; records use the landing schemas."""
    return RunContext(
        job_name=job_name,
        inputs=inputs,
        outputs=outputs,
        interval_start=day_start_utc(min(days)) if days else None,
        interval_end=day_start_utc(max(days) + ONE_DAY) if days else None,
        schema_version=landing_schema_version(),
        code_version=settings.code_version,
    )
