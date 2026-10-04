# ADR-0011: GCP Region `us-central1`

**Date:** 2026-10-03
**Status:** Accepted (not yet implemented)

## Context

Verified against Google Cloud documentation:

- Cloud Storage Free Tier benefits "apply only to usage in the `us-east1`,
  `us-west1`, and `us-central1` regions." Outside these, all storage is billed.
- BigQuery's Free Tier (1 TiB queries, 10 GiB storage per month) states no
  region restriction.
- When loading from Cloud Storage, "the Cloud Storage bucket must be in the
  same location as the dataset."
- Cloud Storage includes 100 GB per month of free outbound data transfer from
  North America.

So the bucket's region decides the dataset's region as well.

The data includes third-party personal data from the owner's mailbox. Storing
it in the US raises a cross-border transfer question under Turkish data
protection law (KVKK). This ADR is not a legal assessment; the owner has
considered the question and accepted the US region. The public part of the
system shows no personal data, and the same mail already resides with Google
in Gmail.

## Decision

All GCP resources in both projects (ADR-0010) live in **`us-central1`**:
buckets, BigQuery datasets (regional, not multi-region), and, from Phase 2,
LLM calls where the model is available there.

The Oracle VM's region is a separate decision, made when the Oracle account
is created.

## Rationale

Alternatives considered:

1. **A European region (closer to the owner).** Rejected: Cloud Storage would
   have no free tier, and BigQuery must follow the bucket.
2. **`US` multi-region datasets.** Rejected: a single explicit region keeps
   bucket–dataset colocation trivial and costs predictable.
3. **`us-east1` / `us-west1`.** Equivalent for the free tier; `us-central1` is
   chosen as the default. No measured difference motivates the choice.

## Consequences

**Positive:**

- Storage and loads stay within the Free Tier at this volume.
- Bucket and datasets are colocated by construction.

**Negative / trade-offs:**

- Data rests outside Turkey. Revisit if the system's scope of use changes.
- Calls from a VM outside the US add network latency; irrelevant for hourly
  batch work, mitigated by caching on the read path.

## References

1. [Free cloud features and trial (Cloud Storage free regions, BigQuery and egress allowances) — Google Cloud docs](https://docs.cloud.google.com/free/docs/free-cloud-features)
2. [Loading JSON data from Cloud Storage (bucket must match dataset location) — BigQuery docs](https://docs.cloud.google.com/bigquery/docs/loading-data-cloud-storage-json)
