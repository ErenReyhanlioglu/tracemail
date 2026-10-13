# ADR-0037: dbt Build in CI on Dev Data through Workload Identity Federation

**Date:** 2026-10-13
**Status:** Accepted (not yet implemented)

## Context

CI checks Python and the web app, not SQL. A dbt model or test that breaks
reaches `main`, deploys, and fails in prod's next hourly build, after which
the marts stop updating. CLAUDE.md asks for a dbt build on a CI target on
every push, and for GitHub Actions to reach GCP through Workload Identity
Federation, never a stored key. Until now CI had no GCP access at all.

Measured in prod's run records (2026-10-12 and 13): a full `dbt build`
processes about 3.5 MB but bills about 1,190 MB. BigQuery bills "a minimum
10 MB data processed per table referenced by the query, and ... a minimum
10 MB data processed per query" [1], and a build runs about 119 queries
(models and tests). Cost is set by the number of queries, not by data
volume. Prod builds about six times a day (only when landing changed,
ADR-0022): about 210 GB a month, 21% of the 1 TiB query allowance shared
by both projects (ADR-0036).

Workload Identity Federation (verified 2026-10-13):

- google-github-actions/auth prefers direct federation, without a service
  account, and warns to always add an attribute condition to the pool [2].
- Google's best practices recommend mapping and conditioning on attributes
  that cannot change or be reused, such as a stable ID rather than a name,
  and checking that a token comes from a trusted tenant for multi-tenant
  issuers such as GitHub; they describe the application impersonating a
  dedicated service account [3].
- Google's table of federated-identity support lists BigQuery as generally
  available with no API limitations, but describes workforce (user)
  federation; whether dataset-level grants accept workload `principalSet`
  identities is not stated there [4].
- GitHub's OIDC token carries `repository_id` and `repository_owner_id`,
  the immutable IDs already in this repository's subject (ADR-0035,
  `infra/vm/README.md`).

## Decision

- **Where:** the dev project. The CI target (`dbt/profiles.yml`, target
  `ci`) reads dev's `landing` and `ops` and builds into `ci_staging`,
  `ci_intermediate`, and `ci_marts`; `generate_schema_name` prefixes `ci_`
  for this target, so a CI run cannot write any dataset a dev or prod build
  uses. Every run is a `--full-refresh`. Tables in `ci_*` expire after seven
  days.
- **When:** every push to `main` and every pull request from this
  repository's branches, as CLAUDE.md asks. Runs are serialized (one
  concurrency group), since they share the `ci_*` datasets. The image build,
  and with it the deploy, waits for this job.
- **Identity:** a workload identity pool `github` in the dev project with
  one OIDC provider whose condition admits only this repository by its
  numeric IDs (`repository_owner_id`, `repository_id`); it impersonates a
  dedicated service account `tm-ci-dbt` with BigQuery Job User on the project,
  Data Viewer on `landing` and `ops`, and Data Editor on the `ci_*`
  datasets. Nothing in prod. Set up by `infra/gcp/setup-ci.sh`; the
  provider's resource name and the account's email are GitHub repository
  variables, not secrets.

## Rationale

1. **CI against prod.** Rejected: the code under test is unreviewed by
   definition; with prod's permissions a broken model, or this job's
   `--full-refresh`, could overwrite the tables the site reads. A credential
   handed to pull-request code should reach dev at most (ADR-0010), and
   integration work never touches prod (CLAUDE.md, Testing).
2. **`dbt build --empty`** (schema-only, no rows). Rejected: it checks that
   SQL compiles and runs but makes every data test pass on empty tables;
   dev's real data tests the logic as well.
3. **Build only when `dbt/` changes.** Rejected: CLAUDE.md asks for every
   push, and at about 1.2 GB a run the cost is small (below).
4. **Direct federation without a service account.** Rejected for now: the
   documentation read does not confirm dataset-level `principalSet` grants
   in BigQuery [4], and a dedicated account matches the per-role accounts
   of ADR-0009 and Google's own guidance [3]. Revisit if direct access is
   documented for dataset grants.
5. **A service account key in GitHub secrets.** Ruled out by CLAUDE.md.
6. **A dataset per pull request with deferral to prod (dbt "slim CI").**
   Rejected for now: per-PR datasets and a prod manifest add moving parts a
   single-owner repository does not need; serialized runs suffice. Revisit
   if pull requests start waiting on each other.

## Consequences

**Positive:**

- SQL errors and failing data tests block a pull request instead of prod's
  next hourly build.
- GitHub reaches GCP with short-lived credentials only; the pool admits one
  repository by immutable IDs, and the account it maps to can touch dev's
  `ci_*` datasets and read nothing in prod.

**Negative / trade-offs:**

- Cost: about 1.2 GB billed a run; at about 50 runs a month, about 60 GB
  (6% of the query allowance), about 27% together with prod's builds.
  Expected, to be measured from the CI account's jobs.
- Dev's data is frozen while dev runs on demand (ADR-0036). A pull request
  whose models need a field a parser just added fails until the affected
  days are replayed in dev; that replay is part of developing such a
  change.
- CI logs are public. dbt logs counts and SQL, never rows; nothing in the
  job may print query results.
- Pull requests from forks skip this job, and with it the image builds.
- The CI run adds about two minutes before images build on `main`.

## References

1. [BigQuery pricing — Google Cloud](https://cloud.google.com/bigquery/pricing) (downloaded and read 2026-10-13: on-demand minimum bytes per query and per table)
2. [google-github-actions/auth — GitHub](https://github.com/google-github-actions/auth)
3. [Best practices for using Workload Identity Federation — Google Cloud](https://docs.cloud.google.com/iam/docs/best-practices-for-using-workload-identity-federation)
4. [Identity federation: products and limitations — Google Cloud](https://docs.cloud.google.com/iam/docs/federated-identity-supported-services)
