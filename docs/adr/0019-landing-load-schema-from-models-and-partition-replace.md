# ADR-0019: Landing Load — Schema from Models, Tables Created by the Loader, Partition Replace

**Date:** 2026-10-08
**Status:** Accepted

## Context

Step 1.4 loads the `parsed/` zone (ADR-0018) into BigQuery `landing` tables.
Three questions: where table schemas come from, who creates datasets and
tables, and how a day is reloaded idempotently.

Verified constraints:

- Batch load jobs from Cloud Storage use a shared slot pool at no charge
  (ADR-0006) [1].
- Load jobs per table per day: 1,500 by default; a column-partitioned table
  allows 30,000 partition modifications per day, and a single job may modify
  up to 4,000 partitions [2][3]. (Read from search-result summaries; the
  quotas page was too long to read in full.)
- The maximum number of partitions per table is reported as 4,000 by one
  secondary source [4] and as raised to 10,000 by another; neither is
  confirmed on the official page. Either is far beyond this project's needs.

Expected usage: hourly runs reload a three-day window, three tables, one load
job per day per table — about 72 load jobs and 72 partition modifications per
table per day, far below the limits.

## Decision

This ADR applies to the `landing` tables. Tables in `ops` are append-only by
design (ADR-0020).

- **Schema from the Pydantic record models.** The BigQuery schema of each
  `landing` table is generated from its record model (`JobPostingSighting`,
  `JobAction`, `MessageParseOutcome`): one source of truth, so a model change
  is a table change. Load jobs use this explicit schema, never autodetect.
  The type mapping is explicit (`str`, `int`, `float`, `bool`, `date`,
  `datetime` → `TIMESTAMP`, enums → `STRING`, `list[T]` → `REPEATED`,
  `dict` → `JSON`); any other type, including nested models, raises an error
  instead of guessing.
- **All scalar columns are NULLABLE.** Required-ness is enforced by Pydantic
  when records are written and by dbt `not_null` tests when they are read.
  BigQuery `REQUIRED` columns would add nothing and would make some future
  changes harder.
- **The loader creates what it needs.** Before loading, the load step ensures
  the `landing` dataset (in `us-central1`, ADR-0011) and its tables exist,
  creating them if missing. The operation is idempotent, so dev and prod are
  set up by the same code with no manual step.
- **Partition replace.** Tables are partitioned by `received_date`, the UTC
  date of the source message — the same day boundary the raw and parsed zones
  use, so every row in a day's file belongs to the partition it is loaded
  into. Each load job targets one day's partition (`table$YYYYMMDD`) with
  `WRITE_TRUNCATE`. Reloading a day replaces exactly that day.
- **Empty days are emptied, missing days fail.** If a day's file has no rows,
  that day's partition is deleted explicitly afterwards, so stale rows cannot
  survive a re-parse that now yields nothing. If a day's file does not exist,
  the load fails: the day was never parsed.
- **Schema changes are additive, applied before loading.** The step that
  ensures a table compares its live schema with the generated one before any
  load: new columns are added, and any other difference (type or mode change,
  removed column) raises `SchemaChangeError`. Renaming or removing a field, or
  changing its type, needs a new ADR and a replay. A unit test compares the
  generated schemas with a committed snapshot, so a schema change is visible
  in code review; comparing with the live tables in CI waits for CI's GCP
  access (step 1.11).
- **No overlapping runs.** Hourly runs reload a three-day window, so two runs
  writing the same partitions at once could interleave. The ingestion DAG
  sets `max_active_runs=1` (step 1.7).

## Verified on dev (2026-10-08)

Eight days of parsed mail (2026-09-30..10-07) loaded into the three tables:
261 sightings, 14 actions, 62 parse outcomes; 4 empty `job_actions`
partitions were emptied explicitly.

- **Idempotency:** the same range was loaded three times; row counts and
  order-independent content fingerprints
  (`BIT_XOR(FARM_FINGERPRINT(TO_JSON_STRING(t)))`) were identical every time.
- **Speed:** 24 load jobs took 78.5 s when submitted one after another
  (72.9 s waiting on jobs) and 15.5 s with 8 concurrent jobs (10.6 s).
- **Query billing:** fingerprint queries processed 3–81 KB each but were
  billed 10 MB each — observed, not yet confirmed in BigQuery's pricing docs.
  At 1 TiB of free queries per month that still allows about 100,000 queries;
  health-panel query volume must be designed with this per-query floor in
  mind.

## Rationale

Alternatives considered:

1. **Schema autodetect.** Rejected: inferred types can differ between loads
   (for example, a field that is null on one day), which breaks later loads.
2. **Hand-written schema files.** Rejected: the same structure kept in two
   places drifts.
3. **Tables created by a separate setup script or IaC tool.** Rejected: a
   manual step that dev and prod can diverge on; an IaC tool is new
   infrastructure for three tables.
4. **Append, then deduplicate in dbt.** Rejected: duplicates exist in
   `landing` between runs, and every consumer must remember to deduplicate.

## Consequences

**Positive:**

- One definition per record type, from parser to warehouse.
- Rerunning or backfilling any range leaves identical tables.
- No manual BigQuery setup in either environment.

**Negative / trade-offs:**

- The load step needs permission to create datasets and tables in its
  project, broader than loading alone. Revisit when per-role service accounts
  are created (1.11).
- Breaking schema changes need explicit handling instead of happening
  silently.
- Narrowing the sender allowlist does not remove already-stored mail from
  `raw/`, `parsed/`, or `landing`; a re-parse re-reads it. Removing data
  after the fact needs an explicit purge procedure, not yet defined.
- Not yet verified: whether a `WRITE_TRUNCATE` load from an empty file
  empties the partition on its own. The explicit delete makes the outcome
  independent of that.

## References

1. [Batch load data — BigQuery docs](https://docs.cloud.google.com/bigquery/docs/batch-loading-data)
2. [Quotas and limits — BigQuery docs](https://docs.cloud.google.com/bigquery/quotas) (page too long to read in full; values known from search-result summaries)
3. [Troubleshoot quota and limit errors — BigQuery docs](https://docs.cloud.google.com/bigquery/docs/troubleshoot-quotas) (known from search-result summaries)
4. [Partitioning in BigQuery — Hevo Data](https://docs.hevodata.com/destinations/data-warehouses/google-bigquery/partitioning-in-bigquery/) (known from search-result summaries)
