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
from datetime import date
from pathlib import Path

from tracemail_pipeline import jobs
from tracemail_pipeline.config import PipelineSettings
from tracemail_pipeline.dates import day_start_utc, days_between
from tracemail_pipeline.ingest.imap_client import open_mailbox
from tracemail_pipeline.ingest.raw_inventory import raw_inventory
from tracemail_pipeline.ingest.raw_store import GcsRawStore
from tracemail_pipeline.ingest.sender_exclusions import load_sender_exclusions
from tracemail_pipeline.load.dbt_results import record_dbt_build
from tracemail_pipeline.load.landing import LANDING_MODELS, landing_fingerprints
from tracemail_pipeline.load.run_records import RunContext, lineage_names

logger = logging.getLogger(__name__)

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
    record = commands.add_parser(
        "record-dbt-build", help="Record a dbt build's results in ops (ADR-0023)"
    )
    record.add_argument("--run-results", type=Path, nargs="+", required=True)
    record.add_argument("--manifest", type=Path, required=True)
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


def run_list_mailboxes(settings: PipelineSettings) -> None:
    """Log every mailbox name so the right one can be put in configuration."""
    with open_mailbox(settings) as reader:
        for name in reader.list_mailboxes():
            logger.info("Mailbox: %s", name)


def run_ingest_mail(settings: PipelineSettings, start: date, end: date) -> None:
    """Ingest mail whose interval is ``[start, end)`` in UTC."""
    jobs.ingest_interval(settings, day_start_utc(start), day_start_utc(end))


def run_parse_mail(settings: PipelineSettings, start: date, end: date) -> None:
    """Parse raw mail received in ``[start, end)`` into the parsed zone."""
    jobs.parse_mail_days(settings, days_between(start, end))


def run_load_landing(settings: PipelineSettings, start: date, end: date) -> None:
    """Replace the ``[start, end)`` partitions of every landing table."""
    jobs.load_landing_days(settings, days_between(start, end))


def run_landing_check(settings: PipelineSettings, start: date, end: date) -> None:
    """Log row counts and fingerprints, to compare before and after a reload."""
    fingerprints = landing_fingerprints(
        jobs.warehouse(settings), settings.bq_landing_dataset, start, end
    )
    for table, value in fingerprints.items():
        logger.info(
            "%-24s rows=%d fingerprint=%s", table, value.row_count, value.fingerprint
        )


def run_raw_inventory(settings: PipelineSettings, start: date, end: date) -> None:
    """Log how many stored messages each sender domain accounts for."""
    exclusions = load_sender_exclusions(settings.sender_exclusions_path)
    result = raw_inventory(GcsRawStore(jobs.bucket(settings)), exclusions, start, end)
    for domain, count in result.by_domain.items():
        logger.info("%5d  %s", count, domain)


def run_record_dbt_build(
    settings: PipelineSettings, run_results: list[Path], manifest: Path
) -> None:
    """Record a finished dbt build in ops; fails if any dbt node failed."""
    context = RunContext(
        job_name="dbt_build",
        inputs=lineage_names(
            "bq", [f"{settings.bq_landing_dataset}.{name}" for name in LANDING_MODELS]
        ),
        outputs=[],
        code_version=settings.code_version,
    )
    result = record_dbt_build(
        jobs.warehouse(settings),
        jobs.run_writer(settings),
        context,
        run_results,
        manifest,
    )
    logger.info("dbt build recorded: %s", result.model_dump())


def main(argv: Sequence[str] | None = None) -> None:
    """Parse arguments and run the chosen command."""
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.INFO, format=jobs.LOG_FORMAT)
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
        case "record-dbt-build":
            run_record_dbt_build(settings, args.run_results, args.manifest)


if __name__ == "__main__":
    main()
