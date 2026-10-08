"""Command-line entry points for running pipeline steps by hand.

Used for local development and manual backfills; in production the Airflow DAG
calls the same functions (ADR-0003). Dates are explicit arguments, never the
wall clock. Output goes through logging and contains only counts, keys, and
mailbox names — never mail content or senders (CLAUDE.md, Privacy).
"""

import argparse
import logging
from collections.abc import Sequence
from datetime import UTC, date, datetime, time

from google.cloud import storage

from tracemail_pipeline.config import PipelineSettings
from tracemail_pipeline.ingest.allowlist import load_allowlist
from tracemail_pipeline.ingest.imap_client import open_mailbox
from tracemail_pipeline.ingest.mail_ingest import ingest_mail
from tracemail_pipeline.ingest.raw_inventory import raw_inventory
from tracemail_pipeline.ingest.raw_store import GcsRawStore
from tracemail_pipeline.parse.parse_mail import parse_mail
from tracemail_pipeline.parse.parsed_store import GcsParsedStore

logger = logging.getLogger(__name__)

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"


def build_parser() -> argparse.ArgumentParser:
    """Build the argument parser with one subcommand per pipeline step."""
    parser = argparse.ArgumentParser(prog="tracemail-pipeline")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list-mailboxes", help="List mailbox folder names")
    for name, help_text in [
        ("ingest-mail", "Ingest mail for a date range"),
        ("raw-inventory", "Count stored raw mail per allowlist entry"),
        ("parse-mail", "Parse stored raw mail into the parsed zone"),
    ]:
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


def run_list_mailboxes(settings: PipelineSettings) -> None:
    """Log every mailbox name so the right one can be put in configuration."""
    with open_mailbox(settings) as reader:
        for name in reader.list_mailboxes():
            logger.info("Mailbox: %s", name)


def _bucket(settings: PipelineSettings) -> storage.Bucket:
    return storage.Client(project=settings.gcp_project).bucket(settings.data_bucket)


def _raw_store(settings: PipelineSettings) -> GcsRawStore:
    return GcsRawStore(_bucket(settings))


def run_parse_mail(settings: PipelineSettings, start: date, end: date) -> None:
    """Parse raw mail received in ``[start, end)`` into the parsed zone."""
    bucket = _bucket(settings)
    parse_mail(GcsRawStore(bucket), GcsParsedStore(bucket), start, end)


def run_raw_inventory(settings: PipelineSettings, start: date, end: date) -> None:
    """Log how many stored messages each allowlist entry accounts for."""
    allowlist = load_allowlist(settings.sender_allowlist_path)
    result = raw_inventory(_raw_store(settings), allowlist, start, end)
    for entry, count in result.by_entry.items():
        logger.info("%5d  %s", count, entry)


def run_ingest_mail(settings: PipelineSettings, start: date, end: date) -> None:
    """Ingest mail whose interval is ``[start, end)`` in UTC."""
    allowlist = load_allowlist(settings.sender_allowlist_path)
    store = _raw_store(settings)
    with open_mailbox(settings) as reader:
        reader.select_read_only(settings.imap_mailbox)
        ingest_mail(
            reader,
            store,
            allowlist,
            day_start_utc(start),
            day_start_utc(end),
        )


def main(argv: Sequence[str] | None = None) -> None:
    """Parse arguments and run the chosen command."""
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
    settings = PipelineSettings()  # type: ignore[call-arg]  # values come from env
    if args.command == "list-mailboxes":
        run_list_mailboxes(settings)
    elif args.command == "raw-inventory":
        run_raw_inventory(settings, args.start_date, args.end_date)
    elif args.command == "parse-mail":
        run_parse_mail(settings, args.start_date, args.end_date)
    else:
        run_ingest_mail(settings, args.start_date, args.end_date)


if __name__ == "__main__":
    main()
