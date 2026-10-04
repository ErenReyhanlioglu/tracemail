# ADR-0014: dbt 1.x Orchestrated with Cosmos

**Date:** 2026-10-04
**Status:** Accepted (not yet implemented)

## Context

Two connected questions: which dbt generation to use, and how Airflow invokes
it every hour.

Sources disagree on dbt 2.0's maturity:

- dbt Labs' documentation describes v2 (the Rust engine shared with dbt
  Fusion) as the current release, recommends it for new projects, lists
  BigQuery as supported, and states that v1.x "remains fully supported" while
  new capabilities land in v2 only [1].
- Cosmos, the Astronomer library that renders a dbt project as Airflow tasks,
  pins `dbt-core<2.0` in its virtualenv examples "to avoid alpha pickup" [2],
  and its dbt Fusion support page does not list BigQuery among supported
  platforms [3]. That page may be outdated; this was not verified.

Cosmos supports Airflow 3.x, including 3.2 and 3.3 [2], and documents
`ExecutionMode.LOCAL` with `ExecutionConfig.dbt_executable_path` pointing at a
dedicated dbt virtual environment [4][5] — the same layout ADR-0003 chose.

Product behavior differs by invocation style:

- **One `dbt build` task:** a failure shows as one red task; finding the
  failed model means reading logs; a retry reruns everything.
- **Cosmos:** each model and test is its own Airflow task with dependencies;
  a failure points at the exact model, independent branches keep running, and
  a retry reruns only the failed node and its dependents.

## Decision

- **dbt 1.x** (latest 1.x minor, `dbt-bigquery` adapter), pinned below 2.0 in
  `dbt/uv.lock`.
- **Cosmos** renders the dbt project as Airflow tasks, using
  `ExecutionMode.LOCAL` with `dbt_executable_path` set to `dbt_venv`. Cosmos is
  installed in the Airflow environment under Airflow's constraints; dbt
  itself stays in `dbt_venv`.
- dbt's run artifacts (test results) are loaded into `ops` for the health
  panel, independent of how dbt is invoked.

**Revisit** when Cosmos declares dbt 2.0 support stable for BigQuery and the
packages this project uses (for example, `dbt_utils`) are verified on 2.0.
A migration to 2.0 is a new ADR that supersedes this one.

## Rationale

Alternatives considered:

1. **dbt 2.0 with a single `dbt build` task.** Rejected for now: the newest
   engine on an hourly production schedule, with package compatibility
   unverified, and without model-level visibility or retries.
2. **dbt 2.0 with Cosmos.** Rejected: Cosmos itself treats 2.0 as not yet
   stable.
3. **dbt 1.x with a single task.** Rejected: loses model-level failure
   visibility, which serves the same debuggability goal as ADR-0006, and
   loses a visible Airflow–dbt integration, one of the project's portfolio
   competencies.

## Consequences

**Positive:**

- A widely used, documented combination on a schedule that runs 24 times a
  day.
- A failed model is visible directly in Airflow, and retries are scoped to
  what failed.
- Matches the isolated-environment layout of ADR-0003 without exceptions.

**Negative / trade-offs:**

- Starts on the previous dbt generation; a migration to 2.0 is expected
  later.
- Cosmos parses the dbt project when building the DAG, adding load to DAG
  processing; to be observed once running.
- One more library in the Airflow environment that must stay compatible with
  Airflow's constraints.

## References

1. [Upgrading to v2 — dbt docs](https://docs.getdbt.com/docs/dbt-versions/core-upgrade/upgrading-to-v2)
2. [astronomer-cosmos CHANGELOG — GitHub](https://github.com/astronomer/astronomer-cosmos/blob/main/CHANGELOG.rst)
3. [dbt Fusion support — Astronomer Cosmos docs](https://astronomer.github.io/astronomer-cosmos/configuration/dbt-fusion) (known from search-result summaries)
4. [Execution Config — Astronomer Cosmos docs](https://astronomer.github.io/astronomer-cosmos/configuration/execution-config.html) (known from search-result summaries)
5. [Getting started on open-source Airflow — Astronomer Cosmos docs](https://astronomer.github.io/astronomer-cosmos/getting_started/open-source.html)
