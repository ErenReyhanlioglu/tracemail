# ADR-0022: dbt Builds Only When Landing Changes

**Date:** 2026-10-09
**Status:** Proposed — accept with measured numbers during step 1.5

## Context

Step 1.5 adds dbt models on BigQuery. Every model build and every data test is
a separate BigQuery query, and the ingestion DAG runs hourly (ADR-0008). How
often dbt runs therefore sets most of the project's BigQuery query cost.

Verified from official documentation (2026-10-09):

- On-demand queries: the first 1 TiB processed per month is free, then
  USD 6.25 per TiB. Storage: the first 10 GiB per month is free [1].
- "Charges are rounded up to the nearest MB, with a minimum 10 MB data
  processed per table referenced by the query, and with a minimum 10 MB data
  processed per query." Queries that return an error or are answered from the
  cache are not charged [1]. Batch loads, copies, exports, and deletes are
  free [1].
- `CREATE TABLE ... AS SELECT` (a dbt table model) is billed for the bytes its
  `SELECT` reads; `CREATE VIEW` processes no bytes [2].
- Results are not cached when the query writes to a destination table, when a
  referenced table has changed, or when the query uses a non-deterministic
  function such as `CURRENT_DATE`. The cache is per user and lives about
  24 hours [3].

This matches the 10 MB billed per query observed in step 1.4 (ADR-0019), which
is now confirmed rather than only observed.

**Not yet verified:**

- Whether the 10 MB minimum also applies to `CREATE VIEW`, which processes
  no bytes.
- Whether hourly partition replaces in `landing` (ADR-0019) count as a table
  change even when the content is identical. If they do, unchanged hours
  cannot be answered from the cache.

**Estimate, not a measurement.** Assumptions: about 20 models, each reading
two tables on average (about 20 MB billed each), and about 50 tests (about
10 MB each), so about 0.9 GB billed per build. Per ADR-0021, about 8 mails
arrive a day and roughly two thirds of hourly runs find no new mail.

| Option | Product behavior | Builds a month | Estimated per month | Share of free tier |
|---|---|---|---|---|
| A. Build every hour | Everything refreshed hourly | 720 | ~650 GB | ~63% |
| B. Build only when landing changed, plus one daily build | New mail still visible within an hour | ~270 | ~240 GB | ~24% |
| C. Build a few times a day | New mail can wait hours; breaks ADR-0008 | 60–120 | ~55–110 GB | ~5–11% |

Health-panel queries, LLM call logs (Phase 2), and the monitoring models of
ADR-0023 come on top of these numbers.

**Measured 2026-10-09 (first build, staging layer only).** `dbt build` of 4
staging views and 29 data tests over 90 days of data, read from
`run_results.json` and confirmed against BigQuery job metadata:

- `CREATE VIEW` billed **0 bytes**: the 10 MB minimum does not apply to it.
- 25 tests billed **10 MiB** each (the minimum; the data is far smaller).
- 4 `not_null` tests on the partition column `received_date` billed **0
  bytes**: BigQuery answered them from metadata.
- Total **262 MB per build** (0.26 GB). Under option B (about 270 builds a
  month) that is about 71 GB a month for staging alone, about 7% of the free
  tier. Intermediate and mart models and their tests add to this; the full
  build is measured when they exist.

**Measured 2026-10-09 (full build: 13 models, 1 seed, 70 tests).** **1.03 GB
billed per build** (models 115 MB, tests 912 MB — tests are 89% of the cost,
almost all at the 10 MiB minimum, 20 MiB when a test reads two tables). The
incremental `MERGE` of `fct_application_events` billed 20 MiB. Under option
B (about 270 builds a month) this is about 277 GB a month, about 27% of the
free tier; building every hour (option A) would be about 740 GB, about 72%.
The estimate of 0.9 GB per build above was close.

## Decision

Option B, extending the dirty-partition signal proposed in ADR-0021:

- A run builds dbt only if its load step replaced at least one `landing`
  partition with new data (a dirty day). Runs without new mail skip parsing,
  loading, and dbt alike.
- Once a day the full window is processed without change detection,
  including a dbt build. Manual backfills always build.
- **No value that depends on today's date is stored in a model.** Marts store
  dates and timestamps (for example, the date of an application's last
  event). Values such as "days without progress" or "follow-up suggested" are
  computed at read time, in a view or in the API. A stored model that used
  `CURRENT_DATE` would go stale between builds and would give a different
  result when the same data is rebuilt, breaking idempotency.
- Incremental models are used where the data-modeling competency needs one,
  not by default: on BigQuery an incremental build runs several statements,
  each subject to the 10 MB minimum, so at this volume it is expected to cost
  more than a full table rebuild. That expectation is measured and recorded
  here.
- Every build reports its billed bytes (ADR-0023), so the estimate above is
  replaced by measured numbers.

The gate itself (skip dbt when nothing is dirty) is implemented in step 1.7
together with ADR-0021. In step 1.5, dbt runs manually and the per-build cost
is measured.

## Rationale

Alternatives considered:

1. **Option A, build every hour.** Rejected: uses most of the free tier
   rebuilding unchanged data, and leaves little room for the health panel
   and Phase 2.
2. **Option C, fixed lower frequency.** Rejected: delays new mail by hours and
   changes the behavior chosen in ADR-0008.
3. **Views everywhere, no tables.** Rejected as a general rule: a view costs
   nothing to create, but every read pays for the whole chain beneath it,
   and the API would pay that on every cache miss. Views are used where a
   value must be computed at read time (see Decision).

## Consequences

**Positive:**

- One "what changed" signal keeps both the GCS (ADR-0021) and BigQuery free
  tiers in reach.
- Product behavior is unchanged: new mail is visible within an hour.
- Date-dependent values stay correct between builds, and models stay
  reproducible.

**Negative / trade-offs:**

- A run that dies after loading but before dbt leaves marts behind `landing`
  until the next dirty run or the daily build (at most 24 hours).
- Read-time views with `CURRENT_DATE` are never answered from the BigQuery
  cache; the API's own cache keyed to the latest run id (CLAUDE.md, API)
  limits how often they are queried.

**Revisit** if measured monthly query usage exceeds half of the free tier.

## References

1. [BigQuery pricing — Google Cloud](https://cloud.google.com/bigquery/pricing) (too long for the fetch tool; downloaded and the cited sentences read directly)
2. [Data definition language (DDL) statements — BigQuery docs](https://docs.cloud.google.com/bigquery/docs/data-definition-language) (section "On-demand query size calculation"; downloaded and read directly)
3. [Using cached query results — BigQuery docs](https://docs.cloud.google.com/bigquery/docs/cached-results)
