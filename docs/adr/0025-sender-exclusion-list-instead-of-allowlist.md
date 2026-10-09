# ADR-0025: A Sender Exclusion List Instead of an Allowlist

**Date:** 2026-10-09
**Status:** Accepted

## Context

Since step 1.2, ingestion kept only mail from senders on an allowlist
(CLAUDE.md, Privacy): what is not stored cannot leak. The list named job
platforms and every company that had written.

A header-only census of the mailbox over 90 days (2026-07-10 to 2026-10-10,
run 2026-10-09; counts only, nothing stored) showed:

- 1,027 messages; the allowlist kept 638 and dropped 389.
- Among the dropped: about 40 from application systems not on the list
  (Workday, Ashby, SuccessFactors, iCIMS, Kariyer.net, ...), about 12 from
  company domains, and 17 sent by the owner.
- The rest of the dropped mail was personal-account mail (banks, insurance,
  account security, developer services; about 65), career-platform
  newsletters (about 210), and LinkedIn mail that is not about jobs (about 33).

The mailbox is dedicated to the job search. Applications reach companies
through LinkedIn, the companies' own sites, and cold e-mail, about 100 a month
by the owner's estimate. Any company can therefore send an "application
received" or reply from a domain no list has seen. Adding domains as they
appear is maintenance the owner will not do, and the first mail from each new
company is always lost.

## Decision

- **Keep everything except an exclusion list.** Every message in the mailbox
  is stored, unless its sender is on a short exclusion list of personal
  accounts, newsletters, and LinkedIn's non-job addresses. Excluded mail is
  never downloaded beyond its headers, never written, and never logged
  beyond a count — the same guarantees the allowlist gave. The list changes
  when the owner's own accounts or habits change, not when a new company
  writes.
- **Sent mail is included.** The owner's own messages (cold applications) are
  stored like any other; how they become application events is decided with
  step 1.8.
- **Understanding is a later step.** LinkedIn mail is parsed by rules; all
  other mail is "other" in Phase 1 and is classified by the LLM in Phase 2
  (ADR-0024's event types plus a label for irrelevant mail).
- **Irrelevant mail is filtered, not deleted.** Mail classified as irrelevant
  stays in `raw/` and is excluded in the analytic layer: it produces no
  events and is counted only on the health panel. Deleting it automatically
  would make a misclassification permanent and would break replay from raw.
  Senders that only ever produce irrelevant mail are reported so the owner can
  add them to the exclusion list.
- **Sensitive mail that slips through is purged by hand.** If mail that
  should never have been stored is found (for example, an account security
  code from a newly used service), the owner (1) adds the sender to the
  exclusion list, (2) deletes the affected objects from `raw/`, and (3) re-runs
  parsing and loading for the affected days, which rewrites those `parsed/`
  and `landing` partitions without the mail (ADR-0018, ADR-0019), then
  rebuilds dbt. This is the only deliberate exception to write-once raw
  storage, and it is never automated.
- The raw inventory now counts stored mail by sender domain (never full
  address), so parser priorities and exclusion candidates are measured.

## Rationale

Alternatives considered:

1. **Keep the allowlist and add domains as they appear.** Rejected:
   unsustainable at about 100 applications a month, and it always loses the
   first mail from a new company.
2. **Allowlist plus automatic rules** (application systems list, domains the
   owner has written to, Gmail thread membership, a manual Gmail label).
   Rejected: several rules to maintain and test, and it still loses
   confirmations from companies that write from their own domain after an
   application on their site.
3. **An LLM deciding at ingestion what to store.** Rejected: Phase 1 has no
   LLM; it would send headers of personal mail to a third party; and storage
   decisions must be reproducible, which a model's answer is not.

## Consequences

**Positive:**

- No per-company maintenance; confirmations and replies from any company are
  captured, including companies the system has never seen.
- Cold applications enter the system.
- "Excluding sensitive sources at the ingestion stage" (SUMMARY.md) is kept,
  with an explicit list of what is sensitive.

**Negative / trade-offs:**

- Mail from a personal service first used after the list was written is
  stored until the owner notices it; the purge procedure above is the remedy.
- More mail reaches the "other" bucket and, in Phase 2, the LLM. Volume and
  cost are measured after the 90-day re-ingest; not yet measured.
- Changing the setting name (`TRACEMAIL_SENDER_EXCLUSIONS_PATH`) requires each
  environment's configuration to be updated once.
