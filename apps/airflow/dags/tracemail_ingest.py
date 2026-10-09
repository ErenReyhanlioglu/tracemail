"""Hourly ingestion DAG: wiring only, logic lives in packages/ (ADR-0003).

ingest_mail -> has_new_days -> parse_mail -> load_landing -> dbt (watcher)

Pipeline steps run in pipeline_venv through ``@task.external_python``; each
callable imports the pipeline inside its body and passes plain strings, so
no Airflow object crosses into pipeline code. Ingestion returns the days to
process (ADR-0021): only days that received new mail, or the whole window on
the daily midnight run and on manual and backfill runs. When there is
nothing to process, the short-circuit skips the rest of the run, dbt
included (ADR-0022).

dbt runs through Cosmos in watcher mode (ADR-0029): one ``dbt build`` in
dbt_venv, one sensor task per model and test. The DAG is rendered from the
manifest compiled into the image, so parsing this file never runs dbt. After
the build, failed or not, the callback records it in ``ops`` with the
pipeline's ``record-dbt-build`` command (ADR-0023).

Before each external_python task, Airflow probes the venv with
``python -c "import pendulum"``; the resulting ModuleNotFoundError in the
log is expected (pendulum is not a pipeline dependency) and harmless.
"""

import logging
import subprocess
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from airflow.sdk import dag, task
from cosmos import (
    DbtTaskGroup,
    ExecutionConfig,
    ProfileConfig,
    ProjectConfig,
    RenderConfig,
)
from cosmos.constants import ExecutionMode, LoadMode

logger = logging.getLogger(__name__)

PIPELINE_PYTHON = "/opt/venvs/pipeline/bin/python"
DBT_EXECUTABLE = "/opt/venvs/dbt/bin/dbt"
DBT_PROJECT = Path("/opt/airflow/dbt")
# The dev target until the production project exists (step 1.11).
DBT_TARGET = "dev"
START_DATE = datetime(2026, 10, 9, tzinfo=UTC)

# Network-bound steps retry with exponential backoff (CLAUDE.md, Airflow).
DEFAULT_ARGS = {
    "retries": 3,
    "retry_delay": timedelta(minutes=2),
    "retry_exponential_backoff": True,
    "max_retry_delay": timedelta(minutes=20),
    "execution_timeout": timedelta(minutes=30),
}


def record_dbt_build(project_dir: str, **kwargs: Any) -> None:
    """Cosmos callback: record the build's artifacts in ops (ADR-0023).

    Runs after the build whether it passed or failed. A recording failure is
    logged, not raised, so it never hides the build's own outcome.
    """
    target = Path(project_dir) / "target"
    command = [
        PIPELINE_PYTHON,
        "-m",
        "tracemail_pipeline.cli",
        "record-dbt-build",
        "--run-results",
        str(target / "run_results.json"),
        "--manifest",
        str(target / "manifest.json"),
    ]
    completed = subprocess.run(command, check=False)
    if completed.returncode != 0:
        logger.warning("record-dbt-build exited with %d", completed.returncode)


@dag(
    dag_id="tracemail_hourly",
    schedule="@hourly",
    start_date=START_DATE,
    catchup=False,
    # Runs reload overlapping windows; two at once could interleave partition
    # writes (ADR-0019) and watcher builds (ADR-0029).
    max_active_runs=1,
    default_args=DEFAULT_ARGS,
    tags=["tracemail"],
)
def tracemail_hourly() -> None:
    """Ingest the hour's mail, parse and load the days it changed, build dbt."""

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

    dbt = DbtTaskGroup(
        group_id="dbt",
        project_config=ProjectConfig(
            dbt_project_path=DBT_PROJECT,
            manifest_path=DBT_PROJECT / "target" / "manifest.json",
        ),
        profile_config=ProfileConfig(
            profile_name="tracemail",
            target_name=DBT_TARGET,
            profiles_yml_filepath=DBT_PROJECT / "profiles.yml",
        ),
        execution_config=ExecutionConfig(
            execution_mode=ExecutionMode.WATCHER,
            dbt_executable_path=DBT_EXECUTABLE,
        ),
        render_config=RenderConfig(load_method=LoadMode.DBT_MANIFEST),
        operator_args={"install_deps": False, "callback": record_dbt_build},
    )

    days = ingest_mail(
        "{{ data_interval_start.isoformat() }}",
        "{{ data_interval_end.isoformat() }}",
        "{{ dag_run.run_type }}",
    )
    parsed = parse_mail(days)
    has_new_days(days) >> parsed
    load_landing(parsed) >> dbt


tracemail_hourly()
