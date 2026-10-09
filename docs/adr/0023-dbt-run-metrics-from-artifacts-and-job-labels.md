# ADR-0023: dbt Run Metrics from Artifacts and Job Labels, without Monitoring Packages

**Date:** 2026-10-09
**Status:** Proposed — accept with measured numbers during step 1.5

## Context

ADR-0017 requires every pipeline step to report its time, volume, operations,
and cost; ADR-0020 defines run records and lists monitoring metrics to be
derived in dbt in step 1.5. dbt is a pipeline step too, and the health panel
shows dbt test results. The question is which dbt measurements are standard
and how to collect them.

Standard sources, from documentation and source code (2026-10-09):

- **`run_results.json`**, written by every dbt invocation: per node
  `status`, `execution_time`, a `timing` breakdown (compile, execute),
  `failures` (test rows that failed), `adapter_response`; per invocation
  `elapsed_time` and an invocation id [1]. Only executed nodes appear [1].
- **BigQuery adapter response:** dbt-bigquery's `BigQueryAdapterResponse`
  carries `bytes_processed`, `bytes_billed`, `slot_ms`, `job_id`,
  `location`, and `project_id` [2]. dbt's documentation says the adapter
  response is "not applicable for data tests" [1], so test cost is expected
  to be missing from the file.
- **Job labels:** with `query-comment: job-label: true`, dbt applies its query
  comment (including `node_id`) as labels on each BigQuery job [3]. BigQuery's
  job metadata includes the labels and the bytes billed of every job [4],
  tests included.
- **Project health:** dbt defines test coverage (share of models with at
  least one test) and documentation coverage (share of models with a
  description) [5]. Both can be computed from `manifest.json`.
- **Data monitors:** the widely used set is volume anomalies, freshness
  anomalies, and schema changes [6] — the same pillars ADR-0020 adopted.

Ready-made packages exist: dbt_artifacts (known from search-result summaries)
[7] and Elementary [6]. Both write results from dbt's `on-run-end` hook with
SQL statements [8]. Cosmos runs each model and test as a separate dbt
invocation, so `on-run-end` runs once per task, not once per build; this is
an open Cosmos issue [9].

## Decision

No monitoring package. dbt runs are measured with the same mechanism as the
other steps:

1. **Artifacts to `ops` with load jobs.** After dbt finishes, a pipeline step
   reads `run_results.json` and appends one row per executed node to
   `ops.dbt_node_runs` (invocation id, node id, resource type, status,
   execution time, failures, bytes billed, slot ms, job id) with a batch load
   job, as in ADR-0020. The dbt step also writes its `ops.pipeline_runs` row:
   duration, node counts by status, total bytes billed. The reader accepts
   several result files for one build, because Cosmos produces one per task;
   how Cosmos hands them over is settled in step 1.7.
2. **Job labels on.** `query-comment.job-label` is enabled, and the step's
   total bytes billed — tests included — is read from BigQuery job metadata
   filtered by the build's labels.
3. **Coverage from `manifest.json`.** Test and documentation coverage are
   computed from the manifest and reported with the dbt step's result.
4. **Monitoring as our own dbt models** over `ops` and `landing`: freshness,
   missed runs, parse coverage per template, volume against recent history,
   and test pass rate (ADR-0020). Thresholds are dbt variables, not literals.
   Volume checks use weekly windows with raw counts: at about 8 mails a day,
   a daily rate is noise.

**Estimated cost (not measured):**

| Item | BigQuery query cost |
|---|---|
| 1. Artifacts → `ops` | None: reading a local file, free load job |
| 2. Job metadata | None if read through the jobs API (expected free, not verified); otherwise one `INFORMATION_SCHEMA` query per build, about 10 MB × 270 builds ≈ 3 GB a month |
| 3. Coverage | None: reading a local file |
| 4. Monitoring models | About 10 queries per build × 10 MB × 270 builds ≈ 27 GB a month (about 2.6% of the free tier) |

Build count from ADR-0022.

**To verify in step 1.5:** whether `adapter_response` is really empty for
tests; whether reading job metadata through the API is free of query charges;
the measured bytes billed per build.

## Rationale

Alternatives considered:

1. **Elementary or dbt_artifacts.** Rejected: under Cosmos their
   `on-run-end` hooks run for every task [9], so a build of about 70 nodes
   would issue about 70 rounds of insert statements, each billed at least
   10 MB — more than the dbt models themselves. They also write with SQL
   statements rather than free load jobs (ADR-0020), and Elementary's report
   UI is a separate observability tool, which is out of scope.
2. **Only `run_results.json`.** Rejected: test cost would be invisible.
3. **Only job metadata.** Rejected: no test outcomes, failures, or timing
   breakdown.

## Consequences

**Positive:**

- dbt is measured like every other step: same run-record table, same free
  write path, same health panel.
- Measurement adds almost nothing to the cost it measures.
- The code that collects and models these metrics is concrete evidence for
  the live-monitoring competency.

**Negative / trade-offs:**

- More code to write and test than installing a package.
- Anomaly detection is a simple rule (deviation from recent weekly history),
  not a statistical model.
- If Cosmos later runs `on-run-end` once per build, the packages become
  viable again; revisit then.

## References

1. [Run results JSON file — dbt docs](https://docs.getdbt.com/reference/artifacts/run-results-json)
2. [dbt-bigquery `connections.py` — dbt-labs/dbt-adapters, GitHub](https://github.com/dbt-labs/dbt-adapters/blob/main/dbt-bigquery/src/dbt/adapters/bigquery/connections.py) (read directly from source)
3. [query-comment — dbt docs](https://docs.getdbt.com/reference/project-configs/query-comment)
4. [JOBS view — BigQuery docs](https://docs.cloud.google.com/bigquery/docs/information-schema-jobs) (known from search-result summaries)
5. [Project recommendations — dbt docs](https://docs.getdbt.com/docs/explore/project-recommendations) (known from search-result summaries)
6. [Elementary data tests — Elementary docs](https://docs.elementary-data.com/data-tests/introduction) (known from search-result summaries)
7. [dbt_artifacts — Brooklyn Data, via PopSQL tutorial](https://popsql.com/learn-dbt/dbt-artifacts) (known from search-result summaries)
8. [on-run-end hooks — Elementary docs](https://docs.elementary-data.com/dbt/on-run-end_hooks) (known from search-result summaries)
9. [Create independent tasks for on-run-start and on-run-end — astronomer-cosmos issue #1443, GitHub](https://github.com/astronomer/astronomer-cosmos/issues/1443) (read directly; open as of 2026-10-09)
