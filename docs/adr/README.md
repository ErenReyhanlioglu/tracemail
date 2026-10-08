# Architecture Decision Records

This directory contains TraceMail's Architecture Decision Records (ADRs). An
ADR captures a significant architectural decision, the context behind it, and
the alternatives that were considered.

See [CLAUDE.md](../../CLAUDE.md#adrs) for the template and process. An ADR is
written at the moment the decision is made — not drafted ahead of time.

## Naming

`NNNN-short-title.md`, zero-padded and sequential.

## Index

| ID | Title | Status |
|----|-------|--------|
| [0001](0001-no-retrieval-in-matching-embeddings-only-for-rough-ranking.md) | No Retrieval in Matching; Embeddings Only for Phase 4 Rough Ranking | Accepted (embedding part not yet implemented) |
| [0002](0002-release-tagging-and-versioning.md) | Release Tagging and Versioning | Accepted (not yet implemented) |
| [0003](0003-isolated-python-environments-for-pipeline-and-dbt.md) | Isolated Python Environments for Pipeline Code and dbt | Accepted (not yet implemented) |
| [0004](0004-monorepo-layout.md) | Monorepo Layout | Accepted (not yet implemented) |
| [0005](0005-access-model-three-roles-and-share-links.md) | Access Model — Three Roles and Signed Share Links | Accepted (not yet implemented) |
| [0006](0006-raw-parsed-landing-data-flow.md) | Raw → Parsed → Landing Data Flow | Accepted; `parsed/` layout amended by [0018](0018-parsed-zone-uses-partition-overwrite.md) |
| [0007](0007-date-window-ingestion-and-read-only-mailbox.md) | Date-Window Ingestion and a Read-Only Mailbox | Accepted (not yet implemented) |
| [0008](0008-hourly-polling-instead-of-push.md) | Hourly Polling Instead of Push | Accepted (not yet implemented) |
| [0009](0009-vm-to-gcp-auth-with-service-account-keys.md) | VM-to-GCP Authentication with Per-Role Service Account Keys | Accepted (not yet implemented) |
| [0010](0010-separate-gcp-projects-for-dev-and-prod.md) | Separate GCP Projects for Dev and Prod | Accepted (not yet implemented) |
| [0011](0011-gcp-region-us-central1.md) | GCP Region `us-central1` | Accepted (not yet implemented) |
| [0012](0012-build-in-ci-ghcr-and-push-deploy-over-tailscale.md) | Build in CI, Publish to GHCR, Push-Deploy over Tailscale | Accepted (not yet implemented) |
| [0013](0013-airflow-3-3-on-python-3-12.md) | Airflow 3.3 on Python 3.12 | Accepted (not yet implemented) |
| [0014](0014-dbt-1x-orchestrated-with-cosmos.md) | dbt 1.x Orchestrated with Cosmos | Accepted (not yet implemented) |
| [0015](0015-owner-login-with-google-sign-in.md) | Owner Login with Google Sign-In, Handled by the API | Accepted (not yet implemented) |
| [0016](0016-self-host-web-on-vm-behind-cloudflare-tunnel.md) | Self-Host the Web App on the VM behind Cloudflare Tunnel | Accepted (not yet implemented) |
| [0017](0017-every-step-measures-time-volume-operations-and-cost.md) | Every Step Measures Its Time, Volume, Operations, and Cost | Accepted |
| [0018](0018-parsed-zone-uses-partition-overwrite.md) | The Parsed Zone Uses Partition Overwrite | Accepted (not yet implemented) |
