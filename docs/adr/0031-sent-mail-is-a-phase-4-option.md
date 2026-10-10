# ADR-0031: Sent Mail Is Not Ingested; Direct Applications Are a Phase 4 Option

**Date:** 2026-10-10
**Status:** Accepted

## Context

Step 1.8 asks how sent mail enters ingestion. Some applications start with
mail the owner writes: a cold application or a reply to a recruiter. Those
messages sit in the mailbox's sent folder, which ingestion never reads; it
reads one configured folder (ADR-0007). An application started this way
appears in the system only when the company replies, and then only as
unclaimed "other" mail.

Verified 2026-10-10 with `list-mailboxes`: the account has a separate sent
folder, and its name is localized to the account language, not `Sent`.

Sent mail differs from the mail the parsers handle:

- It is free text written by the owner, with no template; rule-based
  parsing does not fit it, so it would need the Phase 2 LLM classifier.
- It usually has no job posting behind it, so it adds nothing to the match
  report, which needs posting text (SUMMARY.md, "What the system does").
- The person that matters is the recipient, not the sender, so the sender
  exclusion list (ADR-0025) would need a recipient rule.
- No item in SUMMARY.md's competency table depends on it.

## Decision

Sent mail is not ingested in Phases 1–3. Reading the sent folder to record
direct applications is listed as a Phase 4 option, to be built once the rest
of the system runs, or not at all.

If it is built, it reuses the existing path: the same read-only date-window
fetch (ADR-0007) on the sent folder, write-once raw objects under their own
prefix, classification by the Phase 2 LLM, and an exclusion rule on
recipients. Gmail keeps sent mail, so a date-window backfill can load the
history at that point; nothing is lost by waiting.

## Rationale

1. **Ingest the sent folder now (Phase 1), classify later.** Rejected: no
   Phase 1 code could read it, so every message would count as "other" and
   lower the parse-health rates without telling anything. Raw history is
   recoverable later anyway.
2. **Ingest and classify in Phase 2, with reply classification.** Rejected:
   it adds a second LLM task and a recipient exclusion rule to a phase whose
   success criteria (golden set, evaluation gate, match report) do not need
   it.
3. **Phase 4 option (chosen).** Keeps the core phases on what the
   competency table requires, and leaves a clear path if direct applications
   become frequent.

## Consequences

**Positive:**

- No new folder, exclusion rule, or LLM task before the core works.
- Parse-health rates keep describing only incoming mail.

**Negative / trade-offs:**

- A direct application is missing from the application list and gets no
  follow-up flag until the company replies; the reply itself arrives as
  "other" mail and is classified in Phase 2.
- Revisit if direct applications become a large share of the owner's
  applications, or when Phase 4 starts.
- A later implementation must find the sent folder without hard-coding its
  localized name.

## References

None. The findings above were verified on the owner's mailbox and in this
repository.
