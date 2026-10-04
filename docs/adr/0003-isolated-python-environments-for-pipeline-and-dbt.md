# ADR-0003: Isolated Python Environments for Pipeline Code and dbt

**Date:** 2026-10-03
**Status:** Accepted (not yet implemented)

## Context

Three pieces of Python run on the same VM under Airflow: Airflow itself, our
own pipeline code (IMAP, parsing, GCS and BigQuery loads), and dbt. They have
overlapping dependencies (Google Cloud client libraries, Pydantic, and their
transitive dependencies).

Airflow's official installation docs say Airflow is both a library and an
application, that a plain `pip install apache-airflow` can produce an unusable
installation, and that reproducible installs rely on Airflow's constraint
files. Installing through other dependency managers is only described as
"convert the constraints to your tool's format"; there is no statement that
resolving Airflow inside another project's lockfile is supported.

The Cosmos documentation states that a separate virtual environment for dbt is
recommended "because dbt and Airflow can have conflicting dependencies."

Our own code is managed as a uv workspace with a single `uv.lock`.

## Decision

The Airflow image contains three isolated Python environments:

1. **Airflow environment** — Airflow and providers only, installed with
   Airflow's constraint file. Contains DAG files and nothing else of ours.
2. **`pipeline_venv`** — built from the workspace `uv.lock`. Airflow runs our
   code here through `@task.external_python`. Airflow is not installed in it.
3. **`dbt_venv`** — built from `dbt/uv.lock` (dbt is its own uv project, not a
   workspace member). Airflow invokes dbt from this environment.

Consequences for code:

- Pipeline functions take plain arguments (`interval_start`, `interval_end`,
  `run_id`, `try_number` as strings), passed from the DAG through Jinja-
  templated `op_kwargs`. They never receive Airflow context objects. Airflow
  docs state `var` and `ti` / `task_instance` cannot be serialized into an
  external environment, and other context values require Airflow to be
  installed there.
- Pipeline code uses Google Cloud client libraries directly, not Airflow hooks.
- Return values (XCom) are small: object keys, counts. Never mail content.

Locally, the workspace venv and `dbt_venv` are used directly; Airflow exists
only in Docker.

## Rationale

Alternatives considered:

1. **Install everything into Airflow's environment / one lockfile.**
   Rejected. Even if it resolves today, every Airflow or dbt upgrade can
   reintroduce a conflict; a successful test now would be luck, not a
   guarantee. Both upstream projects point toward isolation.
2. **`@task.virtualenv` (venv created per run).** Rejected: rebuilds the
   environment at runtime, adds per-run overhead, and moves away from a
   lockfile-pinned, build-time environment.
3. **Container-per-task (KubernetesPodOperator / DockerOperator).**
   Rejected: Kubernetes is out of scope, and container-per-task adds
   orchestration machinery with no benefit at this volume.
4. **Split the repository.** Rejected: isolation is a build-time concern;
   one repository can produce isolated environments.

## Consequences

**Positive:**

- Upgrading Airflow, dbt, or our dependencies cannot break the others.
- Pipeline code has no Airflow dependency and is fully testable without
  Airflow — which is what "no business logic in DAG files" requires anyway.

**Negative / trade-offs:**

- One image carries three environments; build time and image size grow.
- The `pipeline_venv` Python version must match Airflow's.
- Not yet verified: whether the external-Python subprocess inherits the
  container's environment variables (credentials and `Settings` depend on
  this). Verify with the first DAG; if not, pass them explicitly.

## References

1. [Installation from PyPI (constraint files) — Apache Airflow docs](https://airflow.apache.org/docs/apache-airflow/stable/installation/installing-from-pypi.html)
2. [Getting started on open-source Airflow (dbt in a separate virtualenv) — Astronomer Cosmos docs](https://astronomer.github.io/astronomer-cosmos/getting_started/open-source.html)
3. [Run tasks in an isolated environment — Astronomer](https://www.astronomer.io/docs/learn/airflow-isolated-environments)
4. [Python operators (ExternalPythonOperator, context serialization, templated op_kwargs) — Airflow standard provider docs](https://airflow.apache.org/docs/apache-airflow-providers-standard/stable/operators/python.html)
