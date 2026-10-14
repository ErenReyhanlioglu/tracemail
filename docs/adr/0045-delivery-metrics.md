# ADR-0045: Delivery Metrics (DORA) — Source, Failure Definition, and Lead Time

**Date:** 2026-10-14
**Status:** Proposed

## Context

ADR-0044 puts delivery metrics on the health panel after its core and before
Phase 2: GitHub deployment records into `ops`, shown beside the run history.
Three questions are open: where the data comes from, what counts as a
failed deployment, and where a change's lead time starts.

### DORA's five metrics (read on 2026-10-14)

DORA groups them as throughput and instability [1]:

| Metric | Definition [1] |
|---|---|
| Change lead time | "The amount of time it takes for a change to go from committed to version control to deployed in production." |
| Deployment frequency | "The number of deployments over a given period or the time between deployments." |
| Failed deployment recovery time | "The time it takes to recover from a deployment that fails and requires immediate intervention." |
| Change fail rate | "The ratio of deployments that require immediate intervention following a deployment." |
| Deployment rework rate | "The ratio of deployments that are unplanned but happen as a result of an incident in production." |

DORA warns against making a metric a target, relying on one metric, and
comparing unlike applications, and recommends starting simply before
building measurement tooling [1].

### What exists (measured on 2026-10-14)

- The deploy job runs in the `production` environment, so GitHub records a
  deployment object and its statuses for every run of it [2]. The repository
  has 17 deployment records since 2026-10-11: 14 distinct commits, because
  two were re-runs of the deploy job (one after a failure) and one was the
  duplicate push of #24. Exactly one record ended in `failure`.
- The deployments list and a commit's pull request answer without
  authentication on this public repository (HTTP 200, measured), within
  GitHub's 60 unauthenticated requests per hour [3].
- `main` takes only squash-merged pull requests, so the commit that is
  deployed was created at merge time; the change's first commit is on the
  pull request (`GET /repos/{owner}/{repo}/commits/{sha}/pulls`, then its
  commits).
- Incidents are written up by hand in `docs/incidents/` and approved by the
  owner (CLAUDE.md, Incidents). Whether a deployment needed immediate
  intervention is a judgement a status alone does not make: a deploy job
  that fails never reached production, and a deploy that succeeds can still
  break the site.

## Options

**Where the data comes from:**

1. **An hourly pipeline step reads GitHub's API** and writes each finished
   deployment (with its statuses and pull request) to `raw/github/` once,
   then parse, landing, and dbt as for mail. Reads the whole history,
   replayable from raw, no new credential (unauthenticated; a few requests
   an hour).
2. **The deploy job writes its own record to `ops`** through workload
   identity federation. Needs GitHub trusted to write to prod BigQuery
   (today it is trusted only on the dev project, ADR-0037), records only
   future deployments, and has no raw copy.
3. **The API reads GitHub live** for the panel. Simplest, but the panel is
   built from `ops` rows, not live calls (CLAUDE.md, Airflow), and GitHub
   availability would become the panel's.

**What counts as a failed deployment:**

1. **A deploy job that ended in `failure`.** Automatic, but measures the
   deploy mechanism, not changes that broke production.
2. **An owner-kept seed** in the dbt project, one row per deployment that
   needed immediate intervention: the failing commit, when it was found,
   the commit that fixed it, and the incident report. Change fail rate,
   recovery time, and rework rate all follow from it; it is reviewed in
   pull requests and rebuilt like any seed.
3. **A pull request label** (`hotfix`) on the fixing change. Gives rework
   rate, but not which deployment failed or when recovery started.

**Where lead time starts:**

1. **The first commit of the change's pull request** (DORA's "committed to
   version control"), to the successful deployment.
2. **The merge** to the successful deployment: measures only the pipeline.

## Recommendation (to be decided)

Data option 1, failure option 2, lead time option 1. Deployments count once
per commit (re-runs and duplicate pushes collapse); a deploy job that fails
is shown separately as a failed attempt, not as a change failure. With a
handful of deployments a week, the panel shows counts and medians over
weekly windows, never a rate without its count (CLAUDE.md, Logging).

## References

1. [DORA's software delivery performance metrics — DORA](https://dora.dev/guides/dora-metrics/)
2. [Deploying with GitHub Actions — GitHub Docs](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)
3. [Rate limits for the REST API — GitHub Docs](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
4. [REST API endpoints for deployments — GitHub Docs](https://docs.github.com/en/rest/deployments/deployments) (does not say whether listing works without authentication; measured instead)
