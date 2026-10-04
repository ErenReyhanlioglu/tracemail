# ADR-0008: Hourly Polling Instead of Push

**Date:** 2026-10-03
**Status:** Accepted (not yet implemented)

## Context

The original plan ran ingestion once a day. The owner asked whether the
system could react the moment a mail arrives. The morning summary email had
already been dropped as noise, so the system's value is tracking and
analysis, not alerting; Gmail itself already notifies the owner of new mail.

## Decision

The ingestion DAG runs **every hour**. There is no push trigger.

The health panel shows run history in two stacked views: the last 24 hours
(one bar per run) and the last 30 days (one bar per day summarizing its runs).

## Rationale

Alternatives considered:

1. **Daily run.** Rejected: a reply would appear in the UI up to a day late,
   while hourly costs no extra infrastructure.
2. **IMAP IDLE listener.** Rejected: a long-lived process outside Airflow
   that must be kept alive and monitored, for minutes of latency that do not
   change any decision.
3. **Gmail API push via Pub/Sub.** Rejected: replaces IMAP with the Gmail API
   (separate OAuth setup) and needs an internet-facing endpoint to receive
   notifications.

## Consequences

**Positive:**

- Data in the UI is at most about an hour old.
- No new components; the date-window ingestion (ADR-0007) works unchanged.

**Negative / trade-offs:**

- 24 runs a day instead of one: more Airflow metadata, more `ops` rows, and
  `dbt build` 24 times a day. Expected to be negligible at this volume; to be
  checked against BigQuery usage once running.
- Health-panel metrics defined per run (for example, "uninterrupted days")
  need day-level definitions.
