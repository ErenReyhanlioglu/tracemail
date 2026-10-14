# ADR-0043: Phase 1 Exit — 48 Hours of Uninterrupted Hourly Runs, LinkedIn History after `v0.1.0`

**Date:** 2026-10-14
**Status:** Accepted

## Context

ADR-0002 tags `v0.1.0` when the core phase is complete, and the roadmap's
step 1.12 ends Phase 1 when "hourly runs succeed in production for a
sustained period", without saying how long. ADR-0002 asks for a measurable
criterion before `v1.0.0`; the same gap exists for `v0.1.0`.

Step 1.6 (LinkedIn history) is the only Phase 1 step not done. It waits for
the owner's LinkedIn data archive and changes nothing in the hourly
pipeline that runs today: it adds a one-off load of past applications
through the same raw → parsed → landing path.

State on 2026-10-13 23:35 UTC, from `ops.pipeline_runs` in prod: prod has
run hourly since the 2026-10-12 15:00 interval; the last failed step record
is the first prod dbt build at 2026-10-12 16:33 (fixed by its own retry);
no hourly interval has been missed since.

## Decision

1. **Exit criterion.** Phase 1 exits after **48 consecutive hourly data
   intervals in production**, each with a successful scheduled ingestion run,
   and **no failed step record** (any job in `ops.pipeline_runs`) in that
   time. It is measured from `ops.pipeline_runs`, the same records the
   health panel will use.
2. **`v0.1.0` without LinkedIn history.** The tag is cut once the criterion
   holds, with step 1.6 still open. Step 1.6 follows as its own pull request
   when the archive arrives; it is a fix-level addition, so it gets a patch
   tag (`v0.1.1`) per ADR-0002, and its release note says whether a replay
   from raw is needed.

## Rationale

1. **Wait for step 1.6.** Rejected by the owner: the release would wait on an
   external download while the running system is complete without it.
2. **A longer window (for example 7 days).** Rejected by the owner: 48 hours
   covers two full daily cycles, including the daily full-window run of
   ADR-0022, and the hourly pipeline has already run since 2026-10-12.
3. **"Sustained period" without a number.** Rejected: "done" would be a
   judgment, not a check.

## Consequences

**Positive:**

- The phase exit is a query result anyone can repeat.
- With the streak that started at the 2026-10-12 17:00 interval, the
  criterion is met at the earliest when the 2026-10-14 16:00 interval's run
  succeeds (about 17:00 UTC), if nothing fails before.

**Negative / trade-offs:**

- `v0.1.0` does not contain historical applications from before the mailbox
  was read; the application list starts with mail-derived applications
  until step 1.6 lands.
- 48 hours is a short window; `v1.0.0` keeps ADR-0002's requirement of a
  longer, measurable criterion.
