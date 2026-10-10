-- One row per hour the hourly DAG should have covered, from the start of the
-- schedule to the last complete hour (ADR-0020: missed runs). An hour counts
-- as covered when an ingestion run recorded exactly that one-hour interval,
-- scheduled or backfilled. An hour with no record is missed: the machine was
-- off, the stack was down, or the run died before writing its record.
-- A read-time view, because "the last complete hour" moves (ADR-0022).

with expected as (
    select hour_start
    from unnest(generate_timestamp_array(
        timestamp('{{ var("hourly_schedule_start") }}'),
        timestamp_sub(timestamp_trunc(current_timestamp(), hour), interval 1 hour),
        interval 1 hour
    )) as hour_start
),

ingest_runs as (
    select
        interval_start as hour_start,
        array_agg(run_status order by started_at desc limit 1)[offset(0)]
            as run_status,
        count(*) as attempts
    from {{ ref('stg_ops__pipeline_runs') }}
    where job_name = 'ingest_mail'
        and timestamp_diff(interval_end, interval_start, minute) = 60
    group by interval_start
)

select
    expected.hour_start,
    ingest_runs.run_status,
    coalesce(ingest_runs.attempts, 0) as attempts,
    ingest_runs.hour_start is null as is_missed
from expected
left join ingest_runs on expected.hour_start = ingest_runs.hour_start
