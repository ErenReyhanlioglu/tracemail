# ADR-0007: Date-Window Ingestion and a Read-Only Mailbox

**Date:** 2026-10-03
**Status:** Accepted (not yet implemented)

## Context

Each run must fetch only new mail, never process the same mail twice, and
support backfill of any past period. The first draft of CLAUDE.md used an IMAP
"last UID" bookmark. Two problems surfaced:

- A bookmark only moves forward; it cannot re-fetch a specific past period,
  so backfill of an arbitrary range is impossible.
- The bookmark is state that must be stored somewhere outside Airflow's
  metadata DB (pipeline code cannot read Airflow Variables, see ADR-0003).

Separately, the owner requires that the system leave the mailbox untouched:
mail read by the system must not appear as read in the owner's mail client.

## Decision

**Date window, no stored bookmark.** Each run fetches mail whose IMAP internal
date falls in its own data interval, widened by one day on each side for
timezone slack. Overlapping fetches are harmless: deterministic, write-once
raw keys turn re-fetched mail into no-ops.

**Read-only mailbox.** The mailbox is opened with `EXAMINE`
(`select(..., readonly=True)`) and messages are fetched with `BODY.PEEK[]`.
The system never sets or clears flags, moves, archives, or deletes mail. A
test enforces both settings.

## Rationale

Alternatives considered:

1. **UID bookmark (`UIDVALIDITY`, last UID).** Rejected: no arbitrary
   backfill, extra state to protect, and it contradicts the rule that tasks
   derive their time window from the data interval.
2. **Fetch with `BODY[]` and clear the `\Seen` flag afterwards.** Rejected:
   two writes to the mailbox instead of none, and a crash between them leaves
   mail marked as read.

## Consequences

**Positive:**

- Backfill of any period is a normal rerun of those intervals.
- No ingestion state to lose; a rebuilt VM resumes correctly.
- The owner's mailbox looks exactly as if the system did not exist, and a
  bug cannot damage it.

**Negative / trade-offs:**

- Each run re-lists mail from the widened window; already-stored mail is
  skipped. Negligible at this volume.
- `SINCE` / `BEFORE` semantics (day-granular, based on internal date) and the
  `EXAMINE` / `BODY.PEEK` behavior come from the IMAP standard [1]. They were
  stated from knowledge of the standard, not re-read during this decision;
  behavior against Gmail is to be verified with the first IMAP code.

## References

1. [RFC 3501 — Internet Message Access Protocol, Version 4rev1](https://www.rfc-editor.org/rfc/rfc3501)
