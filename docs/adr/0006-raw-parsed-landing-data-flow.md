# ADR-0006: Raw → Parsed → Landing Data Flow

**Date:** 2026-10-03
**Status:** Accepted; the `parsed/` path layout is amended by ADR-0018

## Context

Mail is stored in GCS as original `.eml` bytes (write-once). BigQuery cannot
parse `.eml`, so parsing happens in Python. The open question was how parsed
records reach BigQuery, and whether parser output is kept anywhere besides
BigQuery.

The owner prioritized debuggability: when something looks wrong in the UI, it
must be easy to see exactly what the system understood from each mail.

## Decision

```
GCS raw/      original bytes, write-once
   │  parse (pipeline_venv)
   ▼
GCS parsed/   JSONL; path carries parser version and ingest date
   │  BigQuery load job from GCS
   ▼
BQ landing    one table per record type + parse_failures
   │  dbt
   ▼
staging → intermediate → marts
```

- `parsed/` is derived data and may be overwritten by a rerun or replay. Only
  `raw/` is write-once.
- Each run replaces exactly its own date partition in `landing`; it never
  appends. Running the same interval twice yields the same state.
- There is no BigQuery `raw` dataset; the first BigQuery layer is `landing`
  because its contents are parsed, not raw.
- A mail no parser understands is written to `parse_failures` and counted in
  the parse-success metric; the run continues.
- Replaying history after a parser change means re-running the parse over
  `raw/`, then loading and `dbt build`. A dbt `--full-refresh` alone does not
  apply a parser change.

## Rationale

Alternatives considered:

1. **Parse and load directly into BigQuery, no `parsed/` zone.** Rejected:
   inspecting parser output then requires querying the warehouse, and a
   failed load forces re-parsing. The difference is small, but the owner
   weighted debuggability over one fewer component.
2. **Streaming inserts.** Rejected in favor of batch load jobs from GCS, which
   use a shared slot pool at no charge [1]. BigQuery does not guarantee
   capacity for that pool; irrelevant at this volume.

## Consequences

**Positive:**

- "What did the parser make of this mail?" is answered by opening one file.
- A failed load is retried without re-reading mail.
- Reruns and backfills cannot create duplicates.

**Negative / trade-offs:**

- One more storage zone and one more step per run.
- Two layers (`parsed/`, `landing`) must stay consistent; the load step is
  the only writer to `landing`.

## References

1. [Batch load data — BigQuery docs](https://docs.cloud.google.com/bigquery/docs/batch-loading-data)
