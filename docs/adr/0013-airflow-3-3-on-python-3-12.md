# ADR-0013: Airflow 3.3 on Python 3.12

**Date:** 2026-10-04
**Status:** Accepted

## Context

Airflow's release lines have short support windows. As of this decision [1]:

- **3.3** — released 2026-07-06, latest 3.3.2 (2026-09-17), the only line in
  active support (about nine months of support in total).
- **3.2** — support ended 2026-07-06.
- **2.x** — active support ended 2025-10-22, limited (security) support ended
  2026-04-22.

Airflow 3.3.2 is tested with Python 3.10–3.14, and its official Docker image
defaults to Python 3.12 [2][3]. ADR-0003 requires `pipeline_venv` to use the
same Python version as Airflow.

## Decision

- Airflow **3.3.x**, installed from the official `apache/airflow` image with
  the matching constraint file, pinned to an exact patch version.
- **Python 3.12** everywhere: the Airflow image, `pipeline_venv`, `dbt_venv`,
  the uv workspace, and CI.
- Executor: `LocalExecutor` with Postgres as the metadata database (unchanged
  from CLAUDE.md).

Upgrades within 3.3 (patch releases) are routine. Moving to a new minor line
is a deliberate change: tried in dev first, then released.

## Implementation findings (step 1.7, 2026-10-09 to 2026-10-10)

Airflow 3.3.2 (`apache/airflow:3.3.2-python3.12`, Cosmos 1.15.1) behaves
differently from Airflow 2 in three ways that affected this DAG. Each was
found by a real run and verified in the image:

1. **Cron strings have no data interval.** `[scheduler]
   create_cron_data_intervals` defaults to `False`, so `schedule="@hourly"`
   gives runs whose `data_interval_start` equals `data_interval_end`. The DAG
   uses `CronDataIntervalTimetable("0 * * * *", timezone="UTC")` so each run
   covers its hour and starts when the hour ends.
2. **`dag_run.run_type` renders as `DagRunType.SCHEDULED` in templates.** The
   Task SDK's enum stringifies to its name, not its value (the CLI's
   `tasks render` shows `scheduled`, which hid the problem). The DAG passes
   `run_type.value`, and the pipeline rejects unknown run types
   (`UnknownRunTypeError`) instead of treating them as manual runs; before
   the fix every scheduled run processed the full window.
3. **`airflow dags test` runs tasks one at a time** unless given
   `--use-executor`. With the Cosmos watcher (ADR-0029) a sensor then waits
   for a producer that never starts; `just dag-test` passes the flag.

Also observed: before each `@task.external_python` task Airflow probes the
venv with `python -c "import pendulum"`; the logged ModuleNotFoundError is
expected, because pendulum is not a pipeline dependency. Restarting the
scheduler while a watcher build runs interrupts the producer, and the
sensors then re-run their nodes one by one; such re-runs are recorded as
`dbt_node_retry`, not as builds.

The local stack idles at about 1.2 GB of memory (scheduler 385 MB, triggerer
258 MB, API server 247 MB, DAG processor 200 MB, Postgres 79 MB).

## Rationale

Alternatives considered:

1. **Airflow 2.x.** Rejected: out of security support since April 2026.
2. **Airflow 3.2.** Rejected: support already ended.
3. **A different Python version.** Rejected: 3.12 is the image default and
   matches the project's Python baseline; any other choice adds a mismatch to
   manage between the image and our environments.

## Consequences

**Positive:**

- Starts on the supported line, with security fixes.
- One Python version across all environments removes a class of
  compatibility problems.

**Negative / trade-offs:**

- With roughly nine-month support windows, a minor-version upgrade is
  expected about once or twice a year.

## References

1. [Apache Airflow release cycles — endoflife.date](https://endoflife.date/apache-airflow)
2. [Supported versions — Airflow 3.3.2 docs](https://airflow.apache.org/docs/apache-airflow/stable/installation/supported-versions.html)
3. [Docker Image for Apache Airflow — docker-stack docs](https://airflow.apache.org/docs/docker-stack/index.html)
