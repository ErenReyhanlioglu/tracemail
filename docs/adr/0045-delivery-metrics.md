# ADR-0045: Delivery Metrics (DORA) — Source, Failure Definition, and Lead Time

**Date:** 2026-10-14
**Status:** Accepted (not yet implemented)

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

## Decision

- **Source:** an hourly pipeline step reads GitHub's REST API without
  authentication and writes each finished deployment, with its statuses and
  its pull request's commits, once to `raw/github/`; parse, landing, and dbt
  follow as for mail.
- **A deployment** counts once per commit: re-runs of the deploy job and
  duplicate pushes collapse. A deploy job that ends in `failure` is a failed
  attempt, shown separately, not a change failure.
- **A change failure** is a row in `dbt/seeds/deployment_failures.csv`, kept
  in the repository: the commit of the deployment that needed immediate
  intervention, when the failure was detected, the commit whose deployment
  fixed it, and the incident report. Change fail rate, recovery time (from
  detection to the fixing deployment), and rework rate (fixing deployments
  over all) come from it. CLAUDE.md requires the row in the same pull
  request as the fix.
- **Lead time** runs from the first commit of the change's pull request to
  its successful deployment.
- The panel shows counts and medians over the last 30 days, never a rate
  without its count. Weekly windows were the first plan; with a few
  deployments a week they would show noise, so the window is the panel's
  other 30-day strips'.

The first row, from the history on 2026-10-14: `8cd9bca` (the first
production deployment) shipped the DAG defect of the 2026-10-12 incident,
detected at 16:11 UTC and fixed by the deployment of `eb03680` (#15).
Considered and left out: the failed first attempt of `8cd9bca`'s deploy job
(re-run, never in production), #20 (the tunnel had never worked; the site
was not public yet), and #24 (a wrong cell for half an hour that corrected
itself; fixed by a planned change).

## Rationale

- **The deploy job writing to `ops` itself** was rejected: GitHub would need
  write access to prod BigQuery (it is trusted only on the dev project,
  ADR-0037), history would be lost, and there would be no raw copy.
- **The API reading GitHub live** was rejected: the panel is built from `ops`
  rows, and GitHub's availability would become the panel's.
- **Failed deploy jobs as change failures** was rejected: a failed job never
  reached production, and a successful one can still break it.
- **A `hotfix` label** was rejected: it gives rework but not which
  deployment failed or when recovery started.
- **Lead time from the merge** was rejected: it measures only CI and deploy,
  not DORA's "committed to version control".

## Consequences

**Positive:**

- All five DORA metrics from data already recorded, including history since
  2026-10-11, with no new credential.
- A change failure is a reviewed decision with its incident report, not a
  guess from a status.

**Implemented and measured on 2026-10-14 (dev project):**

- A scheduled run reads deployments created since an hour before its
  interval; the daily full-window run and manual runs look back a day.
  Steady state is one list request plus three per new deployment.
- The backfill of all 17 records since 2026-10-11 took 52 requests (three
  per deployment plus the list), so one hour's unauthenticated limit covers
  about 19 deployments: a longer history is backfilled in steps or with a
  token. The raw records were 716,157 bytes, about 42 KB each, mostly the
  pull request objects.
- The results match the hand count: 14 commits deployed, 1 failed attempt,
  change failure and rework 1 of 14, recovery 5 h 43 min, median lead time
  11 min 46 s (BigQuery's approximate median picks a middle value).
- The panel query now reads three tables (run records, deployments, the
  failure seed) and was billed 30 MiB, three times the 10 MiB before:
  about 42 GiB a month at two reads an hour, 3.9% of the query free tier
  (an expectation until a month is measured).

**Negative / trade-offs:**

- The failure list depends on discipline: a fix merged without its row
  understates the change fail rate. The CLAUDE.md rule and review guard it.
- Unauthenticated requests share a 60-per-hour limit per address; a few an
  hour are used. Revisit with a token if a run needs more.
- Weekly counts are small; the metrics describe this project, not a team,
  and are not compared with DORA's benchmarks.

## References

1. [DORA's software delivery performance metrics — DORA](https://dora.dev/guides/dora-metrics/)
2. [Deploying with GitHub Actions — GitHub Docs](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)
3. [Rate limits for the REST API — GitHub Docs](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
4. [REST API endpoints for deployments — GitHub Docs](https://docs.github.com/en/rest/deployments/deployments) (does not say whether listing works without authentication; measured instead)
