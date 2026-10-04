# ADR-0010: Separate GCP Projects for Dev and Prod

**Date:** 2026-10-03
**Status:** Accepted (not yet implemented)

## Context

Local development and CI write to GCS and BigQuery. Those writes must never
reach the data that the live site serves.

Verified against Google Cloud's Free Tier documentation: Free Tier usage limits
"are calculated per billing account", not per project. Batch load jobs into
BigQuery use a shared slot pool at no charge. A billing account can have five
linked projects by default (from search-result summaries of the Billing quota
docs; the page itself was not read).

## Decision

Two GCP projects on the same billing account:

- `tracemail-dev` — local development and CI.
- `tracemail-prod` — the VM; the only project the live site reads.

Each project has its own buckets, datasets, service accounts, and budget
alert. dbt targets `dev` and `prod` map to the two projects. Dev keys have no
role in the prod project.

Development uses the owner's real mailbox; real mail therefore exists on the
owner's machine and in the dev project. Fixtures committed to the repository
still follow the redaction rule.

## Rationale

Alternatives considered:

1. **One project, prefixed datasets and buckets (`dev_`).** Rejected:
   separation then depends on configuration and IAM being correct; one wrong
   prefix or overly broad grant lets a test write into live tables. Cost is
   identical, since Free Tier limits are per billing account.

## Consequences

**Positive:**

- A mistake in development cannot touch production data; this is enforced by
  project boundaries, not by discipline.
- Environment separation is visible and demonstrable.

**Negative / trade-offs:**

- Service accounts, IAM bindings, and budget alerts are set up twice.
- Dev and prod share one Free Tier allowance; heavy experimentation in dev
  consumes the same monthly quota as production.
- Uses two of the billing account's default five project slots.

## References

1. [Free cloud features and trial (limits are per billing account) — Google Cloud docs](https://docs.cloud.google.com/free/docs/free-cloud-features)
2. [Batch load data (shared slot pool at no charge) — BigQuery docs](https://docs.cloud.google.com/bigquery/docs/batch-loading-data)
3. [Quotas and limits — Cloud Billing docs](https://docs.cloud.google.com/billing/quotas) (project-per-billing-account limit known from search-result summaries)
