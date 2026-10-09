# ADR-0021: Keeping GCS Operations within the Free Tier under Hourly Runs

**Date:** 2026-10-08
**Status:** Proposed — decide before step 1.7 is done

## Context

ADR-0017 requires every step to report its external operations. Run records
from 2026-10-08 (dev, manual runs) show the GCS operations of one run over the
three-day window that hourly runs will use (ADR-0007, ADR-0008):

| Step | Operation | Class | Per run | Per month (720 runs) |
|---|---|---|---|---|
| Ingestion | List the 3 days' raw prefixes | A | 3 | 2,160 |
| Ingestion | Write new raw objects | A | ~0.3 (≈8 mails a day) | ~240 |
| Parsing | List the 3 days' raw prefixes | A | 3 | 2,160 |
| Parsing | Rewrite `parsed/` (3 days × 3 record types) | A | 9 | 6,480 |
| Parsing | Read raw objects | B | ~25 | ~18,000 |
| **Total** | | **A** | **~15** | **~11,000** |

Free tier: 5,000 Class A and 50,000 Class B operations a month, per billing
account [1]. Listing and object writes are Class A; reads are Class B [2][3].
Class A operations cost roughly 10–20 times more than Class B [3][4].

The projection is an **estimate** built from measured per-run counts, not a
measured month. It exceeds the Class A free tier about twice over. In money
the overage is negligible (about USD 0.03 a month at USD 0.005 per 1,000
Class A operations [4]); the problem is the stated goal of staying within the
free tier, and the waste grows with the system.

**Root cause.** About 8 mails arrive a day; runs happen 24 times a day, so
roughly two thirds of runs find no new mail. Every run still lists the window,
re-parses it, and rewrites nine unchanged `parsed/` files. Two individually
sound decisions combine into this: the three-day safety window (ADR-0007) and
rewriting whole partitions (ADR-0018).

**Not yet known.** Whether BigQuery load jobs reading `parsed/` add GCS
operations to the bill; the per-run counts above include only operations made
by our code.

**Update 2026-10-09: four record types.** Parser version 3 added a fourth
record type (`application_updates`), so parsing now rewrites four `parsed/`
files per day instead of three. Measured in the 90-day backfill: 120 parsed
writes per 30 days parsed, 4 per day. The hourly projection above becomes 12
parsed writes per run (8,640 a month) and about 18 Class A operations per run,
about 13,000 a month — roughly 2.6 times the free tier instead of 2.2. The
same backfill measured about 7.8 stored mails a day (701 in 90 days, after
ADR-0025's exclusion list), close to the 8 assumed above. The option
estimates below assumed three record types; their parsed-write share grows by
a third and is recomputed when the decision is made in step 1.7. Every new
record type adds one write per parsed day, which favors options that skip
unchanged days.

## Findings from the literature

1. **Dirty-partition tracking** is the established pattern: each run processes
   only partitions that are new, changed, or deleted, and leaves the rest
   untouched (Kedro's incremental datasets, Ascend, Palantir) [5][6].
2. **The idempotency trap.** Incremental processing done wrong turns a batch
   pipeline into a stream that can no longer regenerate a specific partition
   [7]. The remedy is to keep partition overwrite and only choose *which*
   partitions to overwrite — whole-partition recomputation trades some extra
   compute for a predictable operational model [8].
3. **GCS cost guidance:** minimize listing, cache object metadata, and pass it
   between steps instead of listing again [3][9].
4. **Airflow 3:** a skipped producer task emits no asset event, so dependent
   work does not run; several updates before a consumer runs still trigger it
   once [10][11].

## Options

1. **Dirty-partition propagation** (recommended):
   1. Ingestion lists the window (needed for deduplication anyway), writes new
      raw objects, and returns the *dirty days* — days that got new objects —
      with each day's full key list.
   2. If there are no dirty days, parsing and loading are skipped.
   3. Parsing handles only dirty days, using the key lists from ingestion
      instead of listing again, and overwrites those days' partitions
      (ADR-0018 unchanged).
   4. Loading handles only dirty days.
   5. **Safety net:** once a day, the full three-day window is processed
      without change detection. A run that dies after writing raw objects but
      before parsing loses its dirty-day list; the daily run repairs that
      within 24 hours.
   6. Manual backfills always run in full, without change detection — this is
      what keeps the idempotency guarantee (finding 2).

   Product behavior is unchanged: new mail still appears within an hour.
   Estimated: 3 Class A operations for a run without new mail; ~3,400 a
   month (68% of the free tier).
2. **Option 1 plus existence checks instead of listings in ingestion:** one
   Class B existence check per allowed message, run concurrently, replaces the
   Class A listings. Estimated ~1,300 Class A (25%) and ~30,000 Class B (60%)
   a month. Step 1.2 moved from existence checks to listings for speed;
   running the checks concurrently may remove that cost.
3. **Narrower hourly window** (today and yesterday) with a separate daily
   three-day run. Effective, but two run types to maintain.
4. **Lower frequency** (every 2–3 hours). Simple, but changes the "visible
   within an hour" behavior chosen in ADR-0008.
5. **Accept the overage.** Cheapest to build; abandons the free-tier goal.

## Decision

Pending. Before deciding, during step 1.7: measure real hourly runs from run
records, read the billing report to confirm operation classes and whether
BigQuery loads add GCS operations, then compare options 1 and 2 by measured
time and operation counts. Record the choice here and set the status to
Accepted.

## Consequences

To be written with the decision. Whichever option is chosen, step 1.7 is not
done until hourly runs stay within the GCS free tier (roadmap).

## References

1. [Free cloud features and trial (Cloud Storage operations free tier, per billing account) — Google Cloud docs](https://docs.cloud.google.com/free/docs/free-cloud-features)
2. [Storage pricing — Google Cloud](https://cloud.google.com/storage/pricing) (page content truncated when fetched; operation classes known from search-result summaries)
3. [Google Cloud Storage Pricing 2026: Full Cost Breakdown — nOps](https://www.nops.io/blog/google-cloud-storage-pricing/) (known from search-result summaries)
4. [GCP Cloud Storage Pricing: Dimensions & Recommendations — CloudBolt](https://www.cloudbolt.io/gcp-cost-optimization/google-data-lake-pricing/) (known from search-result summaries)
5. [Partitioned and incremental datasets — Kedro docs](https://docs.kedro.org/en/stable/data/partitioned_and_incremental_datasets.html) (known from search-result summaries)
6. [Data Partitioning — Ascend](https://developer.ascend.io/docs/data-partitioning) (known from search-result summaries)
7. [DBT Incremental Strategy and Idempotency — Finatext Tech Blog](https://techblog.finatext.com/dbt-incremental-strategy-and-idempotency-877993f48448?gi=5941a24e3564) (known from search-result summaries)
8. [Incremental and Continuous Data Ingestion Strategies — Unstructured](https://unstructured.io/insights/incremental-data-ingestion-strategies-for-continuous-pipelines) (known from search-result summaries)
9. [Google Cloud Storage on a shoestring budget — Medium](https://medium.com/@duhroach/google-cloud-storage-on-a-shoestring-budget-55f054fad436) (known from search-result summaries)
10. [Asset-Aware Scheduling — Airflow 3.3.2 docs](https://airflow.apache.org/docs/apache-airflow/stable/authoring-and-scheduling/asset-scheduling.html)
11. [Apache Airflow 3.2.0: Data-Aware Workflows at Scale — Airflow blog](https://airflow.apache.org/blog/airflow-3.2.0/) (known from search-result summaries)
