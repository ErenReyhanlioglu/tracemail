# ADR-0036: Dev and Prod Share One Free Tier

**Date:** 2026-10-12
**Status:** Accepted

## Context

Prod is deployed (step 1.11) but its DAG is still paused. Free-tier limits
are calculated per billing account [1], and the dev and prod projects share
one billing account (ADR-0010), so both draw on the same 5,000 Class A
operations a month. ADR-0030 measured the Class A use of one environment
running hourly and asked to revisit it here, when prod starts.

Measured 2026-10-12 in dev, from two sources:

- **Cloud Monitoring** (`storage.googleapis.com/api/request_count`, every
  caller, grouped by method and response code): 1,619 successful
  `WriteObject` and 951 `ListObjects` requests from 1 October to the end of
  11 October, **2,570 Class A**. Only 2 writes were rejected by the
  create-only precondition. Prod's bucket had 4 requests, all from setup.
- **The pipeline's run records** (`ops.pipeline_runs`, what
  `marts.fct_free_tier_usage` sums): 2,077 for the same period.

Day by day the two agree on scheduled runs alone (11 October: about 104 in
Monitoring, 103 recorded). The 493 missing from the run records are
development work: 180 on 7 October, before run records existed, and about
300 on 9 and 10 October from manual commands that write no run record. The
recorded steady-state rate is therefore sound, but the month-to-date base is
Monitoring's:

| | Class A |
|---|---|
| October so far (dev only, development and backfills included) | 2,570 (51%) |
| Rate of a day with scheduled runs only (dev, after ADR-0030 option 2) | about 103 a day |
| October projection, dev alone hourly | about 4,630 (93%) |

`ReadObject` (Class B) shows the same kind of gap at a larger scale: 7,265
in Monitoring against 1,736 recorded. Most of the difference is expected to
be BigQuery load jobs reading `parsed/` files, which ADR-0030 listed as not
yet known; Monitoring does not name the caller. It is 15% of the Class B
tier.

Expected, not measured:

- **Prod running hourly** reads the same mailbox with the same code, so it
  should match dev's rate: about 103 a day, about 3,100 a month (62%).
- **Prod's first backfill** (2026-07-10 to today, 92 days): about 725 raw
  writes, 368 parsed files (four record types per day), and listings, about
  1,300 Class A in total. Dev's backfill day (2026-10-09) measured 1,740, but
  that day re-parsed the range several times after parser changes.
- About 55 of dev's 103 daily operations are ingestion listings (ADR-0030's
  breakdown: about 1,650 of 3,040 a month).

With both environments hourly and the backfill run now, October reaches
about 8,000 (160%). The 85% rule (CLAUDE.md) applies before prod's runs are
added. BigQuery stays well inside its tier: dbt in dev projects 23% of the
1 TiB query allowance for October, so a second environment roughly doubles
it.

## Options

1. **Dev runs on demand.** Pause the dev DAG's schedule; dev runs only when
   code is being developed or tested (`just dag-test`, CLI commands). Saves
   about 3,100 Class A a month. No code change. Dev's run records, and with
   them the dev health views, stop updating between development sessions.
2. **Conditional writes without a listing.** Today ingestion lists each day
   of its window (2–3 listings a run, about 55 Class A a day) to fetch only
   new mail, then writes it with the create-only precondition
   (`if_generation_match=0`). Instead, fetch every kept message in the window
   and attempt the create-only write: a stored message is rejected with 412,
   and Google does not charge for operations that return 4xx [2]. This is
   the standard write-if-absent pattern (GCS generation preconditions; S3
   added the same with `If-None-Match`). Saves the same about 1,650 Class A
   a month as option 3 and adds no Class B; ingestion gets simpler (no
   existing-key step). Cost: every run downloads the bodies of all kept
   messages in its window over IMAP (about 25, a few hundred KB) instead of
   only new ones, and makes one rejected upload per stored message; run time
   to be measured. Raw stays write-once: the precondition was already the
   guarantee, the listing only an optimization.
3. **Existence checks instead of ingestion listings** (ADR-0030 option 1).
   Saves the same as option 2, for about 18,000 Class B a month (36% of that
   tier). Dominated by option 2.
4. **Prod's backfill at the start of a month.** One-off work then has the
   whole month's allowance behind it instead of what is left of October.
5. **Accept the overage.** USD 0.005 per 1,000 Class A [2]: 2,500
   operations over cost about USD 0.0125. ADR-0030 keeps this as the
   fallback, since the project's goal is to stay within the free tier.

Considered and not pursued: push notifications from the Gmail API through
Pub/Sub, which remove polling altogether but were rejected for other reasons
in ADR-0008; a local cache or manifest of stored keys, which adds the state
ADR-0007 rules out; running less often, which changes ADR-0008's product
behavior.

Projections (Class A, expected; from 2,570 used and prod hourly from
12 October, about 20 days; option 2 assumed deployed after about 2 days):

| Combination | October | November | Later months |
|---|---|---|---|
| 1, backfill now | about 5,930 (119%) | about 3,100 (62%) | 62% |
| 1, backfill on 1 November | about 4,630 (93%) | about 4,400 (88%) | 62% |
| 1 + 2 (or 3), backfill on 1 November | about 3,640 (73%) | about 2,740 (55%) | about 1,450 (29%) |

Only the last combination stays under 85% in every month. Dev hourly alone
would already end October at about 93%.

## Option 2, implemented and measured (2026-10-12)

`ingest_mail` no longer lists the raw zone. It downloads every kept message
in the window and calls the create-only write; a 412 counts as already
stored (`gcs_writes_rejected`, not billed). Exclusion still happens on
headers, before any body is downloaded. A message larger than the GCS
client's single-request upload size (8 MiB in google-cloud-storage 3.16) is
checked for existence first (`gcs_existence_checks`, Class B): a rejected
resumable upload is billed as one Class A operation on success [2], and its
billing on a 412 is not documented. Dev's raw zone holds no such message:
725 objects, mean 135 KB, largest 0.77 MB. Tests lock that a stored message
is never replaced even when the fetched bytes differ, that nothing is listed,
and that excluded mail is never downloaded.

Bodies are fetched in one IMAP command per batch of 20 (as headers already
are, ADR-0017), each body matched to its message by the UID in its response
line; a requested message missing from the response fails the run, as a
single fetch did. Uploads within a batch run 8 at a time (as parsing reads
do); workers return their outcome and the run counts them in one thread.
A test stores more than two batches and checks every body under its own key.

Measured against dev, CLI runs over a three-day window like a scheduled
run's (Windows laptop, 2026-10-12):

| | Before (scheduled runs, ADR-0030) | After, one by one | After, batched and concurrent |
|---|---|---|---|
| Class A per run | 2–3 listings plus new writes | new writes only (0 here) | new writes only (0 here) |
| Messages kept / already stored | — | 29 / 29, rejected with 412 | 29 / 29, rejected with 412 |
| IMAP commands | 2 plus one per new message | 31 | 4 |
| IMAP download | new mail only | 2.4 MB | 2.4 MB |
| Duration | mean 2.3 s | 27.3 s | 10.5 s (4.2 s IMAP bodies, 5.2 s uploads) |

Cloud Monitoring recorded the first run's 29 writes as `FAILED_PRECONDITION`
with no successful write: the stored objects were not touched. The VM's
duration is expected to be shorter (faster network than a home connection)
and is read from prod's run records after deployment. At 24 runs a day the
extra IMAP download is about 60 MB, within Gmail's 2,500 MB daily IMAP
limit [5] (a Google Workspace figure; not confirmed for consumer accounts).

The size check for this decision was itself a lesson: a recursive
`gcloud storage ls` lists each date partition separately, about 96 Class A
operations rather than one.

## Decision

Decided by the owner on 2026-10-12 and 2026-10-13:

- **Option 1: dev runs on demand.** The local stack is stopped when no code
  is being worked on; prod is the only environment running hourly.
- **Option 2: conditional writes without a listing**, batched and
  concurrent, as described above.
- **Prod's backfill runs in full now, as a one-off exception to the 85%
  rule**, after option 2 is deployed so the backfill makes no listings
  either. Expected October total, from what was used by 12 October (about
  2,670, including about 96 for the size check above): about 2,670 + 910
  (prod hourly for 19 days, about 48 a day) + 1,200 (backfill: about 725
  raw writes, 368 parsed files, 92 parse listings) = about 4,800 (96%).
  Anything above the free tier is billed postpay at USD 0.005 per 1,000 [2],
  a fraction of a cent. The owner chose a complete history in prod now over
  a two-part backfill that kept every month under 85%.

Cost is read from Cloud Monitoring at the end of October and recorded here.

## Consequences

**Positive:**

- From November, Class A use is expected at about 29% a month instead of
  about 124% with both environments hourly: headroom for parser replays,
  growing mail volume, and the LinkedIn history (step 1.6).
- Ingestion is simpler: no existing-key step, and raw immutability rests on
  one mechanism, the create-only precondition, which tests and Monitoring
  confirmed.

**Negative / trade-offs:**

- Each ingestion run downloads every kept message in its window (about
  60 MB a day over IMAP) and makes one rejected upload per stored message;
  a run takes about 10 s instead of 2 s (measured on a laptop).
- Dev's health views no longer update between development sessions.
- October exceeds the 85% rule once, by the owner's choice; the run records
  undercount manual work, so the month-end figure comes from Monitoring.
- Revisit if a message larger than 8 MiB appears often (each run then makes
  a Class B existence check for it) or if Gmail's IMAP limits tighten.

## References

1. [Free cloud features and trial — Google Cloud docs](https://docs.cloud.google.com/free/docs/free-cloud-features) (read 2026-10-12: "monthly usage limits that are calculated per billing account"; Cloud Storage 5,000 Class A and 50,000 Class B a month in `us-central1`; BigQuery 1 TiB of querying a month)
2. [Cloud Storage pricing — Google Cloud](https://cloud.google.com/storage/pricing) (downloaded and read 2026-10-12: "Generally, you are not charged for operations that return 307, 4xx, or 5xx responses", the exception being 404s from buckets with a website configuration; Class A price as read for ADR-0030)
3. [ADR-0010: Separate GCP Projects for Dev and Prod](0010-separate-gcp-projects-for-dev-and-prod.md)
4. [ADR-0030: Keeping Class A Headroom as Mail Volume Grows](0030-gcs-class-a-headroom.md)
5. [Gmail bandwidth limits — Google Workspace Admin Help](https://knowledge.workspace.google.com/admin/gmail/gmail-bandwidth-limits) (known from search-result summaries: IMAP download 2,500 MB a day)
