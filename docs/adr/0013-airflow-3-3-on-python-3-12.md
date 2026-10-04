# ADR-0013: Airflow 3.3 on Python 3.12

**Date:** 2026-10-04
**Status:** Accepted (not yet implemented)

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
