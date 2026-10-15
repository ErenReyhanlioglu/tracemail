# Incident: Health panel down after the delivery metrics deploy

**Date:** 2026-10-14 (start, UTC)
**Status:** Mitigated

## Summary

The deploy of #25 put an API in production whose panel query read views
that did not exist yet in prod, and a table its authorized views could not
read. The public health panel showed "data unavailable" for about 18
minutes until the views were built by hand and the missing authorization
was granted.

## Impact

- The public health panel (`/health`) showed its unavailable state from
  23:15:48 to 23:34:11, about 18 minutes; the API answered 500 to the panel
  request (14 such responses in the logs, the first at 23:17:51).
- No data was lost or changed. Mail ingestion, parsing, loading, and dbt
  were unaffected: every hourly run before and after succeeded.
- The owner's private pages were unaffected; they read other marts.

## Root causes

- **The deploy activated code before the data it reads.** The panel query
  in #25 read `marts.fct_deployments`, which dbt creates only in a build,
  and dbt builds run only when new mail changes landing (ADR-0022). The
  deploy itself never builds dbt.
- **One query for the whole panel.** The delivery section was part of the
  panel's single query (ADR-0044), so a missing delivery view took down
  every section.
- **An authorization gap.** `fct_deployments` reads `staging`'s view of
  `landing.github_deployments`. `staging` was an authorized dataset on
  `ops` only: the first panel never read `landing` through `staging`, so
  the gap had no symptom until now.
- **The planned recovery depended on GitHub's quota.** The manual DAG run
  that would have built dbt also runs the deployment step over a whole
  day, and the backfill had used 55 of the VM's 60 hourly GitHub requests,
  because ingestion asked GitHub about deployments already stored.

## Trigger

Merging #25 at 23:12:38; its deploy finished at 23:17:12.

## Resolution

- **Mitigation:** the deployment history was backfilled on the VM
  (23:29), the delivery models were built with `dbt build` out of band
  (23:30, 20 of 20 nodes passed, not recorded in `ops`), and `staging` was
  authorized on `landing` with `infra/gcp/setup-project.sh` (23:34). The
  panel answered again at 23:34:11.
- **Lasting fix (this change):** delivery has its own query, so missing or
  unreadable delivery data empties only that section; ingestion skips
  stored deployments before any GitHub request; the setup script grants
  the authorization.

## Detection

A manual check of the site right after the merge saw the unavailable state
at 23:18:55, about three minutes after the new API started. Nothing would
have alerted otherwise: the panel has no external monitor.

## Action items

| Action | Type | State |
|---|---|---|
| Read delivery in its own query; an unreadable section is empty, the panel stays up | prevent | Done (this change) |
| Skip stored deployments before asking GitHub (one GCS existence check each) | mitigate | Done (this change) |
| Authorize `staging` on `landing` in `infra/gcp/setup-project.sh` | prevent | Done: applied in prod 23:34, script in this change |
| Record the failure in `dbt/seeds/deployment_failures.csv` | process | Done (this change) |
| Build dbt when a deploy changes dbt models, so new views exist before code reads them | prevent | Open |

## Lessons learned

**What went well:** The cause was in the API logs within minutes
(`403 Access Denied` on the second attempt), and every step was reversible.
The previous incident's rule, a manual run after a dbt change, was known.

**What went wrong:** The same ordering problem appeared with #23 and was
handled by hand then instead of being fixed. The panel had one point of
failure for all its sections. The authorization was tested for the views
that existed, not for the dataset path a new view would take.

**Where we got lucky:** It happened at night, minutes after the merge, while
someone was watching. The next scheduled run's deployment step fit in the
five GitHub requests left.

## Timeline (UTC)

- 23:12:38 — #25 merged; `v0.1.0` had been cut a few seconds earlier.
- 23:15:48 — The new API starts; every panel request now fails.
- 23:17:12 — Deploy job finishes.
- 23:17:51 — First 500 for the panel in the API log.
- 23:18:55 — Unavailable state seen in a manual check.
- 23:29 — Deployment history backfilled on the VM (18 records, 55 GitHub
  requests).
- 23:30 — Delivery models built out of band; the panel still fails.
- 23:31 — API log: `403 Access Denied` on `landing.github_deployments`.
- 23:34 — `staging` authorized on `landing`; the panel answers at 23:34:11.

## Panel summary

Approved by the owner on 2026-10-15. Published in Turkish on the health
panel's incident log.

**2026-10-14 — The health panel was down for 18 minutes.** A deploy read
data that did not exist yet in production. **Fix:** each section now loads
on its own.
