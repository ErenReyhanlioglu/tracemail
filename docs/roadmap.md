# Roadmap

Build order and current position. Scope per phase is defined in
[SUMMARY.md](../SUMMARY.md); decisions in [adr/](adr/README.md).

**Current phase:** Phase 1 — Core
**Current step:** 1.11 (`ci/deploy`) — 1.0 to 1.5 and 1.7 to 1.10 done; 1.6
waits for the LinkedIn data export (checklist F). In 1.11, deploys from
`main` run in production since 2026-10-11
([infra/vm](../infra/vm/README.md#continuous-deployment)), and prod has run
hourly since 2026-10-12 with its history backfilled (ADR-0036); every push
runs a dbt build on dev data through Workload Identity Federation
(ADR-0037); the web app sends security headers and a nonce-based CSP
(ADR-0038). Still open: Cloudflare Tunnel and the production OAuth client
once the domain is active.

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
| 1.2 | `feat/imap-ingest` | Read-only IMAP fetch by date window (ADR-0007), sender allowlist (replaced by an exclusion list, ADR-0025), write-once raw objects to the dev bucket (ADR-0006) | A real day of mail lands in `raw/`; rerunning the same day writes nothing new; mailbox shows no change |
| 1.3 | `feat/parsers-linkedin` | LinkedIn parser for all five templates seen in real mail (alert, application confirmation, viewed / saved reminders, suggestions), `parsed/` JSONL with partition overwrite (ADR-0018), `message_parse_outcomes`, redacted fixtures, raw inventory command | Parser tests pass, including a "changed template" fixture |
| 1.4 | `feat/landing-load` | BigQuery load jobs into `landing` (partition replace), run-record rows in `ops` | Loading the same interval twice leaves identical tables |
| 1.5 | `feat/dbt-core-models` | Sources, staging, intermediate dedup, marts: applications (with a channel column), events, postings, companies; application status, waiting time, silence indicator (ADR-0024); dbt test results to `ops` (ADR-0023) | `dbt build` passes on dev with tests; an application's stage is correct for a hand-checked sample |
| 1.6 | `feat/linkedin-history` | LinkedIn export through the same raw → parsed → landing path, merged with mail-derived applications | Historical applications appear once, not duplicated against mail |
| 1.7 | `feat/airflow-stack` | Airflow image with three environments (ADR-0003), hourly DAG with `external_python` tasks and Cosmos (ADR-0013, ADR-0014), local Compose stack; dirty-day gating of parse, load, and dbt (ADR-0021, ADR-0022); missed-runs metric (ADR-0020) | Stack runs locally end-to-end; a backfill of past days works; hourly runs stay within the GCS free tier |
| 1.8 | `feat/more-parsers` | Further LinkedIn templates seen in real mail; a parser for another source only where the raw inventory shows enough volume; sent mail (direct applications) deferred to Phase 4 ([ADR-0031](adr/0031-sent-mail-is-a-phase-4-option.md)) | Parse health is recorded per LinkedIn template and for other senders combined; unclaimed mail is counted as "other" |
| 1.9 | `feat/api-owner-auth` | FastAPI: Google Sign-In (ADR-0015), owner session, read endpoint for applications, `/health`, public/private privacy test | Owner logs in on localhost; any other account is refused; privacy test passes |
| 1.10 | `feat/web-application-list` | Next.js standalone app: login, read-only application list, design tokens (ADR-0034); incoming postings list moved forward from Phase 3 without its later-phase columns (role type, rough fit, match report) | Owner sees real applications and incoming postings in the browser locally |
| 1.11 | `ci/deploy` | Prod GCP project, Oracle VM, Tailscale, Cloudflare Tunnel, `arm64` build to GHCR, deploy workflow, GitHub → GCP via WIF (ADR-0009, ADR-0010, ADR-0012, ADR-0016) | A merge to `main` deploys; the site is reachable on the domain with no open inbound ports |
| 1.12 | — | Phase exit | Hourly runs succeed in production for a sustained period; owner cuts `v0.1.0` (ADR-0002) |

### To verify during Phase 1

These are recorded as unverified in ADRs; each is checked at the step named.

- ~~IMAP `SINCE` / `BEFORE` and `BODY.PEEK` behave as expected on Gmail — 1.2~~
  Verified 2026-10-07: a 2026-10-01..07 run listed 114 messages, wrote 62, and
  unread mail stayed unread in the mail client.
- ~~LinkedIn sends application-viewed and rejection mails (ADR-0024) — 1.8~~
  Verified 2026-10-09 and moved ahead of 1.5: in 90 days of raw mail, 6 viewed
  and 4 rejection mails; both are HTML-only templates, parsed since parser
  version 3. No "resume downloaded" mail was seen.
- ~~`external_python` subprocess inherits environment variables — 1.7~~
  Verified 2026-10-09: a `dags test` run of the hourly DAG read IMAP, GCS, and
  BigQuery settings from the scheduler's environment inside `pipeline_venv`.
- ~~Cosmos DAG-parsing load is acceptable on the VM — 1.7 / 1.11~~
  Verified 2026-10-12: on the VM the DAG file parses in 1.6 s (6.6 s locally
  on amd64), and the DAG processor uses about 5% of a core re-parsing it
  every 30 s. No change needed.
- Oracle web-console emergency access works when Tailscale is down — 1.11
- ~~Free Ampere capacity in `eu-frankfurt-1` — 1.11~~
  Verified 2026-10-11: AD-3 had none; another availability domain did
  (`infra/vm/README.md`).
- The VM stays above Oracle's idle-reclamation threshold — 1.11
  After the first deploy (2026-10-11) the stack used about 16% of memory,
  below the 20% that, together with low CPU and network, marks an instance
  idle. Read the 95th percentiles from the instance metrics after a week of
  hourly runs; if all three stay below 20%, record the options in an ADR.
  With prod running (2026-10-12, one snapshot): memory about 24% in use
  (total minus available), CPU about 24% busy over a quiet minute.

### Follow-ups

- ~~OpenSSH on the VM listens on every interface~~ Fixed 2026-10-12:
  disabled and masked, nothing listens on port 22, Tailscale SSH unaffected
  (`infra/vm/README.md`, OpenSSH off).
- Every merge restarts the whole stack, documentation-only merges included,
  because each commit gets a new image tag (`infra/vm/README.md`). Harmless
  while tasks are idempotent; narrow the deploy trigger if restarts start to
  interrupt runs.
- Landing load spends ~5 s per run checking tables (ADR-0019) — monitor,
  optimize later.
- Alert yield metric (which alerts lead to saved / applied postings) — after
  1.5, not urgent.
- Web UX baseline before the site goes public: every state designed
  (loading, empty, error, not found), "last checked" time on the lists,
  WCAG 2.2 AA; desktop first, then a mobile layout as polished as the
  desktop; measured with Lighthouse and a manual pass before and after
  ([ADR-0039](adr/0039-web-ux-baseline.md)). Desktop done on 2026-10-13:
  page states, visitor routing to the health panel
  ([ADR-0040](adr/0040-viewer-routing-and-public-landing.md)), the
  collapsible sidebar ([ADR-0041](adr/0041-collapsible-sidebar-with-icons.md)),
  and the list toolbar with search and sorting
  ([ADR-0042](adr/0042-list-toolbar-and-status-groups.md)). Still open:
  the "last checked" time, the Lighthouse and manual pass after the
  changes, and the mobile layout. Seen 2026-10-11: an
  API 404 after a half-applied reload showed as "data unavailable".
  With the mobile layout: a web app manifest using the owner's 192, 512,
  and maskable 512 px icons (kept outside the repository until then); the
  standalone image must then also copy `public/`.

### Decisions still needed in Phase 1

None open. GCS Class A headroom was decided in
[ADR-0030](adr/0030-gcs-class-a-headroom.md) (option 2 implemented, option 1
deferred until the projection approaches 85% again).

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
      companies); replaced by the sender exclusion list (ADR-0025)
- [x] GCP billing account and the **dev** project (`us-central1`), budget
      alert (ADR-0010, ADR-0011)
- [x] Two-step verification or a passkey on the Google account

### C. Before 1.3

- [x] A few real sample mails per template, redacted together before they
      enter the repository

### F. Before 1.6

- [ ] LinkedIn full data archive (Settings → Data privacy → Get a copy of
      your data → the full archive; job applications are not offered as a
      separate file). Download it outside the repository; only the job
      application file will be ingested.

### D. Before 1.9

- [x] OAuth client in the dev project (redirect URI on `localhost`)

### E. Before 1.11

- [ ] Domain (`.com` or `.com.tr`, cheapest first year); if `.com.tr`, confirm
      nameserver delegation to Cloudflare first (ADR-0016). A `.com.tr`
      domain is registered; the registry's document check is pending.
- [ ] Cloudflare account, domain DNS moved to Cloudflare
- [x] Oracle Cloud account, home region `eu-frankfurt-1` (ADR-0016)
- [x] Tailscale account (free Personal plan); federated identity for the
      deploy job (`infra/vm/README.md`)
- [x] GCP **prod** project and budget alert (`infra/gcp/README.md`)
- [ ] OAuth client for the production domain (prod project)
- [x] GitHub `production` environment limited to `main`; image checks
      required on `main`

---

## Phase 2 — Intelligence (outline)

Reply classification for unclaimed mail; master profile (owner-written);
capture button and endpoint; two-step match report with verbatim quotes and
substring verification; golden set (owner-labeled); model and prompt
comparison in MLflow; LLM call log and monthly budget cap; CI eval gate.
Open decision: which models to compare. Ends with `v0.2.0`.

## Phase 3 — Interface (outline)

Public health panel (24-hour and 30-day run views, parse quality, tests, LLM
section, incident log); the remaining private sections (the application
and incoming-posting lists exist since step 1.10); share links for guests;
visitor skeletons. Ends with `v0.3.0`. The incident log is built from the
approved panel summaries in [incidents/](incidents/README.md), translated
into the Turkish UI strings (ADR-0033); one is waiting (2026-10-12).

## Phase 4 — Optional (outline)

Rough fit ranking with local embeddings (ADR-0001); text completion from
public job pages; follow-up drafts; manual events and notes; a "correct"
option on reports; direct applications from sent mail (ADR-0031).
