# Roadmap

Build order and current position. Scope per phase is defined in
[SUMMARY.md](../SUMMARY.md); decisions in [adr/](adr/README.md).

**Current phase:** Phase 1 — Core
**Current step:** 1.5 (`feat/dbt-core-models`) — 1.0 to 1.4 done

Each step is one branch and one or more pull requests. A step is done when its
"Done when" line is true on `main`.

---

## Phase 1 — Core

Goal: real mail flows from the mailbox to an application list the owner can
open from any device, running hourly in production. No LLM.

| Step | Branch | What | Done when |
|---|---|---|---|
| 1.0 | — | Owner setup (local): see checklist A | Public repo exists with branch protection |
| 1.1 | `chore/skeleton` | Full tree with stubs (ADR-0004), uv workspace, `dbt/` as its own uv project, ruff/mypy/pytest config, justfile, `.gitignore`, `.env.example`, CI (lint, typecheck, test) | `just check` passes locally and in CI |
| 1.2 | `feat/imap-ingest` | Read-only IMAP fetch by date window (ADR-0007), sender allowlist, write-once raw objects to the dev bucket (ADR-0006) | A real day of mail lands in `raw/`; rerunning the same day writes nothing new; mailbox shows no change |
| 1.3 | `feat/parsers-linkedin` | LinkedIn parser for all five templates seen in real mail (alert, application confirmation, viewed / saved reminders, suggestions), `parsed/` JSONL with partition overwrite (ADR-0018), `message_parse_outcomes`, redacted fixtures, raw inventory command | Parser tests pass, including a "changed template" fixture |
| 1.4 | `feat/landing-load` | BigQuery load jobs into `landing` (partition replace), run-record rows in `ops` | Loading the same interval twice leaves identical tables |
| 1.5 | `feat/dbt-core-models` | Sources, staging, intermediate dedup, marts: applications, events, companies, channels; application stage, waiting time, follow-up flag; dbt test results to `ops` | `dbt build` passes on dev with tests; an application's stage is correct for a hand-checked sample |
| 1.6 | `feat/linkedin-history` | LinkedIn export through the same raw → parsed → landing path, merged with mail-derived applications | Historical applications appear once, not duplicated against mail |
| 1.7 | `feat/airflow-stack` | Airflow image with three environments (ADR-0003), hourly DAG with `external_python` tasks and Cosmos (ADR-0013, ADR-0014), local Compose stack; decide ADR-0021 | Stack runs locally end-to-end; a backfill of past days works; hourly runs stay within the GCS free tier |
| 1.8 | `feat/more-parsers` | Parsers for the other sources seen in real mail (company replies, Workable, Lever, hrpanda, ...); decide how sent mail (direct applications) enters ingestion | Parse-success rate per template is recorded; unclaimed mail is counted as "other" |
| 1.9 | `feat/api-owner-auth` | FastAPI: Google Sign-In (ADR-0015), owner session, read endpoint for applications, `/health`, public/private privacy test | Owner logs in on localhost; any other account is refused; privacy test passes |
| 1.10 | `feat/web-application-list` | Next.js standalone app: login, minimal read-only application list, design tokens | Owner sees real applications in the browser locally |
| 1.11 | `ci/deploy` | Prod GCP project, Oracle VM, Tailscale, Cloudflare Tunnel, `arm64` build to GHCR, deploy workflow, GitHub → GCP via WIF (ADR-0009, ADR-0010, ADR-0012, ADR-0016) | A merge to `main` deploys; the site is reachable on the domain with no open inbound ports |
| 1.12 | — | Phase exit | Hourly runs succeed in production for a sustained period; owner cuts `v0.1.0` (ADR-0002) |

### To verify during Phase 1

These are recorded as unverified in ADRs; each is checked at the step named.

- ~~IMAP `SINCE` / `BEFORE` and `BODY.PEEK` behave as expected on Gmail — 1.2~~
  Verified 2026-10-07: a 2026-10-01..07 run listed 114 messages, wrote 62, and
  unread mail stayed unread in the mail client.
- `external_python` subprocess inherits environment variables — 1.7
- Cosmos DAG-parsing load is acceptable on the VM — 1.7 / 1.11
- Oracle web-console emergency access works when Tailscale is down — 1.11
- Free Ampere capacity in `eu-frankfurt-1` — 1.11

### Follow-ups

- Landing load spends ~5 s per run checking tables (ADR-0019) — monitor,
  optimize later.
- Alert yield metric (which alerts lead to saved / applied postings) — after
  1.5, not urgent.

### Decisions still needed in Phase 1

- **GCS operations under hourly runs** — [ADR-0021](adr/0021-gcs-operations-under-hourly-runs.md)
  (Proposed) — before 1.7 is done.
- **UI copy language** (Turkish or English) — before 1.10.

---

## Owner checklists

Things only the owner can do. Each lists the first step that needs it.

### A. Before 1.1

- [x] `git init`, create a **public** GitHub repository
- [x] Branch protection on `main`: pull requests required, required status
      checks (added once CI exists), no bypass for admins, no approval
      requirement (ADR-0002)
- [x] Actions policy: require actions pinned to full commit SHAs (ADR-0012)

### B. Before 1.2

- [x] Gmail app password for IMAP
- [x] Initial sender allowlist (domains / addresses of job platforms and
      companies)
- [x] GCP billing account and the **dev** project (`us-central1`), budget
      alert (ADR-0010, ADR-0011)
- [x] Two-step verification or a passkey on the Google account

### C. Before 1.3

- [x] A few real sample mails per template, redacted together before they
      enter the repository

### D. Before 1.9

- [ ] OAuth client in the dev project (redirect URI on `localhost`)

### E. Before 1.11

- [ ] Domain (`.com` or `.com.tr`, cheapest first year); if `.com.tr`, confirm
      nameserver delegation to Cloudflare first (ADR-0016)
- [ ] Cloudflare account, domain DNS moved to Cloudflare
- [ ] Oracle Cloud account, home region `eu-frankfurt-1` (ADR-0016)
- [ ] Tailscale account (free Personal plan)
- [ ] GCP **prod** project, budget alert, OAuth client for the production
      domain

---

## Phase 2 — Intelligence (outline)

Reply classification for unclaimed mail; master profile (owner-written);
capture button and endpoint; two-step match report with verbatim quotes and
substring verification; golden set (owner-labeled); model and prompt
comparison in MLflow; LLM call log and monthly budget cap; CI eval gate.
Open decision: which models to compare. Ends with `v0.2.0`.

## Phase 3 — Interface (outline)

Public health panel (24-hour and 30-day run views, parse quality, tests, LLM
section, incident log); the full four private sections; share links for
guests; visitor skeletons. Ends with `v0.3.0`.

## Phase 4 — Optional (outline)

Rough fit ranking with local embeddings (ADR-0001); text completion from
public job pages; follow-up drafts; manual events and notes; a "correct"
option on reports.
