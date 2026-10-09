-- Freshness per pipeline step (ADR-0020, Google SRE "completed successfully
-- within Y"): the last run, its outcome, and time since the last success.
-- A read-time view, because it depends on the current time (ADR-0022).

with runs as (
    select * from {{ ref('stg_ops__pipeline_runs') }}
)

select
    job_name,
    max(finished_at) as last_run_at,
    array_agg(run_status order by started_at desc limit 1)[offset(0)]
        as last_run_status,
    max(if(run_status = 'COMPLETE', finished_at, null)) as last_success_at,
    timestamp_diff(
        current_timestamp(),
        max(if(run_status = 'COMPLETE', finished_at, null)),
        hour
    ) as hours_since_last_success
from runs
group by job_name
