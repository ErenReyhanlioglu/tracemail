"""Command-line entry points for running pipeline steps by hand.

Used for local development and manual backfills; in production the Airflow DAG
calls the same functions (ADR-0003). Dates are explicit arguments, never the
wall clock. Every pipeline step runs through ``run_recorded`` and leaves a run
record in ``ops`` (ADR-0020). Output goes through logging and contains only
counts, keys, and mailbox names — never mail content or senders (CLAUDE.md,
Privacy).
"""

import argparse
import logging
from collections.abc import Sequence
from datetime import UTC, date, datetime, time

import google.cloud.storage as storage
from google.cloud import bigquery

from tracemail_pipeline.config import PipelineSettings
from tracemail_pipeline.ingest.imap_client import open_mailbox
from tracemail_pipeline.ingest.mail_ingest import ingest_mail
from tracemail_pipeline.ingest.raw_inventory import raw_inventory
from tracemail_pipeline.ingest.raw_store import RAW_MAIL_PREFIX, GcsRawStore
from tracemail_pipeline.ingest.sender_exclusions import load_sender_exclusions
from tracemail_pipeline.load.landing import (
    LANDING_MODELS,
    landing_fingerprints,
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
DATE_RANGE_COMMANDS = {
    "ingest-mail": "Ingest mail for a date range",
    "raw-inventory": "Count stored raw mail per sender domain",
    "parse-mail": "Parse stored raw mail into the parsed zone",
    "load-landing": "Load the parsed zone into BigQuery landing tables",
    "landing-check": "Row counts and content fingerprints of landing tables",
}


def build_parser() -> argparse.ArgumentParser:
    """Build the argument parser with one subcommand per pipeline step."""
    parser = argparse.ArgumentParser(prog="tracemail-pipeline")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list-mailboxes", help="List mailbox folder names")
    for name, help_text in DATE_RANGE_COMMANDS.items():
        command = commands.add_parser(name, help=help_text)
        command.add_argument("--start-date", type=date.fromisoformat, required=True)
        command.add_argument(
            "--end-date",
            type=date.fromisoformat,
            required=True,
            help="Exclusive end date (UTC)",
        )
    return parser


def day_start_utc(day: date) -> datetime:
    """Return midnight UTC at the start of a day."""
    return datetime.combine(day, time.min, tzinfo=UTC)


def _bucket(settings: PipelineSettings) -> storage.Bucket:
    return storage.Client(project=settings.gcp_project).bucket(settings.data_bucket)


def _warehouse(settings: PipelineSettings) -> BigQueryWarehouse:
    client = bigquery.Client(project=settings.gcp_project)
    return BigQueryWarehouse(client, settings.bq_location, settings.bq_max_bytes_billed)


def _writer(settings: PipelineSettings) -> WarehouseRunRecordWriter:
    return WarehouseRunRecordWriter(
        _warehouse(settings), settings.bq_ops_dataset, settings.ops_retention_days
    )


def _context(
    settings: PipelineSettings,
    job_name: str,
    inputs: list[str],
    outputs: list[str],
    start: date,
    end: date,
    produces_records: bool = True,
) -> RunContext:
    """Build a run context; ``schema_version`` only for steps that write
    records with the landing schemas (raw ingestion writes original bytes)."""
    return RunContext(
        job_name=job_name,
        inputs=inputs,
        outputs=outputs,
        interval_start=day_start_utc(start),
        interval_end=day_start_utc(end),
        schema_version=landing_schema_version() if produces_records else None,
        code_version=settings.code_version,
    )


def _parsed_names(settings: PipelineSettings) -> list[str]:
    return lineage_names(
        "gcs",
        [f"{settings.data_bucket}/{PARSED_PREFIX}/{name}" for name in LANDING_MODELS],
    )


def run_list_mailboxes(settings: PipelineSettings) -> None:
    """Log every mailbox name so the right one can be put in configuration."""
    with open_mailbox(settings) as reader:
        for name in reader.list_mailboxes():
            logger.info("Mailbox: %s", name)


def run_ingest_mail(settings: PipelineSettings, start: date, end: date) -> None:
    """Ingest mail whose interval is ``[start, end)`` in UTC."""
    exclusions = load_sender_exclusions(settings.sender_exclusions_path)
    store = GcsRawStore(_bucket(settings))
    context = _context(
        settings,
        "ingest_mail",
        lineage_names("imap", [settings.imap_mailbox]),
        lineage_names("gcs", [f"{settings.data_bucket}/{RAW_MAIL_PREFIX}"]),
        start,
        end,
        produces_records=False,
    )
    with open_mailbox(settings) as reader:
        reader.select_read_only(settings.imap_mailbox)
        run_recorded(
            _writer(settings),
            context,
            lambda: ingest_mail(
                reader, store, exclusions, day_start_utc(start), day_start_utc(end)
            ),
        )


def run_parse_mail(settings: PipelineSettings, start: date, end: date) -> None:
    """Parse raw mail received in ``[start, end)`` into the parsed zone."""
    bucket = _bucket(settings)
    context = _context(
        settings,
        "parse_mail",
        lineage_names("gcs", [f"{settings.data_bucket}/{RAW_MAIL_PREFIX}"]),
        _parsed_names(settings),
        start,
        end,
    )
    run_recorded(
        _writer(settings),
        context,
        lambda: parse_mail(GcsRawStore(bucket), GcsParsedStore(bucket), start, end),
    )


def run_load_landing(settings: PipelineSettings, start: date, end: date) -> None:
    """Replace the ``[start, end)`` partitions of every landing table."""
    warehouse = _warehouse(settings)
    dataset = settings.bq_landing_dataset
    context = _context(
        settings,
        "load_landing",
        _parsed_names(settings),
        lineage_names("bq", [f"{dataset}.{name}" for name in LANDING_MODELS]),
        start,
        end,
    )
    run_recorded(
        _writer(settings),
        context,
        lambda: load_landing(warehouse, dataset, settings.data_bucket, start, end),
    )


def run_landing_check(settings: PipelineSettings, start: date, end: date) -> None:
    """Log row counts and fingerprints, to compare before and after a reload."""
    fingerprints = landing_fingerprints(
        _warehouse(settings), settings.bq_landing_dataset, start, end
    )
    for table, value in fingerprints.items():
        logger.info(
            "%-24s rows=%d fingerprint=%s", table, value.row_count, value.fingerprint
        )


def run_raw_inventory(settings: PipelineSettings, start: date, end: date) -> None:
    """Log how many stored messages each sender domain accounts for."""
    exclusions = load_sender_exclusions(settings.sender_exclusions_path)
    result = raw_inventory(GcsRawStore(_bucket(settings)), exclusions, start, end)
    for domain, count in result.by_domain.items():
        logger.info("%5d  %s", count, domain)


def main(argv: Sequence[str] | None = None) -> None:
    """Parse arguments and run the chosen command."""
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
    settings = PipelineSettings()  # type: ignore[call-arg]  # values come from env
    match args.command:
        case "list-mailboxes":
            run_list_mailboxes(settings)
        case "ingest-mail":
            run_ingest_mail(settings, args.start_date, args.end_date)
        case "raw-inventory":
            run_raw_inventory(settings, args.start_date, args.end_date)
        case "parse-mail":
            run_parse_mail(settings, args.start_date, args.end_date)
        case "load-landing":
            run_load_landing(settings, args.start_date, args.end_date)
        case "landing-check":
            run_landing_check(settings, args.start_date, args.end_date)


if __name__ == "__main__":
    main()
