# ADR-0046: Failure List by Pull Request, and a Separate Delivery Query

**Date:** 2026-10-15
**Status:** Accepted

## Context

The incident of 2026-10-14 (`docs/incidents/2026-10-14-panel-down-after-the-delivery-deploy.md`)
tested two parts of ADR-0045 for the first time:

- **The failure list.** ADR-0045 keyed a failure's fix by the fixing
  deployment's commit. This incident was restored by hand (views built,
  authorization granted), with no fixing deployment, so the row had no
  commit to name and no way to record when service came back. And with
  squash merges, the fixing commit does not exist while its pull request
  is open, yet the rule asks for the row in that pull request.
- **One query for the panel.** The delivery section was part of the
  panel's single query (ADR-0044), so missing delivery views took the whole
  public panel down for about 18 minutes.

## Decision

1. **The failure list's columns** are `failed_sha`, `detected_at`,
   `recovered_at`, `fixed_pull_request`, and `incident_report`.
   `recovered_at` is set when service was restored without a deployment;
   `fixed_pull_request` is the number of the pull request whose deployment
   fixed it, known while that pull request is open. At least one of the two
   is set (a dbt test). Recovery time runs from `detected_at` to
   `recovered_at`, or else to that pull request's first successful
   deployment; a fixing deployment counts as rework. Recovery time is now
   attached to the failing deployment, not the fixing one.
2. **Delivery has its own query.** If its data is missing or unreadable,
   the API logs the error type and returns the panel with an empty delivery
   section, which says so on the page. The run-history query keeps its
   single 10 MiB read; delivery reads two tables, 20 MiB, so the total per
   refresh is unchanged at 30 MiB.

The list's rows after this change: `8cd9bca` (fixed by #15's deployment)
and `c47c0c4` (#25, restored by hand at 23:34:11, no fixing deployment).

## Rationale

- **Keeping `fixed_sha`** was rejected: it cannot be known in the pull
  request that adds the row, and it cannot describe a recovery that was not
  a deployment.
- **Adding the row after merge, in a second pull request** was rejected:
  it doubles the process for every fix and breaks the rule that the row
  travels with the fix.
- **A failure-tolerant single query** (empty arrays when a view is
  missing) is not possible: BigQuery fails the whole query when a
  referenced table does not exist.
- **Building dbt on every deploy** would also have prevented this incident
  and stays an open action item, but it does not protect the panel from a
  view that fails for any other reason, such as a missing authorization.

## Consequences

**Positive:**

- A recovery by hand is recorded with its real end time.
- One failing section can no longer take the public panel down.

**Negative / trade-offs:**

- Change fail rate counts the incident of 2026-10-14: 2 of 15 deployments.
- A section can be silently empty for longer than a whole-panel failure
  would be noticed; the API logs a warning each time.

## References

1. [DORA's software delivery performance metrics — DORA](https://dora.dev/guides/dora-metrics/)
