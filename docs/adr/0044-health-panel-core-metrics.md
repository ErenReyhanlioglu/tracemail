# ADR-0044: Health Panel Core — What to Measure and Show before Phase 2

**Date:** 2026-10-14
**Status:** Accepted (not yet implemented)

## Context

The site is public, and the health panel introduces the system but shows no
numbers (ADR-0040). SUMMARY.md places the panel in Phase 3, after the LLM
layer. The owner decided on 2026-10-14 to build the panel's core before
Phase 2, keeping the rest of Phase 3 (share links, private sections,
visitor skeletons) where it is, and decided two contents questions:

- **Application and posting counts stay private.** The panel shows the
  system's operation, not the size of the job search.
- **No unit-test count.** It exists only in CI; a number baked into the
  image would show the last deploy, not a live measurement.
- **Mail volume stays private** (messages ingested and excluded per day). It
  says something about the search's intensity and adds little to the
  system's health, which freshness and the run grid show.
- **No parse-quality section** in the core; decided when the mockup was
  reviewed. Parse outcomes stay in `ops` and the marts.
- **Order:** the core panel first, then delivery metrics (DORA), then the
  VM's usage, then Phase 2.

The data for most of the panel exists since Phase 1: run records in `ops`
(ADR-0017, ADR-0020), dbt node results (ADR-0023), parse outcomes per
template, the health views in `marts`, and free-tier usage. What is missing
is the layer that exposes them safely: `marts` authorized on `staging` and
`ops`, a public API router with whitelisted response schemas and the privacy
test, caching, and rate limiting (CLAUDE.md, API).

### Guidance (read on 2026-10-14)

**Pipeline reliability.**

- For data processing, Google recommends correctness and freshness over
  availability and latency as SLIs [2]. Freshness SLOs take three forms: "X%
  of data processed in Y", "the oldest data is no older than Y", or "the
  pipeline job has completed successfully within Y" [1].
- Measure end to end: per-stage SLOs alone don't capture "the end-to-end
  health of your system", and per-stage checks can miss corruption [1].
- Alert on symptoms, not causes [1].
- A pipeline dashboard links the system diagram to each stage's live status,
  shows historical runtimes "to reveal slowdowns that may foreshadow an
  outage", and tracks cost per stage [1]. Spotify's Datamon marks each
  hourly bucket as on time, late, or undelivered [1].
- Completeness: the share of records delivered, checked by comparing counts
  in and out [1][3].

**Data observability.** Sources agree on five pillars: freshness, volume,
schema, distribution, lineage [4][5]. Schema changes break consumers
downstream; volume checks catch missing or duplicated records and sudden
spikes or drops [4].

**Orchestrator.** Airflow 3.3.2 emits `dagrun.duration.success` and
`.failed`, `ti_failures` and `ti_successes`, `scheduler_heartbeat`,
`dag_processing.last_duration`, and `dagrun.schedule_delay`, the delay
between a run's scheduled and actual start [6]. Health endpoints can look
healthy while the scheduler is not working, so liveness is better judged by
runs actually completing [7].

**Data tests and freshness in dbt.** `dbt build` does not run source
freshness checks; freshness checks should run at least twice as often as the
tightest SLA [8].

**Delivery.** DORA tracks five software delivery metrics: deployment
frequency, lead time for changes, change fail rate, failed deployment
recovery time, and deployment rework rate [9][10]. MTTR has several
meanings and is not comparable across teams; pair time with impact and
recurrence [11].

**Public status pages.** Common content: component-level status named the
way users see the service, incident history with timestamps for detection,
investigation, fix, and resolution, and uptime windows (30, 60, or 90 days)
[12][13]. Status must come from real monitors, not manual updates; hiding
incidents undermines trust [12][13]. These are vendor sources.

**LLM (Phase 2).** OpenTelemetry's GenAI conventions (status: Development)
define `gen_ai.client.operation.duration` in seconds with the operation
name, provider, request and response model, and `error.type` as attributes,
and separate token usage metrics by input and output [14]. Practitioner
guides add schema-validation pass rate, cost per request by prompt version,
latency percentiles rather than averages, and drift against a rolling
baseline [15]. CLAUDE.md already requires weekly windows with raw counts.

**Presentation.** Dashboards give "at-a-glance information on which users
can act quickly"; use length and 2D position for quantities, avoid area,
angle, pies, and gauges, and use color only "to reinforce information that
is already communicated in a different way" [16]. An isolated value is hard
to read without a reference point such as a target or the prior period
[17].

### Presentation in real tools (seen on 2026-10-14)

Screenshots of public pages and the tools' own documentation:

- **Status pages** (GitHub Status, Claude Status, both Atlassian Statuspage):
  one row per component, named the way users see the service, with its
  current state as a word on the right ("Normal", "Operational"), a row of
  90 daily cells, and the uptime percentage between "90 days ago" and
  "Today". Past incidents are grouped by date, each with a title and a
  timeline of updates (Identified, Monitoring, Resolved) in UTC.
- **Cronitor** (scheduled-job monitoring): one row per job on a shared time
  axis; duration per execution as bars against a dashed threshold line, with
  missed runs marked in place; a header with the median duration and success
  rate, and a footer that counts only the exceptions ("1 failed · 1 over
  threshold · 1 missed"). Normal runs are a quiet neutral; color is kept for
  exceptions.
- **Healthchecks.io**: a job is judged by "Period is the expected time
  between pings" and "Grace Time is the additional time to wait before
  sending an alert when a check is late" [18]; its states are up, late, and
  down. An hourly job with one hour of grace is the 2-hour freshness SLO.
- **Grafana's state timeline**: one row per entity, "state regions" whose
  length is the time spent in each state, with each state's text and color
  set by value mappings [19].

What these share: rows for the things a reader recognizes, time running left
to right, the state as a word, color only for what is not normal, numbers
that state their window, and incidents told as timelines. What they avoid on
the data itself: icons per row, cards around every number, and gauges.

### What exists for each signal

| Signal | Source today | Public |
|---|---|---|
| Last successful run, time since | `ops.pipeline_runs`, `fct_job_freshness` | Yes |
| Hourly runs on time, late, missed, failed | `fct_hourly_runs`; lateness from `interval_start` against `started_at` | Yes |
| Daily summary over 30 days | `fct_pipeline_runs` | Yes |
| Run duration per stage over time | `duration_seconds` | Yes |
| Parse outcomes per template (parsed, failed, unclaimed) | parse outcomes (step 1.8) | Not in the core (owner decision) |
| Unrecognized card lines (schema drift) | `unrecognized_lines` on parsed rows | Not in the core (owner decision) |
| dbt tests per build | `fct_dbt_builds`, `dbt_node_runs` | Yes |
| Free-tier operations and query bytes | `fct_free_tier_usage` (ADR-0017) | Yes |
| GCS and BigQuery storage against their free tiers | not recorded yet | Yes |
| Estimated monthly cost | needs the price file of ADR-0017 | Later |
| VM CPU, memory, network against the 20% idle threshold | Oracle's monitoring, not recorded | After DORA, with its own ADR |
| Running version | short SHA and nearest tag baked into the image (ADR-0002) | Yes |
| Incident log | approved summaries in `docs/incidents/` | Yes, owner-approved |
| Mail volume (ingested, excluded) | run record counts | No (owner decision) |
| Delivery metrics (DORA) | GitHub deployments; not in BigQuery | After the core |
| LLM metrics | Phase 2 | Not yet |

## Decision

The core panel, before Phase 2:

1. **Status line**: whether the last hourly run succeeded and how long ago,
   in the owner's time zone, and the running version.
2. **Stage rows**: one row per pipeline stage (collection, parsing,
   loading, modeling) with its last 24 hourly cells, last processing run,
   and median duration. Serving has no row: the measurements render only
   when the API answers, so such a row could only ever say "up". The table's
   caption names where everything runs, Oracle Cloud.
3. **Freshness against a target**: the SLO "every hourly interval is
   processed within 2 hours", measured end to end from collection to the
   dbt build [1], with a 99% objective, its compliance over 30 days, and
   the count behind it. One cell per day shows the day's worst hour.
4. **dbt build**: one cell per day over 30 days (the day's worst build),
   successful builds out of all, and the last build's tests passed and
   models tested and documented.
5. **Resource usage**: all five free-tier allowances of CLAUDE.md's 85%
   rule as bars against their limits, with the month-end projection and the
   85% line of ADR-0017: GCS Class A and Class B operations, GCS storage
   (5 GB-months in `us-central1`, where the bucket is), BigQuery query bytes
   (1 TiB), and BigQuery storage (10 GiB) [20].
6. **Incident log** from approved summaries, each linking to its report.

Every cell uses one vocabulary: no problems; skipped, no new data; late;
failed; no record. A legend sits under each table. The 30-day rows follow
the status-page component row: name and one-line description, the result
at the right, a full-width strip, and the window under it.

The presentation follows the tools above: a status line rather than a
banner; one row per pipeline stage (collection, parsing, loading,
modeling) with its state as a word, the last 24 hourly cells, the
last run, and the median duration; successful cells in a muted green, as
status pages draw them, skipped ones in grey, and strong color only for
late, missed, or failed; every percentage with its count and
window; and incidents as dated timelines. Each cell's state is available as
text, not only as color.

Next, before Phase 2, **delivery metrics** (DORA [9]): GitHub deployment
records ingested into `ops` and shown beside the run history. After that,
the VM's CPU, memory, and network over 7 days against Oracle's 20%
idle-reclamation threshold; reading Oracle's monitoring needs new access, so
that step starts with its own ADR. Phase 2 adds the LLM section; until then
it shows nothing.

## Rationale

Alternatives considered:

1. **Phase 3 in full before Phase 2.** Rejected by the owner: share links and
   private sections prove less and would delay the LLM layer, the largest gap
   in the competency table.
2. **Panel after Phase 2, as planned.** Rejected by the owner: the site is
   public and live monitoring and incident management have no visible
   counterpart, while their data exists.
3. **Airflow's own metrics (StatsD or OpenTelemetry).** Not chosen: a
   separate observability stack is out of scope (CLAUDE.md); run records in
   `ops` show the same symptoms end to end.
4. **Percentages alone, or gauges and pies.** Rejected: small counts make
   percentages misleading, and radial charts read worse than bars [16].

## Consequences

**Positive:**

- Live monitoring and incident management get a public, measured
  counterpart while the LLM layer is built.
- The public API layer, authorization, caching, and rate limiting exist
  before Phase 2, which then only adds an LLM section.

**Negative / trade-offs:**

- The LLM layer, the largest gap in the competency table, starts later by
  the length of the core panel and the delivery metrics.
- The rest of Phase 3 keeps its place, so the phase is split across the
  roadmap.
- Revisit the freshness target once 30 days of compliance are measured.

**How it is built and what was measured (2026-10-14):**

- An hour's stages are matched by run: ingestion records the hourly
  interval, the later steps record day intervals, so a step belongs to the
  scheduled run that started it, in the hour after the interval. dbt's
  outcome is its last record in that hour, so a node that failed and passed
  on Cosmos's own retry (ADR-0029) counts as built. On prod data the first
  build's failed node passed at 16:43, before that hour's 17:00 deadline:
  34 of 34 hours on time, while the dbt row still shows 11 of 12 builds
  passed.
- BigQuery bills at least 10 MiB per query and per table it references
  [21]; measured: a query of the run records processed 5 KB and was billed
  10 MiB. A query of `__TABLES__` metadata alone was billed 0, but the same
  metadata inside a query that reads a table added 10 MiB per dataset
  (60 MiB for the free-tier view). The panel therefore runs two queries:
  one for everything from the run records (billed 10 MiB, measured in dev)
  and one for storage metadata (billed 0).
- The API caches the panel per half-hour window starting five minutes past
  the hour and the half hour, so BigQuery is read at most twice an hour
  whatever the traffic: about 14 GiB a month, 1.3% of the query free tier
  (an expectation from the measured 10 MiB; to be confirmed from the run
  of a month).
- GCS storage is the sum of bytes the pipeline wrote: exact for the
  write-once raw zone (102,614,771 bytes in the run records against
  102,614,771 in the bucket), an upper bound for the parsed zone, whose
  rewrites count each time (1,735,300 recorded against 1,686,024 stored).
  BigQuery storage has no recorded history, so it shows the current size
  without a projection. Recording it would need the ingestion account to
  read metadata in the dbt datasets or an incremental model that cannot be
  rebuilt from raw; neither is worth it at 1.6 MB of 10 GiB.
- `tm-api` still reads only `marts`: `marts` is an authorized dataset on
  `landing`, `ops`, `staging`, and `intermediate`, and `staging` on `ops`
  ([infra/gcp](../../infra/gcp/README.md)).
- A stage with no record yet is pending, not missed, until the hour's
  deadline, and the SLO judges the hour only after that. Without it, a read
  between a run's start and its record showed the latest hour as missed
  (seen on 2026-10-14, when the panel was read seconds before a dbt build
  recorded itself).
- The prod schedule started on 2026-10-12 15:00 UTC; with the dev start
  date, prod counted 67 hours before it existed as missed. The start is now
  set per dbt target.

## References

1. [Data Processing Pipelines — Google SRE Workbook](https://sre.google/workbook/data-processing/)
2. [SLIs for data processing services — Google Cloud Observability](https://docs.cloud.google.com/stackdriver/docs/solutions/slo-monitoring/sli-metrics/data-proc-metrics) (known from search-result summaries)
3. [Example SLO document — Google SRE Workbook](https://sre.google/workbook/slo-document/) (known from search-result summaries)
4. [What is data observability: the five pillars — Conduktor](https://conduktor.io/glossary/what-is-data-observability-the-five-pillars) (known from search-result summaries)
5. [Data observability — Databricks glossary](https://www.databricks.com/glossary/data-observability) (known from search-result summaries)
6. [Metrics configuration — Apache Airflow 3.3.2 documentation](https://airflow.apache.org/docs/apache-airflow/stable/administration-and-deployment/logging-monitoring/metrics.html)
7. [Airflow ops best practices: observation and monitoring — Packt](https://packtpub.com/en-cl/learning/how-to-tutorials/airflow-ops-best-practices-observation-and-monitoring) (known from search-result summaries; written for Airflow 2.x)
8. [Source freshness — dbt documentation](https://docs.getdbt.com/docs/deploy/source-freshness)
9. [DORA's five metrics — CD Foundation](https://cd.foundation/blog/2025/10/16/dora-5-metrics/) (known from search-result summaries)
10. [The DORA 4 key metrics become 5 — DEV Community](https://dev.to/_steve_fenton_/the-dora-4-key-metrics-become-5-1ceg) (known from search-result summaries)
11. [Incident response metrics — Rootly](https://rootly.com/incident-response/metrics) (known from search-result summaries)
12. [Status page best practices — Sentivel](https://www.sentivel.com/guides/status-page-best-practices) (vendor; known from search-result summaries)
13. [Status page best practices — Enterno](https://enterno.io/en/articles/status-page-best-practices) (vendor; known from search-result summaries)
14. [Generative AI metrics — OpenTelemetry semantic conventions for GenAI](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-metrics.md)
15. [Preventing silent failures in production LLMs — Latitude](https://latitude.so/blog/preventing-silent-failures-in-production-llms) (vendor; known from search-result summaries)
16. [Dashboards: making charts and graphs easier to understand — Nielsen Norman Group](https://www.nngroup.com/articles/dashboards-preattentive/)
17. [Dashboard design best practices — Packt](https://www.packtpub.com/en-es/learning/how-to-tutorials/dashboard-design-best-practices) (known from search-result summaries)
18. [Configuring checks — Healthchecks.io documentation](https://healthchecks.io/docs/configuring_checks/)
19. [State timeline — Grafana documentation](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/state-timeline/)
20. [Free cloud features and trial offer — Google Cloud](https://docs.cloud.google.com/free/docs/free-cloud-features) (read on 2026-10-14; it does not say whether BigQuery's free storage counts logical or physical bytes)
21. [BigQuery pricing — Google Cloud](https://cloud.google.com/bigquery/pricing) (the page could not be read on 2026-10-14; the 10 MiB minimum is confirmed by the measurements above)
