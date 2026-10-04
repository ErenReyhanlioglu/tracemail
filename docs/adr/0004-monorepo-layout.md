# ADR-0004: Monorepo Layout

**Date:** 2026-10-03
**Status:** Accepted (not yet implemented)

## Context

The project contains Python packages, an Airflow deployment, a dbt project, a
FastAPI service, a Next.js app, infrastructure definitions, and docs. One
person maintains all of it, and changes often span several parts at once
(for example, a parser change plus the dbt model that reads its output).

Upstream conventions consulted:

- dbt Labs' structure guide: `models/staging`, `models/intermediate`,
  `models/marts`.
- Astronomer: DAG files contain only DAG, task, and dependency definitions;
  a dbt project may live in the same repository outside `dags/`.
- uv workspaces: one lockfile for many packages; `packages/` for libraries and
  `apps/` for deployables is a common convention.
- PyPA: the `src/` layout makes tests run against the installed package.
- Next.js: optional `src/` directory, config files and `public/` at the root.

## Decision

One repository:

```
tracemail/
├── pyproject.toml        # uv workspace root (virtual, no code)
├── uv.lock
├── justfile
├── .env.example
├── packages/             # Python libraries, src layout, own tests/
│   ├── pipeline/         # Phase 1: ingest, parse, load
│   ├── llm/              # Phase 2
│   └── evals/            # Phase 2
├── apps/                 # deployables
│   ├── airflow/          # Dockerfile, dags/ (wiring only)
│   ├── api/              # FastAPI
│   └── web/              # Next.js
├── dbt/                  # own uv project and lockfile (ADR-0003)
├── profile/              # owner-authored
├── infra/                # docker-compose.yml, VM setup
├── docs/                 # adr/, roadmap.md
└── .github/workflows/
```

The full tree is created up front with stubs. A stub contains only a module
docstring naming the phase that implements it. Later-phase dependencies are
not added until that phase.

Shared code (settings, logging, GCP clients) moves into `packages/core` when a
second package needs it, not before.

## Rationale

Alternatives considered:

1. **Multiple repositories (pipeline, dbt, api, web).** Rejected: one owner,
   cross-cutting changes, and a single CI gate for "main is always
   deployable" are all simpler in one repository.
2. **Flat layout (packages at the repository root, no `src/`).** Rejected:
   tests can silently import the working copy instead of the installed
   package.
3. **dbt project inside `dags/`.** Rejected: couples dbt to Airflow's parse
   path; Astronomer documents both, and keeping it outside matches ADR-0003's
   separate environment.

## Consequences

**Positive:**

- One place to look; one CI pipeline; one PR per cross-cutting change.
- Boundaries between concerns are visible in the tree.

**Negative / trade-offs:**

- Stubs for later phases exist before their code; they must stay
  docstring-only so they do not suggest functionality that does not exist.
- CI must use path filters so unrelated parts are not rebuilt on every change.

## References

1. [How we structure our dbt projects — dbt Labs](https://docs.getdbt.com/best-practices/how-we-structure/1-guide-overview)
2. [Manage Airflow code — Astronomer](https://www.astronomer.io/docs/learn/managing-airflow-code)
3. [DAG writing best practices — Astronomer](https://www.astronomer.io/docs/learn/dag-best-practices)
4. [Deploy dbt projects to Astro (dbt in the same repository, separate directory) — Astronomer](https://www.astronomer.io/docs/astro/deploy-dbt-project)
5. [How to set up a Python monorepo with uv workspaces — pydevtools](https://pydevtools.com/handbook/how-to/how-to-set-up-a-python-monorepo-with-uv-workspaces/)
6. [src layout vs flat layout — Python Packaging User Guide](https://packaging.python.org/en/latest/discussions/src-layout-vs-flat-layout/)
7. [Project structure — Next.js docs](https://nextjs.org/docs/app/getting-started/project-structure)
