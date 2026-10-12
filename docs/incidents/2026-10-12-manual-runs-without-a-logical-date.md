# Incident: Manual Runs Without a Logical Date Failed

**Date:** 2026-10-12 (start, UTC)
**Status:** Mitigated

## Summary

The first manual run of the hourly DAG in prod failed before doing any
work: Airflow 3 starts a run triggered without a date with no data interval,
and the ingestion task's template required one. A manual run triggered with
a date did the same work 12 minutes later. The DAG now falls back to the
trigger time; the fix is in review and is verified once deployed.

## Impact

- One manual run (`manual__2026-10-12T16:11:01`) failed; its retries were
  cut short by marking it failed.
- No data was read, written, or changed: the task failed while rendering its
  arguments, before any pipeline code ran.
- Scheduled runs were unaffected; the 16:00 run succeeded before and every
  hourly run after.
- The first full dbt build in prod started at 16:23 instead of 16:11.
- Until the fix is deployed, the Airflow UI's "Trigger" and a dateless
  `airflow dags trigger` fail the same way.

## Root causes

- In Airflow 3, a manual run triggered without a logical date has none, and
  the template context then has no `data_interval_start` or
  `data_interval_end`: they are undefined, not `None`.
- The DAG passed `"{{ data_interval_start.isoformat() }}"` to the ingestion
  task, which assumes every run has an interval.
- Every earlier manual run was `just dag-test <logical date>` or a scheduled
  run, so the dateless path had never run.

## Trigger

`airflow dags trigger tracemail_hourly` without `--logical-date`, issued to
start the first dbt build after prod's backfill.

## Resolution

- **Workaround:** a manual run with an explicit logical date
  (`--logical-date 2026-10-12T16:30:00+00:00`), from which Airflow infers
  the interval; the failed run was marked failed through the REST API
  (`infra/vm/README.md`, operations notes) so the new run did not wait for
  its retries.
- **Fix:** the DAG's interval templates fall back to `dag_run.run_after`
  when the interval is undefined or `None`. A dateless manual run then gets
  the same IMAP window as the scheduled run of that hour, and manual runs
  process the whole window anyway (ADR-0021). Checked by rendering the
  template under Jinja's `StrictUndefined` for a scheduled run, an undefined
  interval, and a `None` interval. A first idea, `data_interval_start or
  run_after`, fails the same way, because Airflow's undefined values raise
  on any use.

## Detection

During the trigger itself: its output showed `logical_date None` and an
empty interval. The task log confirmed the cause within minutes:
`UndefinedError: 'data_interval_start' is undefined`. Nothing alerted on
the failure; it was found because the run was being watched.

## Action items

| Action | Type | State |
|---|---|---|
| Fall back to the trigger time when a run has no interval (`apps/airflow/dags/tracemail_ingest.py`) | prevent | Done, deploys with the fix's pull request |
| Trigger a dateless manual run in prod after the deploy and confirm it succeeds | mitigate | Open |
| Document changing a run's state through the REST API, since the UI is unreachable | process | Done (`infra/vm/README.md`) |

## Lessons learned

**What went well:** The failure happened while rendering arguments, so no
data was touched. Scheduled runs never depended on the broken path. The
REST API gave a way to clear the stuck run without opening the UI.

**What went wrong:** Local testing only ever ran the DAG with a logical
date, so the path a person uses most (the UI's Trigger button) was the one
never tested. Nothing would have reported the failure if no one had been
watching.

**Where we got lucky:** It surfaced during a supervised first run, not
weeks later when a manual run was needed in a hurry.

## Timeline (UTC)

- 16:10 — DAG unpaused after the backfill; the 16:00 scheduled run succeeds.
- 16:11 — Dateless manual run triggered; `ingest_mail` fails on template
  rendering and is scheduled for retry.
- About 16:14 — Cause confirmed in the task log.
- 16:16 — Manual run with a logical date queued as a workaround.
- 16:23 — Failed run marked failed through the REST API; the queued run
  starts.
- About 16:44 — Queued run finishes (its last dbt node at 16:43); the first
  dbt build in prod is complete.

## Panel summary

**2026-10-12 — Manual runs failed.** Runs started without a date had no
time window; one manual run failed, scheduled runs and data were unaffected.
**Fix:** such runs now use their trigger time.
