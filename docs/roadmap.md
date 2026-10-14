# Roadmap

Where the project stands and what comes next. Scope per phase is in
[SUMMARY.md](../SUMMARY.md), decisions in [adr/](adr/README.md), and the
evidence for finished work in the ADRs and READMEs they link. Each step is
one branch and one or more pull requests.

## Now

**Phase 1, step 1.12: phase exit.** Done when production runs 48 consecutive
hourly intervals with no missed run and no failed step; the owner then cuts
`v0.1.0` ([ADR-0043](adr/0043-phase-1-exit-criterion.md), ADR-0002). The
streak started at the 2026-10-12 17:00 UTC interval.

## Next

In this order ([ADR-0044](adr/0044-health-panel-core-metrics.md)):

1. **Health panel core**, ahead of Phase 2: one row per pipeline stage with
   its last 24 hours, the 2-hour freshness SLO against a 99% objective over
   30 days, dbt builds over 30 days, all five free-tier allowances against
   the 85% line, and the incident log. It needs `marts` authorized on
   `staging` and `ops`, a public API router with whitelisted schemas and the
   privacy test, caching, and rate limiting. Application, posting, and mail
   counts stay private.
2. **Delivery metrics (DORA)**: GitHub deployment records into `ops`, shown
   beside the run history.
3. **VM usage on the panel**: the Oracle VM's CPU, memory, and network over
   7 days against the 20% idle-reclamation threshold
   ([infra/vm](../infra/vm/README.md)), read from Oracle's monitoring. It
   needs new access to Oracle, so it starts with an ADR.
4. **Phase 2.**

Alongside:

- **Web before Phase 3** ([ADR-0039](adr/0039-web-ux-baseline.md)): the
  "last checked" time on the lists, which shares the health panel core's
  authorization; the Lighthouse and manual pass after the desktop changes;
  the mobile layout, with a web app manifest for the owner's 192, 512, and
  maskable icons (the image must then copy `public/`).
- **Watch the VM:** until the panel shows it (Next, item 3), read the 95th
  percentiles of CPU, network, and memory by hand after a week of hourly
  runs; if all stay below 20%, Oracle may reclaim the instance, so record
  the options in an ADR ([infra/vm](../infra/vm/README.md)). Oracle's
  web-console emergency access is still untested.

## Follow-ups

Not urgent; each is picked up when it starts to matter.

- Every merge restarts the stack, documentation-only merges included
  ([infra/vm](../infra/vm/README.md)); narrow the deploy trigger if restarts
  start to interrupt runs.
- The landing load spends about 5 s per run checking tables (ADR-0019).
- Alert yield metric: which alerts lead to saved or applied postings.
- The production OAuth client is in Google's Testing mode, so accounts that
  are not test users stop at Google's page instead of the login page's
  refusal (ADR-0040); publish it when that matters.
- `www.tracemail.com.tr` has no DNS record.

## Phase 1: Core

Real mail flows from the mailbox to an application list the owner can open
from any device, running hourly in production. No LLM.

| Step | What | State |
|---|---|---|
| 1.0 | Public repository with branch protection | Done |
| 1.1 | Skeleton, tooling, CI (ADR-0004) | Done |
| 1.2 | Read-only IMAP ingestion into write-once raw storage (ADR-0006, ADR-0007, ADR-0025) | Done |
| 1.3 | LinkedIn parsers, parsed zone, parse outcomes (ADR-0018) | Done |
| 1.4 | BigQuery landing loads and run records (ADR-0019, ADR-0020) | Done |
| 1.5 | dbt models: applications, events, postings, companies, status (ADR-0023, ADR-0024, ADR-0027) | Done |
| 1.6 | LinkedIn history | After `v0.1.0` |
| 1.7 | Airflow stack, hourly DAG, dirty-day gating (ADR-0003, ADR-0013, ADR-0021, ADR-0022, ADR-0029) | Done |
| 1.8 | More LinkedIn templates, parse health per template (ADR-0031) | Done |
| 1.9 | API with Google sign-in and the privacy test (ADR-0015, ADR-0032) | Done |
| 1.10 | Web app: login, application and posting lists (ADR-0033, ADR-0034) | Done |
| 1.11 | Production: VM, deploys, Cloudflare Tunnel, domain (ADR-0010, ADR-0012, ADR-0016, ADR-0035 to ADR-0038) | Done 2026-10-14 |
| 1.12 | Phase exit, `v0.1.0` (ADR-0043) | In progress |

## Phase 2: Intelligence

Reply classification for unclaimed mail; master profile (owner-written);
capture button and endpoint; two-step match report with verbatim quotes and
substring verification; golden set (owner-labeled); model and prompt
comparison in MLflow; LLM call log and monthly budget cap; CI eval gate.
Open decision: which models to compare. Ends with `v0.2.0`.

## Phase 3: Interface

The health panel's LLM section and whatever its core left out (the core
comes before Phase 2, ADR-0044); the remaining private sections; share
links for guests; visitor skeletons. Ends with `v0.3.0`.

## Phase 4: Optional

Rough fit ranking with local embeddings (ADR-0001); text completion from
public job pages; follow-up drafts; manual events and notes; a "correct"
option on reports; direct applications from sent mail (ADR-0031).
