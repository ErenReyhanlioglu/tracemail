-- One row per execution of a pipeline step (ADR-0020). The error message is
-- left out on purpose: it can quote input, and nothing downstream needs more
-- than the error type (CLAUDE.md, Privacy).

with source as (
    select * from {{ source('ops', 'pipeline_runs') }}
)

select
    run_id,
    job_name,
    status as run_status,
    started_at,
    finished_at,
    duration_seconds,
    interval_start,
    interval_end,
    records_in,
    records_out,
    records_failed,
    bytes_in,
    bytes_out,
    schema_version,
    code_version,
    error_type,
    metrics
from source
