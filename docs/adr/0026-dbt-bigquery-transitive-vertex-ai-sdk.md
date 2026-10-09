# ADR-0026: Accept the Vertex AI SDK as a Transitive Dependency of dbt-bigquery

**Date:** 2026-10-09
**Status:** Accepted

## Context

CLAUDE.md (Phase Discipline) says no LLM SDK dependency enters the codebase
before Phase 2, and no later-phase dependency appears in any lockfile. Step 1.5
adds `dbt-core` and `dbt-bigquery` to `dbt/uv.lock` (ADR-0014).

Checked on PyPI on 2026-10-09 [1][2]:

- The latest releases are `dbt-core` 1.12.5 and `dbt-bigquery` 1.12.1 (both
  2026-09-15).
- `dbt-bigquery` lists `google-cloud-aiplatform` (the Vertex AI SDK) as a
  required dependency since 1.9.2 (2025-05-22); only 1.9.0 and 1.9.1 (2024
  and early 2025) do not. It also requires `google-cloud-dataproc` and
  `google-cloud-bigquery[pandas]`. These serve dbt Python models and
  BigQuery's AI functions, which this project does not use.
- `google-cloud-bigquery[pandas]` pulls `pandas-gbq`, which lists
  `google-cloud-bigquery-storage` only under its own optional `bqstorage`
  extra. After `uv add`, `dbt/uv.lock` contains `google-cloud-aiplatform`
  2.4.0 and **does not** contain `google-cloud-bigquery-storage` (verified),
  so the Storage Read API rule (ADR-0011, ADR-0016) is unaffected.

Measured in the local `dbt/.venv` (Windows): 400 MB of installed packages, of
which about 97 MB belong to `google-cloud-aiplatform` and packages only it
brings (`google-genai`); the largest items are `pyarrow` (86 MB) and `pandas`
(36 MB) from the `pandas` extra. The size in the `linux/arm64` Airflow image
is measured in step 1.7.

## Decision

Accept `google-cloud-aiplatform` and its dependencies as **transitive**
dependencies of `dbt-bigquery`, confined to `dbt/uv.lock` and `dbt_venv`
(ADR-0003). Project code never imports or calls them, and no dbt Python model
or BigQuery AI function is used. The Phase 1 rule keeps its purpose — no LLM
call and no LLM code before Phase 2 — and CLAUDE.md records this one
exception.

## Rationale

Alternatives considered:

1. **Pin `dbt-bigquery` to 1.9.1.** Rejected: a 2024 release line, contrary
   to ADR-0014's choice of the latest 1.x minor, and without later fixes.
2. **Exclude the package with a dependency override.** Rejected: whether
   `dbt-bigquery` imports it on startup is unknown, so the environment could
   break at runtime, and the override would need re-checking on every
   upgrade.

## Consequences

**Positive:**

- dbt stays on the current 1.x release.
- The exception is explicit and limited to one lockfile.

**Negative / trade-offs:**

- About 97 MB more in the dbt environment, and later in the Airflow image.
- An LLM SDK is installed, though unused, before Phase 2.
- Revisit if `dbt-bigquery` makes these dependencies optional, or when the
  image size on the VM becomes a constraint.

## References

1. [dbt-bigquery — PyPI](https://pypi.org/project/dbt-bigquery/) (release metadata read through the PyPI JSON API)
2. [dbt-core — PyPI](https://pypi.org/project/dbt-core/) (release metadata read through the PyPI JSON API)
