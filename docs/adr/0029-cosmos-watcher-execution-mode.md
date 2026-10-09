# ADR-0029: Run dbt through Cosmos in Watcher Execution Mode

**Date:** 2026-10-09
**Status:** Accepted (not yet implemented); supersedes the execution mode in ADR-0014

## Context

ADR-0014 chose Cosmos with `ExecutionMode.LOCAL`: every dbt model and test
becomes its own Airflow task, and each task starts its own dbt process. That
gives model-level visibility and retries, the reasons for choosing Cosmos.
The build measured in step 1.5 has 110 nodes (ADR-0022), so `LOCAL` would
start about 110 dbt processes per build, each paying dbt's start-up and
project parsing, on a free single VM (ADR-0016).

Researched on 2026-10-09 in the Cosmos documentation [1][2]:

- `ExecutionMode.WATCHER` was introduced as experimental in Cosmos 1.11.0 and
  is **stable since 1.15.0** (latest release 1.15.1) [1].
- A single producer task runs one `dbt build`; each model and test is still
  an Airflow task, a lightweight sensor that reports the node's status from
  the producer. Model-level visibility remains, and a failed node's task can
  be retried on its own: on retry it runs that node's dbt command directly
  [1].
- Cosmos reports up to 80% shorter DAG runs than `LOCAL` in its own
  benchmarks, and lower memory because only one dbt process runs [1]. These
  are Cosmos's numbers, not measured here.
- The producer works with dbt installed in a separate environment
  (`dbt_executable_path`, run as a subprocess) [1].
- A Cosmos `callback` fires once per DAG run on the producer and receives the
  whole project's `run_results.json` [2] — exactly the single artifact that
  `record-dbt-build` (ADR-0023) consumes.
- Known limitation: concurrent DAG runs can race; the workaround is
  `max_active_runs=1` [1], which ADR-0019 already requires.
- Consumer sensors are deferrable by default, so the stack needs Airflow's
  triggerer component [1].

## Decision

dbt runs through Cosmos with `ExecutionMode.WATCHER`, `dbt_executable_path`
pointing at `dbt_venv` (ADR-0003), and the producer's callback handing the
build's `run_results.json` and `manifest.json` to the recording step
(ADR-0023). The Compose stack includes the triggerer. Everything else in
ADR-0014 stands: dbt 1.x below 2.0, Cosmos in the Airflow environment, dbt
only in `dbt_venv`.

## Rationale

Alternatives considered:

1. **Keep `ExecutionMode.LOCAL`.** Rejected: one dbt process per node, about
   110 per build, for the same visibility; and one `run_results.json` per
   task that ADR-0023's recorder would have to collect.
2. **A single `dbt build` task without Cosmos.** Rejected for the reasons in
   ADR-0014: no model-level visibility or retries in Airflow.

## Consequences

**Positive:**

- One dbt process per build on the VM; model-level visibility and retries
  kept.
- One `run_results.json` per build, recorded without collection logic.

**Negative / trade-offs:**

- A newer execution mode (stable for two minor releases); its retry
  behaviour differs from `LOCAL` (a producer retry does not re-run the
  build; failed nodes re-run individually).
- The triggerer is one more long-running component on the VM.
- The run-time and resource gains are Cosmos's measurements; step 1.7
  measures them on this project.

## References

1. [Watcher execution mode — astronomer-cosmos docs (GitHub source)](https://github.com/astronomer/astronomer-cosmos/blob/main/docs/guides/run_dbt/airflow-worker/watcher-execution-mode.rst) (read directly)
2. [Callbacks — astronomer-cosmos docs (GitHub source)](https://github.com/astronomer/astronomer-cosmos/blob/main/docs/guides/run_dbt/callbacks/callbacks.rst) (read directly)
3. [astronomer-cosmos — PyPI](https://pypi.org/project/astronomer-cosmos/) (release 1.15.1, 2026-08-04, read through the PyPI JSON API)
