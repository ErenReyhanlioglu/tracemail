# Incidents

One postmortem per production incident: something in prod broke, was fixed,
and is written down so the cause and the follow-ups are not lost. An
incident is anything that failed in prod or would have, whether or not
anyone noticed it from outside; a planned change is not.

The structure follows the example postmortem of Google's SRE book [1], the
most widely used template; PagerDuty's [2] has the same core with sections
for team response that a single-owner project does not need. Two
adaptations:

- **No authors section.** Documents carry no personal details.
- **Panel summary.** Every postmortem ends with the two lines the public
  health panel's incident log shows (Phase 3), proposed with the postmortem
  and published only after the owner approves them (CLAUDE.md, Incidents).
  The postmortem records the approval. The summary is written in English
  like every file; the panel's copy is Turkish (ADR-0033), so publishing it
  means adding its Turkish translation to the web app's strings module.

Postmortems state what went wrong, not who: the subject is the system and
the process. Like everything public in this repository, they never contain
mail content, sender details, or other personal data (CLAUDE.md, Privacy).

## Writing one

File name: `YYYY-MM-DD-short-title.md`, dated by the incident's start in UTC.
Add a row to the index below in the same change. Status is one of:

- **Open:** the incident is not over.
- **Mitigated:** prod works again, but the fix or a check is still pending.
- **Resolved:** the fix is deployed and verified; open action items are
  tracked in the postmortem.

```markdown
# Incident: Title

**Date:** YYYY-MM-DD (start, UTC)
**Status:** Open | Mitigated | Resolved

## Summary
Two or three sentences: what broke, for how long, how it was fixed.

## Impact
What users, data, and runs were affected, with numbers.

## Root causes
Why it broke. The conditions that made it possible, not only the event.

## Trigger
The event that set it off.

## Resolution
What restored service, including a temporary workaround and the lasting fix.

## Detection
How it was noticed, and how long that took.

## Action items
| Action | Type (prevent / mitigate / process) | State |
|---|---|---|

## Lessons learned
**What went well:** ...
**What went wrong:** ...
**Where we got lucky:** ...

## Timeline (UTC)
- HH:MM — ...

## Panel summary
Two lines for the health panel's incident log. Approved by the owner on
YYYY-MM-DD (or: pending approval).

## References
1. ...
```

## Index

| Date | Incident | Status |
|---|---|---|
| 2026-10-12 | [Manual runs without a logical date failed](2026-10-12-manual-runs-without-a-logical-date.md) | Resolved |

## References

1. [Example Postmortem — Site Reliability Engineering, Google](https://sre.google/sre-book/example-postmortem/)
2. [Postmortem Template — PagerDuty Incident Response](https://response.pagerduty.com/after/post_mortem_template/)
