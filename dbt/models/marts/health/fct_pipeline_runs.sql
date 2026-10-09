-- Run history for the health panel: one row per pipeline step execution
-- (ADR-0020). System-level fields only; no error messages.

select
    run_id,
    job_name,
    run_status,
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
    code_version,
    error_type
from {{ ref('stg_ops__pipeline_runs') }}
