# ADR-0017: Every Step Measures Its Time, Volume, Operations, and Cost

**Date:** 2026-10-07
**Status:** Accepted

## Context

The first real mail ingestion run (step 1.2) processed 114 messages and took
several minutes, but nothing recorded how long it took or which part was slow.
A proposed optimization (fetching headers in one batch instead of one command
per message) could only be justified by intuition.

The owner requires that the system be improvable over time, which needs
measurements, and that the cost of everything the system does be known. The
health panel already plans to show run history, parse rates, and LLM cost;
this decision makes measurement a property of every step rather than a few
selected metrics.

## Decision

**Every pipeline step returns a result model that reports:**

- **Time:** wall-clock duration of the step, measured with a monotonic clock
  (`time.perf_counter`). Measuring a duration is not reading the time window
  from the wall clock, which stays forbidden (CLAUDE.md, Airflow).
- **Volume:** records seen, processed, skipped or rejected, failed; bytes
  written.
- **External operations:** counts per service — IMAP commands, GCS reads and
  writes, BigQuery bytes processed and billed (from the job's own statistics),
  LLM tokens (Phase 2, already required by `ops.llm_calls`).

**Where the numbers go:**

- Logged at INFO when the step finishes, both locally and in production.
- Written with the run record to the `ops` dataset (from step 1.4), so dbt
  can summarize them and the health panel can show them.

**Cost:**

- Estimated cost is derived from operation counts multiplied by unit prices.
  Unit prices live in one versioned configuration file, each with its source
  URL and the date it was checked; they are researched, not recalled
  (CLAUDE.md, ADRs).
- Free-tier usage is shown alongside cost, since most usage is expected to
  stay inside it.

**Optimizations are measured before and after.** A claim that a change is
faster or cheaper is recorded with both measurements; an expected improvement
is labeled as an expectation until measured.

Metrics never contain personal data: counts, durations, bytes, and internal
ids only (CLAUDE.md, Privacy).

## First application (measured)

Mail ingestion for 2026-10-01..07 (114 messages listed, 52 rejected, 62
already stored), same mailbox and bucket, measured 2026-10-07:

| | Before | After |
|---|---|---|
| Total time | 55.3 s | 5.9 s |
| IMAP commands | 115 (one header FETCH per message) | 3 (batched header FETCH) |
| IMAP header time | 34.5 s | 0.7 s |
| GCS operations | 62 existence checks (Class B) | 8 prefix listings (Class A) |
| GCS time | 20.5 s | 5.0 s |

The before-run also showed that existence checks against the US bucket took
37% of the time — a bottleneck that intuition had not identified. Projected
monthly GCS usage for hourly production runs (estimate, from one week of
mail): about 2,200 Class A listings, inside the 5,000 Class A free tier [1].

## Rationale

Alternatives considered:

1. **Measure only selected metrics (run status, parse rate, LLM cost).**
   Rejected: the slow step found in 1.2 would have stayed invisible; cost
   outside the LLM (GCS operations, BigQuery scans) would be unknown.
2. **An external observability stack (Prometheus, Grafana, tracing).**
   Rejected: out of scope per SUMMARY.md; the `ops` tables already provide
   storage and the health panel provides display.
3. **Profile only when something feels slow.** Rejected: without a recorded
   baseline there is nothing to compare against.

## Consequences

**Positive:**

- Every slow or expensive step is visible in numbers, with history.
- Optimizations are justified by measurement, and the health panel can show
  real cost per run and per month.

**Negative / trade-offs:**

- Every step carries a little instrumentation code and its tests.
- Cost figures are estimates from counted operations and recorded prices; the
  billing report remains the source of truth and should be compared against
  them periodically.

## References

1. [Free cloud features and trial (Cloud Storage Class A / Class B free operations) — Google Cloud docs](https://docs.cloud.google.com/free/docs/free-cloud-features)
2. [Storage pricing (insert and list are Class A, get is Class B) — Google Cloud](https://cloud.google.com/storage/pricing) (page content truncated when fetched; known from search-result summaries)
