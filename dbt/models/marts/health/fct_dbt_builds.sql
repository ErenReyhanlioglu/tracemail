-- One row per recorded dbt build (ADR-0023): outcome, duration, tests, billed
-- bytes, and test and documentation coverage, from the build's run record.

with builds as (
    select *
    from {{ ref('stg_ops__pipeline_runs') }}
    where job_name = '{{ var("dbt_build_job") }}'
)

select
    run_id,
    started_at,
    run_status,
    duration_seconds,
    records_in as nodes,
    records_failed as nodes_failed,
    int64(metrics.models) as models,
    int64(metrics.tests) as tests,
    coalesce(int64(metrics.nodes_by_status.pass), 0) as tests_passed,
    int64(metrics.bytes_billed) as bytes_billed,
    int64(metrics.coverage.models_tested) as models_tested,
    int64(metrics.coverage.models_documented) as models_documented
from builds
