# CLAUDE.md — TraceMail

## Project Overview

TraceMail is a cloud-hosted data system that processes a job-application
mailbox and manually captured job postings every hour. It tracks application
status, matches postings against a hand-written profile, flags applications
that need follow-up, and publishes its own operational and LLM-quality metrics
on a public health panel.

This is a **portfolio project**. The competency table at the end of
[SUMMARY.md](SUMMARY.md) is the reason the project exists. When a shortcut is
tempting, it must not remove the concrete evidence for any competency in that
table. If a shortcut would do that, stop and ask.

- Product scope, phases, out-of-scope list, known limits:
  [SUMMARY.md](SUMMARY.md)
- UI reference (static mockups, hardcoded data — design reference only):
  [docs/interface_concept/](docs/interface_concept/)
- Technical decisions: `docs/adr/`. Read `docs/adr/README.md` (the index) at
  the start of every session. Open an individual ADR only when its topic comes
  up.
- Current phase and build order: `docs/roadmap.md`.

When a decision listed under "Open decisions" in SUMMARY.md gets made, record
it as an ADR. Do not silently pick one in code.

### ADRs

Every significant architectural decision is recorded in `docs/adr/` at the
moment it is made — not drafted ahead of time. File naming:
`NNNN-short-title.md`, zero-padded and sequential. Add a row to the index in
`docs/adr/README.md` in the same change. An accepted ADR is never rewritten
to reflect a new decision; write a new ADR that supersedes it and update the
old one's status.

A problem that is understood but not yet decided is written as a **Proposed**
ADR: findings, options, and sources are recorded when they are found, and the
status changes to Accepted when the choice is made. `docs/roadmap.md` only
links to ADRs; it never holds their content.

State what was actually verified (a dry run, a measured number, a test) and
what is still an assumption — never present an assumption as a measurement.

Every external source a decision relies on is cited: numbered markers in the
text (`[1]`) and a `## References` section at the end. Mark sources that could
not be read directly (for example, "returned HTTP 403; known only from
search-result summaries") and prefer official documentation over secondary
articles. For security- and pricing-related decisions, research current
sources before deciding — do not decide from memory.

```markdown
# ADR-XXXX: Title

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Accepted (not yet implemented) | Deprecated | Superseded by ADR-XXXX

## Context
Why did we need to make this decision?

## Decision
What did we decide to do?

## Rationale
Why this option over the alternatives? List each alternative and why it was
rejected.

## Consequences
**Positive:** ...
**Negative / trade-offs:** ... (including when to revisit)

## References
1. [Title — Publisher](URL)
```

---

## Language

- Everything written to a file is in English: code, identifiers, comments,
  docstrings, Markdown, ADRs, commit messages, log messages, error messages.
- Conversation with the owner happens in Turkish. That never leaks into files.
- **Exception, undecided:** the language of user-facing UI copy (the mockups are
  in Turkish). Ask before writing UI strings until an ADR settles it.

---

## Phase Discipline

- Work belongs to the current phase in `docs/roadmap.md`. Do not build
  features from a later phase "while we're here".
- Phase 1 has **no LLM**. No LLM SDK dependency, prompt file, or LLM call
  enters the codebase before Phase 2.
- Anything in SUMMARY.md's out-of-scope list (Kubernetes, lakehouse formats,
  model training, model registry, endpoint deployment, a separate
  observability stack, AWS, Azure, fake-data demo) is not proposed as a
  solution. If one seems necessary, say so and explain why instead of adding
  it.
- The mockups contain invented numbers and companies. They are layout
  references. **Never seed, fixture, or demo the real system with invented
  data.** The public panel shows real data or nothing.

---

## Repository Layout

Monorepo, per ADR-0004. Keep the boundaries: each directory owns one concern.

```
packages/pipeline/   IMAP fetch, allowlist, raw writes, parsers, loads
packages/llm/        Phase 2: provider interface, prompts, call logging, budget
packages/evals/      Phase 2: golden set, evaluation runner, MLflow logging
apps/airflow/        Dockerfile + dags/ (wiring only — no business logic)
apps/api/            FastAPI: owner/guest read endpoints, capture endpoint
apps/web/            Next.js app
dbt/                 dbt project; its own uv project and lockfile
profile/             Hand-written master profile (owner-authored)
infra/               Docker Compose, VM setup, IAM notes
docs/                ADRs, roadmap
```

- Python packages under `packages/` use the `src/` layout and share the
  workspace `uv.lock`. `dbt/` is deliberately not a workspace member.
- Python environments are isolated per ADR-0003: Airflow (constraints only),
  `pipeline_venv` (run via `@task.external_python`), `dbt_venv`. Pipeline code
  never imports Airflow and receives plain arguments, not Airflow context.
- **Stubs:** the full tree exists from the start. A stub file contains only a
  module docstring naming the phase that implements it (for example,
  `"""Reply classification. Implemented in Phase 2."""`). No placeholder
  functions, no `pass` bodies, no `TODO`, and no later-phase dependencies in
  any lockfile.

---

## Python: General Rules

- Python 3.12+. Type annotations on every parameter and return value.
- `X | None`, never `Optional[X]`. `X | Y`, never `Union[X, Y]`.
- Pydantic for every structure that crosses a boundary (parsed mail, API
  schemas, LLM output, config). No TypedDict, no dataclass for those.
- No magic numbers or strings — named constants. Thresholds that define
  product behaviour (follow-up silence window, budget cap, allowlist) live in
  config, not in code.
- Every module has a docstring explaining what it does.
- f-strings only (except in logging calls — see Logging).
- Max function length ~30 lines; split deeply nested logic even below that.
  Cyclomatic complexity enforced with ruff `C901`.
- Max file length 300 lines.
- `ruff format` + `ruff check` (incl. `I` for imports), `mypy --strict`.
- File paths built from `Path(__file__).parent`, never relative to CWD —
  the same code runs on Windows locally, in containers, and in CI.
- Dependencies only via `uv add` / `uv remove`. `uv.lock` is always committed.
- Common commands go in a `justfile` (`just --list`): lint, format, typecheck,
  test, `check` (all of them), `up`/`down` for the Compose stack, dbt targets.

### Forbidden

- `global` variables, mutable default arguments, `from x import *`
- `print()` — use the logger
- Bare `except`
- `assert` for runtime validation — raise a real exception
- `TODO` comments — fix it or open an issue
- Commented-out code
- Hardcoded URLs, ports, bucket names, dataset names, project IDs, credentials
- `datetime.now()` / `date.today()` to decide **which data** to process (see
  Airflow). Reading the wall clock only to **record** when something happened
  (a run record's `started_at` / `finished_at`) is allowed; durations use
  `time.perf_counter`.
- Python's built-in `hash()` for anything persisted — use `hashlib.sha256`

---

## Error Handling

- Custom exception classes per domain (`ImapFetchError`, `ParseError`,
  `LlmBudgetExceededError`, ...).
- Add `try/except` only when both are true: (1) there is real I/O (IMAP,
  GCS, BigQuery, LLM, HTTP), and (2) there is a meaningful action on failure
  (retry, skip-and-record, fallback, user message). Config loading and object
  construction fail fast.
- Wrapping: `raise NewError(...) from e`. Re-raising after cleanup: plain
  `raise`.
- **A parse failure is data, not a crash.** One unparseable mail must not
  fail the run. Record it (message id, parser, parser version, reason)
  so it counts against the parse-success metric, and continue.
- Inside Airflow tasks, let transient errors propagate so Airflow's retry
  policy handles them. Do not write retry loops inside a task that Airflow
  already retries.

---

## Configuration and Secrets

- One Pydantic `Settings` per package. Required production values have no
  default — a missing value fails at startup, never falls back to a
  plausible-looking local value.
- Every `Settings` class sets `hide_input_in_errors=True` and every secret field
  is `SecretStr`. `SecretStr` only masks after validation succeeds; without
  `hide_input_in_errors`, a failed validation prints every raw input value,
  secrets included.
- Values not yet consumed by any code path are not added to `Settings` yet.
  A field becomes required in the same change that starts using it.
- Secrets (IMAP app password, service account keys, API auth secret) come
  from environment / mounted files on the VM. Never in the repo, never in
  logs, never in Docker image layers.
- Never read, print, or modify `.env` or key files.
- VM → GCP uses per-role service account key files (ADR-0009), mounted into
  containers, never in an image layer. GitHub Actions → GCP uses Workload
  Identity Federation; never add a key to GitHub secrets.
- **Least privilege:** one service account per role, each with only the
  roles it needs:
  - ingestion → write to the raw and parsed zones only
  - transform (dbt) → BigQuery job user + data editor on its datasets
  - api → BigQuery read on mart datasets only
  - llm (Phase 2) → the LLM platform user role only
  Never reuse a broad key "to get it working". If a permission is missing,
  name the exact role that is needed.

---

## Privacy and Access Separation

The mailbox contains third-party personal data (recruiter names, addresses,
company correspondence). This section overrides convenience.

- **Allowlist at ingestion.** A mail from a sender that is not on the
  allowlist is never written to GCS, never logged beyond a count. Filtering
  later is not acceptable — what is not stored cannot leak.
- **Logs:** never log mail bodies, subjects, sender addresses, or posting
  text. Log internal ids (hashed Message-ID, GCS object key) and counts.
- **Test fixtures** derived from real mail are redacted by hand before they
  enter the repo (names, addresses, phone numbers, links with tokens).
  Never commit a raw `.eml` from the real mailbox.
- **Three roles** (see SUMMARY.md, Interface): owner, guest, visitor.
  Private endpoints accept an owner session or a valid guest session and
  nothing else. Guest sessions are strictly read-only and can never create
  share links. A guest seeing third-party data is an accepted owner decision —
  do not add masking for guests.
- **Owner login** is Google Sign-In (`openid`, `email` only), handled entirely
  by the API (ADR-0015). The owner is matched by Google's `sub`, read from
  server configuration — never by email, never from the repository. Next.js
  contains no authentication logic; it forwards the session cookie
  server-side.
- **Share links** are signed and carry their own expiry; there is no
  per-link revocation. Rotating the signing secret invalidates all of them at
  once. On first use the link is exchanged for a session cookie (`HttpOnly`,
  `Secure`, `SameSite=Lax`, same expiry) and the browser is redirected to a
  clean URL, so the token never stays in the address bar, history, or
  referrer. Responses set `Referrer-Policy: no-referrer`.
- **Public vs. private API.** Public endpoints (health panel) live in their own
  router and return only system-level aggregates. Their response schemas are
  explicit whitelists. Visitor views of the four private sections receive
  **no data at all** — the blurred skeletons are static shapes in the
  frontend, not real data rendered blurry.
- A test asserts that every public endpoint's response schema contains no
  field from the private domain (company, role, sender, posting text, profile
  evidence, run `error_message`). Adding a public endpoint without passing this test is a blocker.
- Do not paste real mail or posting content into docs, ADRs, issues, or
  commit messages.

---

## Raw Layer (Google Cloud Storage)

- Raw data is immutable. Objects are written once and never overwritten or
  edited. Use a create-only precondition (`if_generation_match=0`).
- Object keys are deterministic so a rerun writes the same key and the
  precondition turns a duplicate into a no-op, e.g.
  `raw/mail/received_date=YYYY-MM-DD/<sha256(Message-ID)>.eml`. The partition
  is the message's own received date (IMAP internal date, UTC), never the run
  date — a run date would give the same message different keys on different
  days. Captured postings and LinkedIn exports follow the same pattern under
  their own prefixes.
- Store the original bytes (`.eml`, original export file), not a parsed
  version.
- Flow: `raw/` (original bytes) → parse in `pipeline_venv` → `parsed/` (JSONL)
  → BigQuery load job into `landing` → dbt. The `parsed/` zone exists for
  debugging: it must always show exactly what the parser understood from each
  source record.
- `parsed/` uses **partition overwrite** (ADR-0018):
  `parsed/<record_type>/received_date=YYYY-MM-DD/data.jsonl`, one file per
  record type per day, rewritten whole when that day is parsed again.
  `parser_name` and `parser_version` live on every row, never in the path.
  Only `raw/` is write-once.
- Any parser change must be replayable: the whole analytic layer can be
  rebuilt from raw. Never introduce a step whose output cannot be regenerated
  from GCS.

---

## Ingestion and Parsing

- **Incremental IMAP by date window, no stored watermark.** Each run fetches
  mail whose IMAP internal date falls in its own data interval, widened by one
  day on each side for timezone slack (`SINCE` / `BEFORE` are day-granular).
  Overlap is harmless: the write-once raw keys turn re-fetched mail into
  no-ops. This is what makes backfill of any past range work; do not
  introduce a "last UID" bookmark.
- **The mailbox is never modified.** Open it read-only (`EXAMINE`, i.e.
  `select(..., readonly=True)`) and fetch with `BODY.PEEK[]`, never `BODY[]`,
  so no message is marked as read. The system never sets or clears flags,
  moves, archives, or deletes mail. A test asserts that the fetch command
  uses `PEEK` and the mailbox is opened read-only.
- **Dedup key** for mail is the Message-ID. Mail without one gets a sha256 of
  the raw bytes.
- **Parsers are rule-based.** One parser per source (LinkedIn, Workable,
  Lever, hrpanda, ...), each with a `PARSER_VERSION` constant. A source with
  several templates shares one structure reader and describes each template
  as a small spec (LinkedIn: `parse/parsers/linkedin/templates.py`); adding a
  template is a spec, a redacted fixture, and a test — no new reader.
- Templates are identified by a language-independent marker where one exists
  (LinkedIn's `urn:li:page:<id>`). Language-dependent phrases live in one
  module per source (`phrases.py`), never scattered through code.
- Record schemas are template-independent: new templates add values, never
  columns. Unrecognized card lines are kept in `unrecognized_lines`, never
  dropped — a non-empty value is a data-quality signal to investigate.
- Every message yields exactly one `message_parse_outcomes` row (parsed /
  failed / unclaimed, with reason). Parse-quality metrics come from it.
- Every parsed row carries `parser_name` and `parser_version`. Bump the version
  on any change that can alter output, then re-parse the affected range.
- Every parser has fixture tests built from redacted real samples, including
  at least one "template changed" sample that must fail gracefully, not
  produce wrong data silently.
- Anything no parser claims goes to the "other" bucket. In Phase 1 it stays
  unclassified; in Phase 2 it goes to the LLM classifier.
- All timestamps stored in UTC. Mail dates are parsed with their offset.
  Conversion to `Europe/Istanbul` happens only at presentation.

---

## Airflow

- DAG files contain wiring only — imports, task definitions, dependencies.
  Logic lives in `packages/` and is unit-tested there.
- No I/O at DAG file top level (the scheduler parses these files constantly).
- Use the TaskFlow API.
- **Every task is idempotent.** Running the same data interval twice produces
  the same end state. Tasks read their time window from the data interval,
  never from the wall clock — this is what makes backfill work.
- Retries with exponential backoff on tasks that touch the network.
- The ingestion DAG runs **hourly**; its data interval is one hour. The IMAP
  date window is still day-granular (see Ingestion), so each hourly run
  re-lists the day's mail and skips what is already in `raw/`.
- `catchup` is set explicitly on every DAG, never left to the default.
- The ingestion DAG sets `max_active_runs=1`: runs reload overlapping windows,
  so two at once could interleave partition writes (ADR-0019).
- Executor: `LocalExecutor` with the Postgres metadata DB. No Celery, no Redis.
  The stack must fit the Always Free ARM VM.
- Airflow 3.3.x on Python 3.12, pinned to an exact patch version and installed
  with its constraint file (ADR-0013). Python 3.12 everywhere.
- dbt runs through Cosmos (`ExecutionMode.LOCAL`, `dbt_executable_path` →
  `dbt_venv`), one Airflow task per model and test (ADR-0014). Cosmos lives in
  the Airflow environment; dbt never does.
- Each run writes a run-record row (start, end, status, counts per stage) to
  BigQuery. The health panel is built from these rows, not from Airflow's
  metadata DB.

---

## BigQuery and dbt

- Datasets per layer: `landing` (parser output loaded from `parsed/`, one
  table per record type: `job_posting_sightings`, `job_actions`,
  `message_parse_outcomes`), `staging`, `intermediate`,
  `marts`, plus `ops` for run records, test results, and LLM call logs.
  There is no BigQuery `raw` dataset — raw data lives only in GCS.
- Load data with **batch load jobs from GCS**, not streaming inserts.
- Loads are idempotent: each run replaces exactly its own date partition in
  `landing`, never appends to it.
- Replaying history after a parser change means re-running the parse step over
  `raw/` (a backfill), then loading and `dbt build`. A dbt `--full-refresh`
  alone does not apply a parser change.
- dbt 1.x with `dbt-bigquery`, pinned below 2.0 until ADR-0014's revisit
  condition is met.
- Naming: `stg_<source>__<entity>`, `int_<entity>_<verb>`, `fct_<event>`,
  `dim_<entity>`.
- Staging: 1:1 with a source, rename/cast/clean only, no joins.
- Intermediate: entity resolution and dedup (the same application seen in a
  LinkedIn export, a confirmation mail, and a capture is one application).
- Marts: star schema. No `SELECT *` in marts.
- Surrogate keys are deterministic hashes of natural keys
  (`dbt_utils.generate_surrogate_key`), never random — reruns must produce the
  same keys.
- Every model has `unique` + `not_null` on its primary key. Sources declare
  `freshness`. Cross-source consistency checks are dbt tests, not ad-hoc
  queries.
- Incremental models declare `unique_key` and must produce the same result as
  `--full-refresh`.
- Large tables are partitioned by date with `require_partition_filter`.
- Cost guardrail: every BigQuery client sets `maximum_bytes_billed`. Before
  adding a query that scans more than the existing ones, dry-run it and state
  the bytes.
- Never write SQL by string concatenation with values — use query parameters.
- Read query results through the standard BigQuery API (row iteration), not
  the BigQuery Storage Read API: the Storage Read API is billed separately and
  the VM is on a different continent from the data (ADR-0011, ADR-0016). Do
  not add `google-cloud-bigquery-storage` as a dependency.

---

## LLM (Phase 2)

- All calls go through one provider-agnostic interface (`Protocol`). Switching
  model is a config change, not a code change.
- Two tiers: a cheap model for reply classification, a strong model for
  matching verdicts. Which models is decided by the golden-set comparison, not
  by preference.
- **Structured output only.** Every response is validated against a Pydantic
  schema. On validation failure: limited retries (count in config), then
  record the failure. Never accept free text as a fallback.
- **Every call is logged** to `ops.llm_calls`: model, prompt version, input and
  output tokens, latency, cost, schema-valid flag, retry count, run id. No
  call bypasses the logger, including in evals.
- **Budget cap** is checked before every call against the current month's
  logged cost. Over the cap → `LlmBudgetExceededError`, the item is skipped
  and recorded, the run continues.
- Prompts live in `packages/llm/prompts/` as text files with an explicit version in the
  filename. Changing prompt text means a new version, never an in-place edit.
- Timeout on every call.
- Never call a real LLM in unit tests.

### Matching Integrity

- Step 1 extracts requirements **with the verbatim sentence from the posting**.
  Step 2 gives each requirement a verdict (`met` / `partial` / `missing`) with
  evidence **quoted from the master profile**.
- Both quotes are verified programmatically as substrings of their sources
  (after whitespace normalization). A verdict whose evidence cannot be found
  is downgraded and counted in the "unsupported verdict" metric — it is never
  shown as supported.
- The report never presents a score as a hiring probability.
- **No retrieval.** The full master profile is passed as context on every
  verdict call. Do not add chunking, top-k selection, or any pre-matching
  step between requirements and evidence (ADR-0001).

### Master Profile

- `profile/` is written by the owner. Never edit its content, never "improve"
  wording, never add claims. Code may read and validate its format only.

### Golden Set and Evals

- The golden set is hand-labeled by the owner and is ground truth. **Never
  change a label, drop an example, or loosen a metric to make an eval pass.**
  If a label looks wrong, say so and let the owner decide.
- Every eval run is logged to MLflow with model, prompt version, accuracy,
  consistency (repeat runs), cost, and latency.
- The CI eval gate runs when anything under `packages/llm/` or
  `packages/evals/` changes, and fails if accuracy drops below the recorded baseline.
  It is the only place in CI that makes real LLM calls.

---

## Embeddings (Phase 4 Only)

See ADR-0001. Embeddings exist for one purpose: the rough fit ranking of
alert postings that have only a title.

- Phases 1–3 contain no embedding dependency, code, or infrastructure.
- No vector database. Vectors live in memory for the duration of the run;
  BigQuery stores only score, fit bucket, model name/version, and
  profile-summary version.
- The model is multilingual (Turkish and English titles), runs locally via
  ONNX runtime — no PyTorch in the image, no LLM call.
- High / Medium / Low thresholds come from calibration against owner-labeled
  titles, never hand-picked. The labels follow the same rule as the golden
  set: never edited to make a result look better.
- The profile summary is owner-written, same rules as `profile/`. Never
  generate it from the master profile.
- The UI keeps the rough ranking visually distinct from the evidence-based
  match report.

---

## API (FastAPI)

- Two roles of endpoints: **capture** (receives a posting's text and the
  "applied" flag from the browser button) and **read** (serves the UI).
- All endpoints `async def`. The Google Cloud clients are synchronous — wrap
  their calls with `asyncio.to_thread`, never block the event loop.
- Explicit Pydantic request and response schemas on every endpoint. Never
  return a raw BigQuery row.
- All routes under `/api/v1/`. Correct status codes (200, 201, 400, 401, 403,
  404, 422, 500). No stack traces or internal details in responses.
- Clients via `Depends()`, created once in `lifespan` and closed on shutdown.
  No module-level client instances.
- List endpoints are paginated.
- Read endpoints serve data that changes once a day: cache in process with a
  TTL keyed to the latest run id. No Redis.
- The capture endpoint authenticates the button with a secret token, validates
  size and content type, and writes to the raw bucket first (same rules as the
  raw layer), then returns.
- `/health` checks real dependencies (BigQuery reachability, bucket access).
  It never makes an LLM call.
- `GZipMiddleware` enabled. Rate limiting on public and capture endpoints.

---

## Frontend (Next.js)

- TypeScript `strict`. No `any`. No `@ts-ignore` without a written reason.
- Read-only UI (until Phase 4). No forms that write data.
- Private data is fetched server-side with the session; it never reaches a
  visitor's browser, not even hidden. Visitor skeletons are static.
- Design tokens come from the mockups: IBM Plex Sans / IBM Plex Mono, sidebar
  `#151A21`, accent `#1F4FD8`, background `#F5F6F8`, success `#0B6B57`, warning
  `#FCEBD0` / `#7A4300`. Define them once as tokens, not inline per component.
- Numbers use the mono font, as in the mockups.
- Every report screen keeps the disclaimer that the match report is overlap,
  not hiring probability.

---

## Testing

- `pytest` for Python, dbt tests for data. Coverage minimum **90%** on Python
  packages (`dags/` excluded; its logic lives in tested packages).
- Every parser, every service function, every privacy rule has tests.
- No real network in unit tests: IMAP, GCS, BigQuery, LLM are mocked or faked.
- Integration tests touch the real **dev** project only, carry
  `@pytest.mark.integration`, and are excluded from the default run
  (`just test`). Run them with `just test-integration`. They never touch prod.
- Check layers: lint + format (ruff), types (mypy), unit tests (pytest),
  integration tests (pytest, marked), data tests (dbt), and from Phase 2 the
  LLM eval gate.
- Tests are independent; shared state via fixtures.
- Test names say exactly what they verify:
  `test_linkedin_alert_parser_returns_parse_error_on_changed_template`, not
  `test_parser`.

---

## Logging and Monitoring

- `logging` module only. Use lazy formatting in log calls
  (`logger.info("Fetched %d messages", n)`), not f-strings.
- Levels: DEBUG detail, INFO normal flow, WARNING recoverable, ERROR failed.
- Never log secrets, environment values, or any field listed under Privacy.
- System monitoring lives in BigQuery `ops` tables summarized by dbt. Do not
  add Prometheus, Grafana, or a hosted observability tool.

### Performance and Cost Measurement (ADR-0017)

- **Every pipeline step returns a result model** with its duration
  (`time.perf_counter`), volume (seen / processed / skipped / failed, bytes
  written), and external operation counts per service (IMAP commands, GCS
  reads and writes, BigQuery bytes processed and billed from job statistics,
  LLM tokens). A new step without these is incomplete.
- The result is logged at INFO when the step finishes and, from step 1.4,
  written with the run record to `ops`.
- Cost is estimated from operation counts × unit prices kept in one config
  file, each price with its source URL and check date — researched, never
  from memory. Free-tier usage is reported alongside cost.
- **Optimizations are measured before and after.** Never claim a change is
  faster or cheaper without both numbers; until measured, call it an
  expectation.
- Metrics contain counts, durations, bytes, and internal ids only — never
  personal data.
- LLM metrics are reported over **weekly windows with raw counts** (n is tiny
  — a daily rate is noise). Never show a percentage without its count.

### Incidents

When something breaks in production and gets fixed, propose an entry for the
incident log: date, what broke, impact, fix, follow-up. Keep it to two lines,
in the same tone as the health panel mockup. The owner approves it before it
is published.

---

## Deployment

- Docker Compose is the single definition for local and the VM. The same
  `docker compose up` works in both; differences come only from env files.
- Images must build for `linux/arm64` (Oracle Ampere VM).
- GitHub Actions: lint + typecheck + tests + dbt build on a CI target on every
  push; the eval gate when its paths change; deploy to the VM only from `main`
  after all checks pass. Deployment never depends on a tag (ADR-0002).
- Images are tagged with the commit SHA. The short SHA and nearest tag are
  baked in at build time and exposed to the health panel; nothing calls `git`
  at runtime.
- Build and deploy follow ADR-0012: images built on a native `arm64` runner,
  published publicly to GHCR, deployed by a job that joins the tailnet via
  OIDC and runs the deploy script over SSH.
- SSH on the VM listens only on the Tailscale interface; never open port 22
  to the internet. No long-lived VM credential is stored in GitHub.
- The VM has **no inbound port open to the internet** (ADR-0016). Public web
  traffic arrives only through Cloudflare Tunnel (`cloudflared` runs in the
  Compose stack). Never propose opening 80/443 or any other port.
- Next.js runs on the VM as a standalone build in the same Compose stack. The
  site and the API share one hostname; the API is served under `/api/`.
- All third-party actions are pinned to full commit SHAs. Never use
  `pull_request_target`. The deploy job runs only on push to `main`, in the
  `production` environment.

---

## Git

- **The owner creates branches and commits. Never run `git commit`,
  `git push`, `git branch`, `git checkout -b`, or `git tag`.** Only the owner
  appears as an author on GitHub.
- When a change reaches a commit-worthy point, say so and propose a
  Conventional Commit message in English (`feat:`, `fix:`, `refactor:`,
  `test:`, `docs:`, `chore:`, `ci:`), one logical change per commit.
- **No `Co-Authored-By` or any other AI attribution** in proposed commit
  messages or PR descriptions.
- **`main` is always deployable and never receives direct commits.** Every
  change reaches `main` through a pull request that passes CI; branch
  protection enforces this. Never suggest a workflow that commits or pushes
  to `main` directly, not even for a one-line docs fix.
- When starting a new feature, suggest a branch name; the owner creates it.
- Tags and releases follow ADR-0002: one tag per phase, the owner cuts them.
  When a phase is complete or a meaningful fix lands, say so and draft the
  three-to-four-line GitHub Release note, including whether a dbt
  `--full-refresh` or a replay from raw is needed. No `CHANGELOG.md`.
- Never commit `.env`, key files, raw mail, or unredacted fixtures.
