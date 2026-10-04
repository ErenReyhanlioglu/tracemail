# TraceMail

A data system that runs continuously in the cloud. Every hour it processes the
job-application mailbox and manually saved job postings, shows the status of
applications, how well postings fit the profile, and which applications need
follow-up, and it measures its own operation and LLM quality and publishes
them on a public panel.

## Inputs

- **Application mailbox:** read automatically every hour (read-only: mail
  is never marked as read, moved, or deleted); job alerts,
  application confirmations, and company replies arrive here.
- **Capture button:** sends the full text of the posting open in the browser,
  along with an "I applied" flag.
- **Master profile:** a single hand-written file that describes experience at
  the level of evidence, with a context tag (internship, research, personal
  project). CVs do not enter the system.
- **LinkedIn data export:** uploaded manually, once to load history and
  occasionally to verify it.

## What the system does

1. Ingests new mail and saved postings into Cloud Storage in raw form; senders
   not on the allowlist are left out.
2. Extracts information from templated mail with rules; classifies
   non-templated replies with a cheap LLM.
3. In BigQuery, links posting, application, and reply events to company,
   channel, and date; deduplicates repeated records.
4. Runs two-step matching on postings that have full text: first extracts the
   requirements together with their original sentences from the posting, then
   uses a strong model to compare each one against the evidence in the master
   profile and give a verdict. The output has a fixed structure.
5. Computes each application's stage and waiting time, and flags those that
   need follow-up.
6. Measures its own operation: run history, parse rates, data tests.
7. Measures the LLM side: every call's model, prompt version, token count,
   duration, cost, and schema conformance are recorded; summarized over weekly
   windows, with a monthly budget cap enforced.

## LLM evaluation and monitoring

Model selection is done by measurement. On a hand-labeled golden set of 30–40
postings, two or three models and several prompt versions are compared on
accuracy, consistency, cost, and latency; results are kept in MLflow. Every
time a prompt changes, the same measurement runs in CI, and the change does not
pass if accuracy drops.

In production, quality is monitored through indirect signals: schema error and
retry rate, the share of verdicts with no supporting evidence, and drift in the
verdict distribution.

## Interface

One web application, publicly reachable, three roles.

- **Owner:** logs in from any device and network and sees five sections:
  overview, incoming postings, my applications, match reports, and health
  panel. The owner can create share links.
- **Guest:** opens a share link created by the owner and sees everything the
  owner sees, read-only, until the link expires. The owner sets the validity
  period when creating the link; links are not revoked individually. A guest
  sees third-party data in the owner's records (company correspondence,
  recruiter names); this is an accepted decision of the owner. A guest cannot
  create links.
- **Visitor:** anyone else. Only the health panel is live: what the system
  does, its architecture, run history, parse quality, tests, the LLM section
  (active model and prompt version, model comparison table, cost per report,
  weekly error rate), and the incident log. Run history is shown in two stacked views: the last
  24 hours with one bar per hourly run, and the last 30 days with one bar per
  day summarizing that day's runs. The other four sections appear as
  a blurred skeleton with an explanatory note; the API sends no data to that
  view.

A share link never stays in the address bar: on first use it is exchanged for
a session cookie with the same expiry, and the browser is redirected to a
clean URL.

## Tech stack

| Layer | Tool |
|---|---|
| Languages | Python, SQL, TypeScript |
| Orchestration | Apache Airflow |
| Runtime environment | Oracle Cloud Always Free ARM VM, Docker Compose |
| Network access | Cloudflare Tunnel for the public site (no open ports), Tailscale for SSH and deploys |
| Raw storage | Google Cloud Storage |
| Warehouse | BigQuery |
| Transformation and modeling | dbt |
| Backend | FastAPI (capture and interface endpoints) |
| Frontend | Next.js |
| LLM | Via Gemini Enterprise Agent Platform (formerly Vertex AI), two tiers; starting with Gemini, final choice by golden-set comparison |
| Matching | LLM evaluation with the full master profile as context (no retrieval); a local multilingual embedding model only for the phase-four rough fit ranking ([ADR-0001](docs/adr/0001-no-retrieval-in-matching-embeddings-only-for-rough-ranking.md)) |
| LLM evaluation | MLflow (experiment tracking), golden set |
| LLM call log | BigQuery table, weekly summary with dbt |
| CI/CD | GitHub Actions |
| Quality | pytest, dbt tests |
| Mail access | IMAP with an app password |

## Phases

- **Phase one, core:** mail collection, raw storage, data model, application
  status table, loading LinkedIn history, Airflow running hourly on the VM,
  CI/CD, and recording health metrics. Owner login and a minimal read-only
  application list on the public web app, so real data is visible from any
  device from the start. No LLM.
- **Phase two, intelligence:** reply classification, master profile, capture
  button and service, match report, golden set, model and prompt comparison,
  LLM call log, and the evaluation gate in CI.
- **Phase three, interface:** public health panel, the full four sections
  behind login, share links for guests, and blurred skeletons for visitors.
  Read-only.
- **Phase four, optional:** rough fit ranking for alert postings (title
  similarity to a profile summary, local embedding model), automatic
  text completion from companies' public job pages, follow-up email draft,
  manually adding events and notes from the interface, a "correct" option on
  reports.

## Out of scope

CVs entering the system, automatic scraping of LinkedIn pages, a trained model
and a model registry, a demo with fake data, a masked view of real data, a
separate observability stack, endpoint deployment, model tuning, lakehouse
formats, Kubernetes, and Azure.

## Known limits

- **Small volume:** with 5–10 LLM calls a day, daily rates are meaningless;
  monitoring uses weekly windows and raw counts.
- **The best measure of live quality arrives late:** the user's correction rate
  can only be measured with the "correct" option in phase four.
- **Reports are not comparable across postings:** each posting has a different
  number of items, and the score is not a probability of being hired.
- **BigQuery is oversized for this data volume:** the justification is learning
  the tool.
- **Developments outside of mail** cannot enter the system until phase four.
- **The button works only in a desktop browser**, and the system cannot know
  the text of a posting the user did not open.

## Open decisions

- The list of models to compare

## Competencies the project must deliver

This is a portfolio project. Demonstrating the competencies below through real
use is the reason the project exists. If shortcuts are taken during
implementation, the concrete counterparts of these items must not be skipped.

| Competency | Concrete counterpart in the project | Tool |
|---|---|---|
| Workflow orchestration | A DAG of interdependent steps that runs every hour; retries, idempotent tasks, backfill of history | Apache Airflow |
| Incremental ingestion | Pulling only records that arrived after the last run; never processing the same record twice | Airflow, IMAP |
| Raw data layer (data lake) | Storing source data unchanged; history can be regenerated from raw data when the parser changes | Google Cloud Storage |
| Analytical data warehouse | Separation of raw, cleaned, and analytical layers; columnar storage for analytical queries | BigQuery |
| Data modeling | Fact and dimension tables (star schema); deduplicating the same entity arriving from different sources; incremental models | dbt |
| Data quality | Schema and content tests, cross-source consistency checks, measuring parse success rate | dbt tests, pytest |
| Cloud fundamentals | Project and billing setup, service accounts with least privilege, secret management, budget and quota limits | GCP IAM, Oracle Cloud VM |
| Using a managed AI service | Calling the LLM through the cloud platform's own service; a single provider-independent interface | Gemini Enterprise Agent Platform (Vertex AI) |
| Structured LLM output | Output in a fixed schema instead of free text; schema validation and retry on failure | LLM, Pydantic |
| LLM evaluation | Hand-labeled golden set; comparing model and prompt versions on accuracy, consistency, cost, and latency | MLflow |
| CI/CD for ML/LLM | Evaluation runs automatically when a prompt or code changes, and the change is rejected if accuracy drops; successful changes are deployed to the server automatically | GitHub Actions |
| Live monitoring | Run history, data freshness, parse rates; logging LLM calls with model, prompt version, tokens, duration, and cost; weekly windows suited to small volume | BigQuery table, dbt |
| Incident management | Noticing that a component broke, fixing it, and documenting it with a short record | Health panel, incident log |
| Data privacy and access separation | Excluding sensitive sources at the ingestion stage; never sending data to an unauthorized view | Allowlist, FastAPI authentication |
| API design | Endpoints that receive data and serve data; authentication; caching | FastAPI |
| Portable deployment | The same definition runs locally and on the server; the environment comes up with a single command | Docker Compose |
| Going from data to decisions | Producing channel- and role-based rates from raw events; presenting findings in a readable interface | SQL, Next.js |

### Deliberately not covered

Model training and model registry, real-time model serving, lakehouse table
formats, distributed processing and large scale, Kubernetes, AWS, and Azure.
The project claims no competency in these areas.
