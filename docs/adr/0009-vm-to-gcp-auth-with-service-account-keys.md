# ADR-0009: VM-to-GCP Authentication with Per-Role Service Account Keys

**Date:** 2026-10-03
**Status:** Accepted (not yet implemented)

## Context

The runtime VM is on Oracle Cloud; storage, warehouse, and (from Phase 2) the
LLM are on Google Cloud. A VM outside Google Cloud has no metadata server, so
it must prove its identity to Google some other way.

Two options exist:

- **Service account key files** on the VM.
- **Workload Identity Federation (WIF)**, which exchanges a short-lived token
  from another identity provider for short-lived Google credentials.

Search results (Oracle A-Team articles) indicate that WIF from an OCI compute
instance to Google Cloud is possible through a multi-step token exchange:
OCI instance principal → OCI identity domain token → Google STS. The detailed
guides returned HTTP 403 and could not be read, so it is **not verified**
whether this works on OCI's Always Free tier or how much runtime code it needs.

For GitHub Actions → Google Cloud, WIF is the standard, documented path.

## Decision

- **VM → GCP:** service account key files, one per role, each with least
  privilege (ingestion: write to the raw/parsed buckets; transform: BigQuery
  job user + data editor on its datasets; api: BigQuery read on marts; llm:
  LLM platform user). Keys live only on the VM with restricted file
  permissions, mounted into containers; never in the repository or an image
  layer. Keys are rotated on a fixed schedule set by the owner.
- **GitHub Actions → GCP:** Workload Identity Federation, no keys.
- **WIF for the VM** is recorded as follow-up research. If it proves viable on
  the free tier, a new ADR supersedes this one.

## Rationale

Alternatives considered:

1. **WIF for the VM now.** Deferred: unverified on the free tier, and the
   architecture should not depend on an unverified path. Phase 1 would grow
   further.
2. **One key with broad roles.** Rejected: a single leak would expose
   everything.

## Consequences

**Positive:**

- Simple, well-documented setup; Phase 1 is not blocked.
- A leaked key is limited to its role's permissions.

**Negative / trade-offs:**

- Long-lived credentials exist on the VM. Anyone who compromises the VM can
  use them until they are rotated or revoked.
- Rotation is a manual, recurring task.

## References

1. [Federate OCI Workload Identity to Google Cloud — Oracle A-Team](https://www.ateam-oracle.com/federate-oci-workload-identity-to-google-cloud) (returned HTTP 403; known only from search-result summaries)
2. [Workload Identity Federation — Oracle A-Team](https://www.ateam-oracle.com/workload-identity-federation) (returned HTTP 403; known only from search-result summaries)
3. [Authorising Pods in OKE to Access GCP Resources Using OIDC Discovery — Oracle Blogs](https://blogs.oracle.com/developers/authorising-pods-in-oke-to-access-gcp-resources-using-openid-connect-discovery)
