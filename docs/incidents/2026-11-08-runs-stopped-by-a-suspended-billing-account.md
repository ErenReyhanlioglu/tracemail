# Incident: Hourly runs stopped by a suspended billing account

**Date:** 2026-11-08 (start, UTC)
**Status:** Mitigated

## Summary

The production project's billing account was past due on its October
invoice of about ₺0.23, and Google Cloud disabled billing on the project.
With billing disabled, BigQuery refused every write, so 45 hourly runs in a
row failed from 2026-11-08 21:00 to 2026-11-10 17:00 UTC. Paying the
invoice restored billing, and the next run, at 18:00, caught up on its own.

## Impact

- 45 scheduled runs failed, one per hour from 21:00 on 2026-11-08 to 17:00
  on 2026-11-10 UTC. None of them left a run record in `ops.pipeline_runs`:
  the record itself is a BigQuery write.
- New mail was not stored or processed for about 45 hours. The 2026-11-09
  and 2026-11-10 mail was written to `raw/` at 18:00:09 on 2026-11-10 by the
  first run after recovery, and parsed, loaded, and built by dbt in the
  same run.
- **No mail was lost.** Each run reads its day window with one day of
  slack, so the recovery run covered 2026-11-09 onwards. 2026-11-08 was
  outside that window. Its mail was checked on 2026-11-11 by fetching the
  day again from the mailbox into the dev raw zone. The 12 stored objects
  there match the 12 in production object for object (the keys are hashes
  of the Message-ID). 2026-11-07 and 2026-11-09 showed no difference either.
- **No data was set to expire.** In this state BigQuery refuses to create
  tables in a dataset without a default expiration shorter than 60 days. It
  did not add one to existing datasets. On 2026-11-11 no prod dataset had a
  default table or partition expiration, and no table had an expiration.
  The only partition expirations are the 400 days set by the pipeline
  itself on `ops.pipeline_runs` and `ops.dbt_node_runs`.
- The public health panel stayed up, since reads kept working. It showed
  the 45 hours as failed: an expected hour with no run record counts as
  missed, and a missed hour is drawn as a failure.
- The money involved was the overdue invoice itself, about ₺0.23. No other
  charge followed.

## Root causes

- **A small paid usage nobody watched.** The project had a few kuruş of
  billable usage in October (GCS Class A operations, as the billing report
  showed). Whether that usage went over the free tier, or was billed for
  another reason, has not been established. The invoice became past due,
  and the reason the automatic payment did not complete was not determined.
- **No billing alert.** No budget or billing notification was set up, so a
  past-due invoice and a disabled project reached no one.
- **The failure record shares the failing dependency.** A step's outcome,
  including FAIL, is written to BigQuery (`run_recorded`). When BigQuery
  writes fail, the failure cannot be recorded. The runs left no record, and
  no error message showed why.
- **No alert on missing runs.** The panel showed the gap, but the system
  never tells anyone. A failure is seen only when someone opens the panel.

## Trigger

Google Cloud disabled billing on the project because of the past-due
invoice. The exact time was not recorded; the first failed run started at
21:00 UTC on 2026-11-08, and the run at 20:00 had completed.

## Resolution

- **Mitigation:** the past-due amount (₺0.23) was paid on 2026-11-10
  between 17:46 and 18:00 UTC, and billing was enabled on the project
  again. The run at 18:00 completed every step and wrote the waiting mail.
- **Checks after recovery (2026-11-11):** no dataset or table was set to
  expire, and no 2026-11-08 mail was missing. No backfill run was needed.
- **Lasting fix:** open; see the action items.

## Detection

The owner opened the health panel on 2026-11-10 and saw a whole row of
failed hours, about 44 hours after the first failed run. The Airflow log
showed the cause:
`403 ... Billing has not been enabled for this project`.
Nothing alerted in between.

## Action items

| Action | Type | State |
|---|---|---|
| Pay the past-due invoice and enable billing again | mitigate | Done (2026-11-10) |
| Check that no dataset or table was set to expire | process | Done (2026-11-11): none |
| Check that no mail of 2026-11-08 was missed | process | Done (2026-11-11): 12 of 12 stored |
| Set up a budget with e-mail alerts and billing notifications on the billing account | prevent | Open (owner, in the console) |
| Measure October's GCS Class A operations against the free tier; apply the 85% rule (ADR-0030) if needed | prevent | Open |
| Alert when no run record arrives for several hours, without a separate observability stack | mitigate | Open (needs an ADR) |
| Keep a trace of a failed step when the run record cannot be written to BigQuery | mitigate | Open |

## Lessons learned

**What went well:** Raw ingestion is idempotent and reads a day window with
slack, so the first run after recovery caught up without a manual step.
Reads kept working, so the public panel stayed up and showed the gap. The
deterministic raw keys made the "nothing was lost" check exact.

**What went wrong:** A charge of a few kuruş stopped the whole pipeline for
almost two days. The only failure record lives in the same service that
was failing. Nothing tells the owner when runs stop.

**Where we got lucky:** No mail arrived in the last hours of 2026-11-08, the
part of the outage the recovery run's window did not cover. If mail had
arrived then, it would have needed a manual run.

## Timeline (UTC)

- 2026-11-08 20:00 — Last run before the outage completes.
- 2026-11-08 21:00 — First run that leaves no record; every hourly run
  until 17:00 on 2026-11-10 fails the same way.
- 2026-11-10 17:00:01 — The 17:00 run starts and fails at 17:26:06 after
  its retries, with `403 Billing has not been enabled for this project` on
  a table create in `ops`.
- 2026-11-10 17:46 — The VM is checked: every container is up, the last
  six runs failed.
- 2026-11-10 17:46–18:00 — The past-due invoice is paid; billing is
  enabled again.
- 2026-11-10 18:00:03 — The 18:00 run completes every step; the waiting
  mail is written at 18:00:09.
- 2026-11-11 — Expiration and missed-mail checks: nothing to fix.

## Panel summary

Not published on the health panel's incident log: the owner decided on
2026-11-11 to keep this incident in the repository only. The proposed
summary is kept for the record.

**2026-11-08 — Hourly runs stopped for 45 hours.** An unpaid cloud invoice
of a few kuruş suspended writes. **Fix:** the invoice was paid and no mail
was lost.
