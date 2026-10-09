# ADR-0027: Open Applications Close without Reply after 30 Silent Days

**Date:** 2026-10-09
**Status:** Accepted

## Context

ADR-0024 defined the silence indicator: an open application (applied or in
progress) with no event for 10 days shows "no reply for N days", which is
also the follow-up suggestion. On the first full build (2026-10-09, 90 days
of mail), 46 of 53 applications were silent, many for two to three months.
A follow-up suggestion for an application silent for 88 days is noise, and
46 suggestions hide the few that matter. Some outcomes never reach the
mailbox at all (for example, a phone call), so a silent application may
already be settled.

## Decision

- An open application with no event for `closed_after_days` (30) is
  **closed without reply**: it no longer shows the silence indicator or a
  follow-up suggestion.
- Its stored status (`applied` / `in_progress`) is unchanged. "Closed
  without reply" is a read-time indicator next to the status, computed in
  the same view as the silence indicator (ADR-0022), so a late reply reopens
  the application automatically.
- The silence indicator covers 10 to 29 days without an event. Both
  thresholds are dbt variables.

## Rationale

Alternatives considered:

1. **Keep the indicator unbounded and let the UI sort and filter.**
   Rejected: every screen and metric would need the same filter, and the
   follow-up count would stay meaningless.
2. **A fourth stored status ("closed").** Rejected: the status would have to
   be rewritten on a schedule and depend on today's date, which ADR-0022
   rules out for stored values; and a reply after 30 days would need the
   status to change back.

## Consequences

**Positive:**

- Follow-up suggestions are limited to applications where a follow-up is
  still timely.
- No stored value depends on the date of the build.

**Negative / trade-offs:**

- An employer that answers after 30 days is shown as closed until that
  answer arrives.
- Outcomes outside the mailbox (calls, in-person) still cannot be recorded
  before Phase 4's manual events.
