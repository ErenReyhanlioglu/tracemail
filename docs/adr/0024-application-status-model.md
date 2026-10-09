# ADR-0024: Application Status Model — Events, Three Statuses, and a Silence Indicator

**Date:** 2026-10-09
**Status:** Accepted (not yet implemented)

## Context

Step 1.5 computes each application's stage, waiting time, and follow-up flag
(SUMMARY.md, What the system does, item 5). The UI mockups suggested four
statuses (no reply, in review, progress, rejected), a separate "follow-up
suggested" badge, a "saved" state, and a per-channel response-rate table.
The mockups are layout references with invented data, not a specification;
in them the follow-up badge does not follow any single threshold.

What the data offers:

- Phase 1 has one application event: the LinkedIn application confirmation
  (`job_actions.action = applied`). Step 1.6 adds the LinkedIn export, step
  1.8 further LinkedIn templates and sent mail, Phase 2 LLM classification of
  free-text company replies.
- Application volume is small (tens per month) and the channel an application
  goes through is chosen together with the kind of company and role, so
  per-channel response rates would be dominated by noise and confounding.

## Decision

**Two layers: events and status.** Each message yields events (what exactly
happened); an application's status is a coarse summary derived from its
events. A seed table, approved by the owner, maps each event type to the
status it sets, or to none:

| Event type | Typical origin | Sets status |
|---|---|---|
| `application_submitted` | LinkedIn confirmation, LinkedIn export, sent mail | `applied` |
| `application_received` | Automatic acknowledgement from an application system | — |
| `application_viewed` | LinkedIn, if such a template exists in real mail | `in_progress` |
| `resume_downloaded` | LinkedIn, if such a template exists in real mail | `in_progress` |
| `assessment_invite` | Company (test, case study) | `in_progress` |
| `interview_invite` | Company | `in_progress` |
| `offer` | Company | `in_progress` |
| `information` | Company (process update, consent request, reminder) | — |
| `rejection` | Company | `rejected` |

- **Three statuses:** `applied`, `in_progress`, `rejected`. An offer counts as
  progress. There is no "withdrawn" status; a rejection is enough.
- **Status rule:** the status set by the latest event that sets one.
- **Saved is not an application status.** Saving is a property of a posting
  and is shown with postings.
- **Silence indicator, not a status.** If an application is `applied` or
  `in_progress` and its latest event of any kind is older than a configured
  number of days (10 to start), it shows "no reply for N days". This single
  indicator is also the follow-up suggestion. It is computed at read time,
  never stored (ADR-0022).
- **The event type list is the LLM's label set.** Phase 2's reply classifier
  outputs one of these event types, so rule-based and LLM-classified mail
  feed the same model. Adding a type is a seed row, not a model change.
- **No per-channel rates.** The application channel (LinkedIn, company site,
  direct mail) is kept as a label on each application. Rates are reported for
  system health instead: parse health per LinkedIn template and for all
  other senders combined (ADR-0020). SUMMARY.md's competency table is updated
  to match.

Identifiers are English; display labels follow the UI-language decision that
is still open (roadmap).

## Rationale

Alternatives considered:

1. **The mockup's four statuses.** Rejected: "no reply" describes elapsed
   time, not a state, and would hide the actual status; "in review" is not
   distinguishable from progress in practice.
2. **Separate follow-up flag and silence label.** Rejected: both express the
   same condition.
3. **Per-channel response rates.** Rejected: small samples and channel choice
   confounded with company and role make the rates misleading.
4. **A posting-source funnel (alert → saved → applied)** as the replacement
   for channel rates. Rejected by the owner: not a question the owner needs
   answered.

## Consequences

**Positive:**

- New event sources (further templates, sent mail, the LLM) extend a seed,
  not the models.
- The status stays truthful while the silence indicator adds urgency.
- Health rates point directly at what to debug.

**Negative / trade-offs:**

- In Phase 1 every application is `applied`; the hand-checked sample of step
  1.5 exercises only that status and the silence indicator.
- Whether `application_viewed` / `resume_downloaded` mails exist, and under
  which LinkedIn template ids, is not yet verified.
- Without a "reply" concept, the overview cannot say how many
  companies answered; revisit if that becomes a question the owner asks.
