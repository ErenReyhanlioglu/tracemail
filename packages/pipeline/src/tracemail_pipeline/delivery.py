"""Delivery metrics' pipeline: GitHub deployments → raw → parsed → landing (ADR-0045).

One DAG task runs the three steps for its data interval, each with its own
run record, so ``ops`` shows them like the mail steps. A scheduled run looks
at deployments created since an hour before its interval: a deployment
finishes within minutes, and one still running is stored by the next run.
The daily full-window run and every manual run look back a whole day, which
repairs a run that died; older history comes from the command line. Parsing
and loading touch only the creation dates that got new records.
"""

from collections.abc import Sequence
from datetime import date, datetime, timedelta

from tracemail_pipeline.dates import ONE_DAY, day_start_utc
from tracemail_pipeline.ingest.deployments import (
    RAW_DEPLOYMENTS_PREFIX,
    ingest_deployments,
)
from tracemail_pipeline.ingest.github_api import DeliverySettings, UrllibGithubApi
from tracemail_pipeline.ingest.raw_store import GcsRawStore
from tracemail_pipeline.jobs import (
    bucket,
    is_full_window,
    load_settings,
    run_writer,
    warehouse,
)
from tracemail_pipeline.load.bq_schema import schema_version
from tracemail_pipeline.load.landing import load_landing
from tracemail_pipeline.load.run_records import RunContext, lineage_names, run_recorded
from tracemail_pipeline.parse.deployments import (
    DEPLOYMENTS,
    GithubDeployment,
    parse_deployments,
)
from tracemail_pipeline.parse.parsed_store import PARSED_PREFIX, GcsParsedStore

# Before a scheduled run's interval: a deployment created then may have
# finished only now.
SCHEDULED_LOOKBACK = timedelta(hours=1)
FULL_WINDOW_LOOKBACK = ONE_DAY
MODELS = {DEPLOYMENTS: GithubDeployment}


def deliver_window(window_start: datetime, window_end: datetime) -> list[date]:
    """Ingest, parse, and load the deployments created in the window; return
    the creation dates that got new records."""
    settings = load_settings()
    delivery = DeliverySettings()  # type: ignore[call-arg]  # values come from env
    data = bucket(settings)
    source = lineage_names("github", [f"{delivery.github_repository}/deployments"])
    raw = lineage_names("gcs", [f"{settings.data_bucket}/{RAW_DEPLOYMENTS_PREFIX}"])
    parsed = lineage_names(
        "gcs", [f"{settings.data_bucket}/{PARSED_PREFIX}/{DEPLOYMENTS}"]
    )
    table = lineage_names("bq", [f"{settings.bq_landing_dataset}.{DEPLOYMENTS}"])
    writer = run_writer(settings)
    version = settings.code_version
    ingested = run_recorded(
        writer,
        _context(version, "ingest_deployments", source, raw, window_start, window_end),
        lambda: ingest_deployments(
            UrllibGithubApi(delivery), GcsRawStore(data), window_start, window_end
        ),
    )
    days = ingested.written_days
    if not days:
        return []
    start, end = day_start_utc(min(days)), day_start_utc(max(days) + ONE_DAY)
    run_recorded(
        writer,
        _context(version, "parse_deployments", raw, parsed, start, end),
        lambda: parse_deployments(GcsRawStore(data), GcsParsedStore(data), days),
    )
    landing = settings.bq_landing_dataset
    run_recorded(
        writer,
        _context(version, "load_deployments", parsed, table, start, end),
        lambda: load_landing(
            warehouse(settings), landing, settings.data_bucket, days, MODELS
        ),
    )
    return days


def deliver_for_interval(
    interval_start: str, interval_end: str, run_type: str
) -> list[str]:
    """DAG entry point: the deployments around one data interval."""
    start = datetime.fromisoformat(interval_start)
    end = datetime.fromisoformat(interval_end)
    lookback = (
        FULL_WINDOW_LOOKBACK if is_full_window(run_type, start) else SCHEDULED_LOOKBACK
    )
    return [day.isoformat() for day in deliver_window(start - lookback, end)]


def _context(
    code_version: str | None,
    job_name: str,
    inputs: Sequence[str],
    outputs: Sequence[str],
    start: datetime,
    end: datetime,
) -> RunContext:
    return RunContext(
        job_name=job_name,
        inputs=list(inputs),
        outputs=list(outputs),
        interval_start=start,
        interval_end=end,
        schema_version=schema_version(GithubDeployment),
        code_version=code_version,
    )
