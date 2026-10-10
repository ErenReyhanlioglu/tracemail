# ADR-0030: Keeping Class A Headroom as Mail Volume Grows

**Date:** 2026-10-10
**Status:** Proposed — decide when the trigger below is reached

## Context

With dirty-day gating in place (ADR-0021), 20 measured hourly runs projected
to about **3,800 Class A operations a month, 76% of the 5,000 free** (ADR-0021,
"Measured"). The projection rests on one day with about 9 hours of new mail.
More mail means more hours that write raw objects and rewrite parsed files;
the owner expects up to about 100 cold applications a month, plus their
replies. The free tier would then be exceeded.

Verified on the official pricing pages (2026-10-10):

- Class A: `objects.insert` (every write) and `objects.list`. Class B:
  `objects.get` (reading an object or its metadata). Deleting is free [1].
- Operations returning 4xx or 5xx responses are generally not charged [1]:
  a metadata check for an object that does not exist (404) costs nothing,
  and a write rejected by the create-only precondition (412) costs nothing.
- Free tier: 5,000 Class A and 50,000 Class B operations a month, per billing
  account, shared by dev and prod, in `us-central1` among other US
  regions [2][3].
- Price beyond the free tier: USD 0.005 per 1,000 Class A, USD 0.0004 per
  1,000 Class B (Standard storage, single region) [1].

Where the projected 3,800 Class A operations come from (derived from the
measured runs, scaled to a month):

| Source | Per month | Share |
|---|---|---|
| Ingestion listings (2–3 per run, every run) | ~1,650 | ~43% |
| Parsed-zone rewrites (4 files per dirty day, 12 on the daily run) | ~1,440 | ~38% |
| Parsed-zone listings before parsing (1 per dirty day, 3 daily) | ~360 | ~9% |
| Raw writes (one per new mail) | ~300 | ~8% |

**Not yet known:** whether BigQuery load jobs that read `parsed/` add GCS
operations of their own. Google bills Cloud Storage retrieval and transfer
fees for BigQuery requests since 2025 [4] (page not readable; known from
search-result summaries); for Standard storage in the same region these are
expected to be read (Class B) operations, if any. The billing report, grouped
by SKU, answers it.

## Options

Each estimate is an expectation from the breakdown above, not a measurement.

1. **Existence checks instead of ingestion listings.** For each kept header,
   ask for the object's metadata (`objects.get`): a 404 for new mail is
   free, a 200 for stored mail is Class B. Saves about 1,650 Class A; adds
   about 18,000 Class B a month (about 25 stored messages in the window,
   checked every run), 36% of the Class B free tier. Step 1.2 moved from
   checks to listings for speed; the checks can run concurrently.
2. **Skip rewriting unchanged parsed files.** Before writing a day's file,
   compare its MD5 with the stored object's (`objects.get` metadata, Class B)
   and skip identical files. Most rewrites are unchanged: on dirty runs the
   actions and updates files rarely change, and the daily run rewrites three
   days that mostly did not. Saves an estimated 800 of the 1,440. ADR-0018's
   partition overwrite is unchanged in effect: the stored file always equals
   what the parser produced.
3. **Pass ingestion's key list to parsing.** Parsing then does not list the
   raw prefix again (ADR-0021 already allows it). Saves about 360.
4. **Fewer parsed files per day** (one file with a record-type field instead
   of four). Saves about 1,080, but supersedes ADR-0018's layout, and each
   landing table loads from its own file today (ADR-0019), so loading would
   need a different design. Not recommended.
5. **Run every two hours.** Halves listings, but new mail can wait up to two
   hours, which changes ADR-0008.
6. **Accept the overage.** At USD 0.005 per 1,000, even 5,000 operations
   over the free tier cost USD 0.025 a month. The project's stated goal is to
   stay within the free tier, so this is the fallback, not the plan.

Options 1 to 3 combined would bring the projection from about 3,800 to about
1,000 Class A a month.

## Decision

Pending. **Trigger:** the project-wide 85% rule (CLAUDE.md, set by the
owner on 2026-10-10): when the projected Class A use for a month
(month-to-date operations from `ops.pipeline_runs`, extrapolated) exceeds
4,250 (85% of the free tier), an option below must be implemented. The
current projection (76%) leaves about 9 points before that. Until then, measure; the health panel's run records already carry
every step's operation counts. The expected order of work is option 2 (no
behavior change, largest saving per line of code), then option 1, then
option 3.

## Consequences

To be written with the decision. Any option must keep ADR-0021's guarantees:
idempotent runs, full backfills, and the daily full-window repair.

## References

1. [Cloud Storage pricing — Google Cloud](https://cloud.google.com/storage/pricing) (downloaded and read directly: operation classes, 4xx/5xx note, prices)
2. [Free cloud features — Google Cloud docs](https://docs.cloud.google.com/free/docs/free-cloud-features) (read directly: Cloud Storage free tier)
3. [ADR-0010: Separate GCP Projects for Dev and Prod](0010-separate-gcp-projects-for-dev-and-prod.md) (free tier per billing account)
4. [Cloud Storage retrieval and data transfer fees will apply to BigQuery requests — Google Cloud](https://cloud.google.com/resources/storage/billing-fix-bigquery) (not readable; known from search-result summaries)
