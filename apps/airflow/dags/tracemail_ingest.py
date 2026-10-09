"""Hourly ingestion DAG: wiring only, logic lives in packages/ (ADR-0003).

ingest_mail -> has_new_days -> parse_mail -> load_landing

Pipeline steps run in pipeline_venv through ``@task.external_python``; each
callable imports the pipeline inside its body and passes plain strings, so
no Airflow object crosses into pipeline code. Ingestion returns the days to
process (ADR-0021): only days that received new mail, or the whole window on
the daily midnight run and on manual and backfill runs. When there is
nothing to process, the short-circuit skips the rest of the run.
"""

from datetime import UTC, datetime, timedelta

from airflow.sdk import dag, task

PIPELINE_PYTHON = "/opt/venvs/pipeline/bin/python"
START_DATE = datetime(2026, 10, 9, tzinfo=UTC)

# Network-bound steps retry with exponential backoff (CLAUDE.md, Airflow).
DEFAULT_ARGS = {
    "retries": 3,
    "retry_delay": timedelta(minutes=2),
    "retry_exponential_backoff": True,
    "max_retry_delay": timedelta(minutes=20),
    "execution_timeout": timedelta(minutes=30),
}


@dag(
    dag_id="tracemail_hourly",
    schedule="@hourly",
    start_date=START_DATE,
    catchup=False,
    # Runs reload overlapping windows; two at once could interleave partition
    # writes (ADR-0019).
    max_active_runs=1,
    default_args=DEFAULT_ARGS,
    tags=["tracemail"],
)
def tracemail_hourly() -> None:
    """Ingest the hour's mail, then parse and load the days it changed."""

    @task.external_python(python=PIPELINE_PYTHON, expect_airflow=False)
    def ingest_mail(interval_start: str, interval_end: str, run_type: str) -> list[str]:
        from tracemail_pipeline.jobs import ingest_for_interval

        return ingest_for_interval(interval_start, interval_end, run_type)

    @task.short_circuit
    def has_new_days(days: list[str]) -> bool:
        return bool(days)

    @task.external_python(python=PIPELINE_PYTHON, expect_airflow=False)
    def parse_mail(days: list[str]) -> list[str]:
        from tracemail_pipeline.jobs import parse_days

        parse_days(days)
        return days

    @task.external_python(python=PIPELINE_PYTHON, expect_airflow=False)
    def load_landing(days: list[str]) -> list[str]:
        from tracemail_pipeline.jobs import load_days

        load_days(days)
        return days

    days = ingest_mail(
        "{{ data_interval_start.isoformat() }}",
        "{{ data_interval_end.isoformat() }}",
        "{{ dag_run.run_type }}",
    )
    parsed = parse_mail(days)
    has_new_days(days) >> parsed
    load_landing(parsed)


tracemail_hourly()
