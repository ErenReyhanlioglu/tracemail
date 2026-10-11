# ADR-0030: Keeping Class A Headroom as Mail Volume Grows

**Date:** 2026-10-10
**Status:** Accepted — option 2 implemented; option 1 deferred; option 3 rejected

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

**2026-10-10: deferred by the owner while clean data is collected.** The
`fct_free_tier_usage` view projected October above 85%, but the month so far
includes about 1,730 Class A operations from one-off 90-day backfills on
2026-10-09, and its 24-hour rate window still contains development test runs.
Carrying the measured steady-state rate (about 127 Class A a day, ADR-0021)
over the rest of the month gives about 4,590 for October (about 92%, under
the 100% free tier) and about 3,800 for a month without backfills (76%). The
owner chose to keep the hourly schedule running unchanged for several days
and decide on scheduled-run data only; the 85% rule applies once that
projection is clean.

**2026-10-11: decided.** Measured on scheduled runs only (2026-10-10 20:00
to 2026-10-11 14:00 UTC, about 18 hours, no manual work in the window):

| Step | Runs | Class A | Class B | Mean duration |
|---|---|---|---|---|
| `ingest_mail` | 18 | 41 (37 lists, 4 writes) | 0 | 2.3 s |
| `parse_mail` | 5 | 35 (7 lists, 28 writes) | 19 | 4.7 s |

That is about 101 Class A a day, about 3,040 a month (61%). The window is a
quiet night with 4 new messages; a day like 2026-10-10 (9 messages) writes
more, so the steady state is expected between about 61% and 76%. October
as a whole, with the backfills already spent (2,038 by 2026-10-11), projects
to about 4,100 (82%). An earlier estimate of 94% in conversation included
development runs and was wrong; the 85% rule is not strictly reached.

The owner chose to implement **option 2** anyway, for headroom as mail
volume grows (cold applications and replies) and for future replays after
parser changes, which spend the same allowance.

- **Option 2: implemented.** `GcsParsedStore` reads the stored object's
  metadata and skips the write when its MD5 equals the new content's. A
  missing object is a free 404 and is written. Parse results record
  `gcs_metadata_reads` (Class B) and `parsed_unchanged`; `gcs_writes`
  counts only real writes, and `fct_free_tier_usage` adds the metadata
  reads to Class B. Verified 2026-10-11 against dev GCS: re-parsing
  2026-10-10 wrote nothing (4 of 4 files unchanged, 4 metadata reads),
  which also confirms the stored files equal the current parser's output.
- **Option 1: deferred.** It trades about 18,000 Class B a month for the
  listings; revisit if the measured projection approaches 85% again.
- **Option 3: rejected.** Parsing a day must read every raw object of that
  day, because raw is the source of truth. Ingestion's key list reflects
  the mailbox at fetch time; a message later deleted from the mailbox would
  silently drop out of the parsed file.

**After** (to be measured on scheduled runs from 2026-10-11 14:00 UTC, with
the same query as the table above): pending.

## Consequences

**Positive:**

- Writes are spent only on content that changed; the parsed zone still
  equals the parser's output (ADR-0018), and ADR-0021's guarantees hold:
  idempotent runs, full backfills, the daily full-window repair.
- Replays after a parser change rewrite only the days whose output changed.

**Negative / trade-offs:**

- Each write now costs a metadata read first (Class B, well within its free
  tier) and a little latency (measured: four sequential reads took 1.9 s
  locally, about what four writes took before).
- Revisit option 1 when the projection approaches 85% again, and in step
  1.11, when prod starts sharing the billing account's free tier.

## References

1. [Cloud Storage pricing — Google Cloud](https://cloud.google.com/storage/pricing) (downloaded and read directly: operation classes, 4xx/5xx note, prices)
2. [Free cloud features — Google Cloud docs](https://docs.cloud.google.com/free/docs/free-cloud-features) (read directly: Cloud Storage free tier)
3. [ADR-0010: Separate GCP Projects for Dev and Prod](0010-separate-gcp-projects-for-dev-and-prod.md) (free tier per billing account)
4. [Cloud Storage retrieval and data transfer fees will apply to BigQuery requests — Google Cloud](https://cloud.google.com/resources/storage/billing-fix-bigquery) (not readable; known from search-result summaries)
