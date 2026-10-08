# ADR-0020: Run Records Follow Established Observability Frameworks

**Date:** 2026-10-08
**Status:** Accepted

## Context

ADR-0017 requires every pipeline step to report its time, volume, operations,
and cost, and to write them with a run record to the `ops` dataset from step
1.4. The record's shape was open. Rather than invent one, the fields are
aligned with three established frameworks:

- **Data observability's five pillars:** freshness, volume, schema,
  distribution, lineage [1][2][3].
- **Google SRE for data pipelines:** freshness SLOs ("the oldest data is no
  older than Y", "the job completed successfully within Y") and correctness
  measured against golden data [4]; secondary sources add coverage, the share
  of records that should have been processed that were [5]. The four golden
  signals (latency, traffic, errors, saturation) frame per-run health [6].
- **OpenLineage:** each run has a run id, a job name, a terminal state
  (COMPLETE / FAIL / ABORT), and input and output datasets [7].

These frameworks come with products (commercial observability services,
OpenLineage backends such as Marquez, Prometheus with Grafana). A separate
observability stack is out of scope (SUMMARY.md), so only the concepts and
field names are adopted.

## Decision

**`ops.pipeline_runs`, one row per step execution, append-only:**

| Field | Measures | Framework |
|---|---|---|
| `run_id`, `job_name`, `status` (`COMPLETE` / `FAIL`) | Which step ran, and its outcome | OpenLineage; errors |
| `inputs`, `outputs` (e.g. `gcs:raw/mail` → `bq:landing.job_actions`) | Where data came from and went | Lineage |
| `interval_start`, `interval_end` | The data interval processed | — |
| `started_at`, `finished_at`, `duration_seconds` | How long it took | Latency |
| `records_in`, `records_out`, `records_failed` | How much data arrived, was processed, failed | Volume; coverage; errors |
| `bytes_in`, `bytes_out` | Data size | Volume |
| `schema_version` | Whether record structure changed | Schema |
| `code_version` | Which build ran (commit SHA once deployed, ADR-0002) | — |
| `error_type`, `error_message` | Why a run failed (see privacy below) | Errors |
| `metrics` (BigQuery `JSON` type) | The step's full result model (ADR-0017) | — |

Tables in `ops` are **append-only by design**: every execution is its own
event, so reloading a day twice leaves two run records. That is what lets the
health panel count runs per hour. (Partition replace, ADR-0019, applies to
`landing` only.)

**How rows are written.** Each record is appended with a batch **load job**
(`load_table_from_json`, `WRITE_APPEND`), the same free mechanism as ADR-0019.
Streaming inserts (`insert_rows_json`) are not used: they are billed per row
and keep rows in a streaming buffer.

**Partitioning and retention.** The table is partitioned by the day of
`started_at`, so panel queries scan only recent days, and partitions expire
after a configured number of days (`TRACEMAIL_OPS_RETENTION_DAYS`).

**Privacy of error fields.** Exception messages can quote their input (a
subject line, an address). `error_message` is scrubbed before writing — e-mail
addresses, URLs, and quoted values are replaced and the text is truncated —
and a test verifies it. The public health-panel API never returns
`error_message`; it may show `error_type` and counts only.

**Runs that leave no record.** A run killed mid-way, or one that fails because
BigQuery itself is unreachable, writes no row. Missing records are therefore a
signal in their own right: the expected number of runs (one per hour) minus
the recorded number is reported as missed runs, alongside the time since the
last successful run.

`started_at` / `finished_at` read the wall clock; that is recording when
something happened, not choosing which data to process (CLAUDE.md).

**Derived in dbt (step 1.5), not stored per run:**

- **Freshness:** time since the last successful run, and age of the newest
  received message.
- **Missed runs:** expected runs minus recorded runs per period.
- **Coverage:** parsed messages as a share of claimed messages, per template.
- **Volume anomalies:** a run's record counts against recent history (catches
  a silently broken mailbox connection).
- **Distribution:** failure and unrecognized-line rates per template, from
  `message_parse_outcomes`.
- **Correctness:** parser fixture tests and dbt test results (stored from
  step 1.5).

**Not measured:** saturation. At this scale there is no capacity to saturate;
its only analogue is monthly LLM budget use in Phase 2.

## Rationale

Alternatives considered:

1. **A home-grown record shape.** Rejected: established vocabulary makes the
   records self-explanatory and easier to export later.
2. **Deploy the frameworks' products** (an observability service, Marquez,
   Prometheus and Grafana). Rejected: out of scope, more long-running
   services on one free VM, and paid tiers for commercial services.
3. **Read run history from Airflow's metadata database.** Rejected (already in
   CLAUDE.md): it covers only Airflow runs, lives on the VM, and has none of
   the step metrics.

## Consequences

**Positive:**

- Each health-panel metric maps to a named concept and a concrete field.
- Records could be exported to OpenLineage-compatible tools without
  restructuring.

**Negative / trade-offs:**

- `metrics` as JSON is flexible but has no fixed columns; dbt extracts the
  fields the panel needs.
- A run record is lost if BigQuery is unreachable at write time; writing the
  record to Cloud Storage first would survive that, but not a killed process,
  so the missed-runs signal is preferred over the extra step.

## References

1. [What Is Data Observability? 5 Key Pillars — Monte Carlo](https://montecarlo.ai/blog-what-is-data-observability) (known from search-result summaries)
2. [What Is Data Observability? 5 Pillars — Soda](https://soda.io/blog/data-observability-five-pillars) (known from search-result summaries)
3. [What is Data Observability? — Databricks](https://www.databricks.com/blog/what-is-data-observability) (known from search-result summaries)
4. [Data Processing Pipelines — Google SRE Workbook](https://sre.google/workbook/data-processing/)
5. [Fresh, Complete, Correct: Setting SLOs for Data Pipelines — SLO Education Hub](https://slo-education.com.au/blog/2026-08-31-fresh-complete-correct-setting-slos-for-data-pipelines) (known from search-result summaries)
6. [Monitoring Distributed Systems — Google SRE Book](https://sre.google/sre-book/monitoring-distributed-systems/) (known from search-result summaries)
7. [OpenLineage spec — GitHub](https://github.com/OpenLineage/OpenLineage/blob/main/spec/OpenLineage.md) (known from search-result summaries)
