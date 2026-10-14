-- One row per expected hourly interval and pipeline stage (ADR-0044): what
-- the stage did for that hour, for the health panel's stage rows and the
-- end-to-end freshness SLO. A read-time view, because the last complete hour
-- moves (ADR-0022).
--
-- Ingestion records carry the hourly interval. The later steps record day
-- intervals (ADR-0018), so they are matched to the scheduled run that started
-- them: the run for hour h starts in hour h + 1. A stage is expected when the
-- one before it ran (parsing when ingestion wrote new mail, ADR-0022);
-- otherwise its absence is a skip. dbt's outcome is its last record in the
-- hour, a build or a node retry (ADR-0029), so a node that failed and passed
-- on retry counts as built.
--
-- Until the hour's deadline (freshness_target_hours after its start) a stage
-- with no record yet is pending, not missed: the run may still be going, or
-- writing its record. It is pending when it is expected or when a stage
-- before it is still pending; the SLO judges the hour only after that.

with hours as (
    select hour_start, is_missed
    from {{ ref('fct_hourly_runs') }}
),

runs as (
    select
        if(job_name = 'dbt_node_retry', 'dbt_build', job_name) as job_name,
        if(
            job_name = 'ingest_mail',
            interval_start,
            timestamp_sub(timestamp_trunc(started_at, hour), interval 1 hour)
        ) as hour_start,
        started_at,
        finished_at,
        run_status,
        records_out
    from {{ ref('stg_ops__pipeline_runs') }}
    where job_name in ('parse_mail', 'load_landing', 'dbt_build', 'dbt_node_retry')
        or (
            job_name = 'ingest_mail'
            and timestamp_diff(interval_end, interval_start, minute) = 60
        )
),

last_runs as (
    select
        job_name,
        hour_start,
        array_agg(
            struct(run_status, finished_at, records_out)
            order by started_at desc limit 1
        )[offset(0)] as last_run
    from runs
    group by job_name, hour_start
),

per_hour as (
    select
        hours.hour_start,
        ingest.last_run as ingest,
        parse.last_run as parse,
        load.last_run as load,
        dbt.last_run as dbt
    from hours
    left join last_runs as ingest
        on ingest.hour_start = hours.hour_start and ingest.job_name = 'ingest_mail'
    left join last_runs as parse
        on parse.hour_start = hours.hour_start and parse.job_name = 'parse_mail'
    left join last_runs as load
        on load.hour_start = hours.hour_start and load.job_name = 'load_landing'
    left join last_runs as dbt
        on dbt.hour_start = hours.hour_start and dbt.job_name = 'dbt_build'
),

open_stages as (
    select
        *,
        ingest is null as ingest_open,
        parse is null
        and (ingest is null or coalesce(ingest.records_out > 0, false)) as parse_open
    from per_hour
),

open_later as (
    select *, load is null and (parse is not null or parse_open) as load_open
    from open_stages
),

stages as (
    select hour_start, 'ingest_mail' as job_name, 1 as stage_order,
        ingest as last_run, true as is_expected, ingest_open as is_open
    from open_later
    union all
    select hour_start, 'parse_mail', 2, parse,
        coalesce(ingest.records_out > 0, false) or parse is not null, parse_open
    from open_later
    union all
    select hour_start, 'load_landing', 3, load, parse is not null, load_open
    from open_later
    union all
    select hour_start, 'dbt_build', 4, dbt, load is not null,
        dbt is null and (load is not null or load_open)
    from open_later
)

select
    {{ dbt_utils.generate_surrogate_key(['hour_start', 'job_name']) }} as stage_hour_key,
    hour_start,
    job_name,
    stage_order,
    last_run.run_status,
    last_run.finished_at,
    case
        when last_run.run_status is null and is_open
            and current_timestamp() <= timestamp_add(
                hour_start, interval {{ var('freshness_target_hours') }} hour
            ) then 'pending'
        when last_run.run_status is null and is_expected then 'missed'
        when last_run.run_status is null then 'skipped'
        when last_run.run_status != 'COMPLETE' then 'failed'
        when last_run.finished_at > timestamp_add(
            hour_start, interval {{ var('freshness_target_hours') }} hour
        ) then 'late'
        else 'ok'
    end as stage_state
from stages
