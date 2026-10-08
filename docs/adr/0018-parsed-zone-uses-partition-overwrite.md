# ADR-0018: The Parsed Zone Uses Partition Overwrite

**Date:** 2026-10-07
**Status:** Accepted (not yet implemented)

## Context

ADR-0006 put parser output in a `parsed/` zone in GCS, with the parser version
and ingest date in the object path. Two problems surfaced before the first
parser was written:

- **Stale versions.** With the version in the path, re-parsing a day with a
  new parser version leaves the old version's files next to the new ones. The
  BigQuery load would then need its own logic to pick the current file.
- **Run date in the path.** An "ingest date" partition gives the same record
  a different location depending on which run produced it. Step 1.2 already
  replaced the run date with the message's own received date for raw objects
  for the same reason.

## Decision

The `parsed/` zone follows the **partition overwrite** pattern:

```
parsed/<record_type>/received_date=YYYY-MM-DD/data.jsonl
```

- One file per record type per received date. Parsing a day writes that day's
  file from scratch, replacing any previous version; other days are untouched.
- `parser_name` and `parser_version` are fields on every row, not path
  segments, so provenance is kept per record.
- The partition key is the source message's received date (UTC), matching the
  raw zone.

This amends ADR-0006's description of the `parsed/` path; the rest of
ADR-0006 stands.

## Rationale

Alternatives considered:

1. **Version in the path (ADR-0006 as written).** Rejected: old versions
   accumulate, and every reader must decide which version is current.
2. **Append-only files per run.** Rejected: reruns would duplicate records,
   breaking idempotency.

Partition overwrite is the same pattern already chosen for the `landing`
dataset in BigQuery (one date partition replaced per run), so both layers
behave the same way on rerun and replay.

## Consequences

**Positive:**

- The zone always shows the current parse of every day; nothing to clean up.
- Reruns and replays are idempotent by construction.
- The load into `landing` is a direct mapping: one file, one partition.

**Negative / trade-offs:**

- The previous parse of a day is not kept in `parsed/`. It can always be
  regenerated from `raw/` with the old parser version from git history.
