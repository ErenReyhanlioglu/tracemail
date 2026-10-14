-- The public health panel in one query (ADR-0044): BigQuery bills at least
-- 10 MiB per query, so every section comes from one row of nested fields
-- instead of one query each. System-level values only: states, times,
-- durations, and counts; never an error message.
--
-- Parameters: @display_timezone (local dates), @window_days (the 30-day
-- strips), @stage_hours (the stage rows' hourly cells), @median_days (the
-- window of the median durations), @recent_deployments (the delivery list).

with recent_stages as (
    select *
    from fct_hourly_stages
    where hour_start >= timestamp_sub(
        timestamp_trunc(current_timestamp(), hour), interval @stage_hours hour
    )
),

runs as (
    select job_name, started_at, duration_seconds, run_status
    from fct_pipeline_runs
    where job_name in ('ingest_mail', 'parse_mail', 'load_landing', 'dbt_build')
),

last_runs as (
    select
        job_name,
        array_agg(
            struct(started_at, duration_seconds, run_status)
            order by started_at desc limit 1
        )[offset(0)] as last_run
    from runs
    group by job_name
),

medians as (
    select job_name, approx_quantiles(duration_seconds, 2)[offset(1)] as median_seconds
    from runs
    where run_status = 'COMPLETE'
        and started_at >= timestamp_sub(current_timestamp(), interval @median_days day)
    group by job_name
),

stage_cells as (
    select
        job_name,
        any_value(stage_order) as stage_order,
        array_agg(stage_state order by hour_start) as hours
    from recent_stages
    group by job_name
),

freshness_days as (
    select
        local_date,
        count(*) as hours,
        countif(is_on_time) as on_time,
        case
            when logical_or(hour_state in ('failed', 'missed')) then 'failed'
            when logical_or(hour_state = 'late') then 'late'
            else 'ok'
        end as state
    from fct_hourly_freshness
    -- Hours still pending are not judged yet (null is_on_time).
    where is_on_time is not null
        and local_date
        >= date_sub(current_date(@display_timezone), interval @window_days - 1 day)
    group by local_date
),

dbt_days as (
    select
        date(started_at, @display_timezone) as local_date,
        count(*) as builds,
        countif(run_status = 'COMPLETE') as builds_ok,
        if(logical_and(run_status = 'COMPLETE'), 'ok', 'failed') as state
    from fct_dbt_builds
    where date(started_at, @display_timezone)
        >= date_sub(current_date(@display_timezone), interval @window_days - 1 day)
    group by local_date
),

-- Delivery (ADR-0045): commits deployed in the window; a commit that never
-- deployed counts only through its failed attempts.
deployments as (
    select *
    from fct_deployments
    where deployed_at is null
        or date(deployed_at, @display_timezone)
        >= date_sub(current_date(@display_timezone), interval @window_days - 1 day)
),

delivery_days as (
    select
        date(deployed_at, @display_timezone) as local_date,
        if(logical_or(is_change_failure), 'failed', 'ok') as state
    from deployments
    where deployed_at is not null
    group by local_date
),

delivery as (
    select
        countif(deployed_at is not null) as deployments,
        sum(failed_attempts) as failed_attempts,
        approx_quantiles(lead_time_seconds, 2)[offset(1)] as median_lead_time_seconds,
        countif(lead_time_seconds is not null) as changes_with_lead_time,
        countif(is_change_failure) as change_failures,
        approx_quantiles(recovery_seconds, 2)[offset(1)] as median_recovery_seconds,
        countif(is_rework) as rework_deployments,
        max(deployed_at) as last_deployed_at
    from deployments
),

last_miss as (
    select max(hour_start) as hour_start
    from fct_hourly_freshness
    where not is_on_time
),

streak as (
    select count(*) as on_time_streak_hours
    from fct_hourly_freshness
    cross join last_miss
    where fct_hourly_freshness.is_on_time
        and (
            last_miss.hour_start is null
            or fct_hourly_freshness.hour_start > last_miss.hour_start
        )
),

-- Every section below is one row, so the final select joins them 1:1.
-- array_agg over no rows is null; the API reads null as an empty list.
sections as (
    select
        (select array_agg(last_run)[safe_offset(0)] from last_runs
            where job_name = 'ingest_mail') as last_ingest,
        (select array_agg(
            struct(
                stage_cells.job_name,
                last_runs.last_run.started_at as last_run_at,
                last_runs.last_run.run_status as last_run_status,
                last_runs.last_run.duration_seconds as last_duration_seconds,
                medians.median_seconds as median_duration_seconds,
                stage_cells.hours
            )
            order by stage_cells.stage_order
        )
        from stage_cells
        left join last_runs using (job_name)
        left join medians using (job_name)) as stages,
        (select array_agg(struct(local_date, state, hours, on_time) order by local_date)
            from freshness_days) as freshness_days,
        (select array_agg(struct(local_date, state, builds, builds_ok) order by local_date)
            from dbt_days) as dbt_days,
        (select array_agg(
            struct(
                started_at, run_status, tests, tests_passed, project_models,
                models_tested, models_documented
            )
            order by started_at desc limit 1
        )[safe_offset(0)] from fct_dbt_builds) as last_build,
        (select array_agg(
            struct(allowance, used_to_date, projected_month, monthly_free)
            order by allowance
        ) from fct_free_tier_usage) as resources,
        (select as struct * from delivery) as delivery,
        (select array_agg(struct(local_date, state) order by local_date)
            from delivery_days) as delivery_days,
        (select array_agg(
            struct(
                deployed_at, pull_request_number, pull_request_title,
                lead_time_seconds, is_change_failure
            )
            order by deployed_at desc limit @recent_deployments
        ) from deployments where deployed_at is not null) as recent_deployments
)

select sections.*, streak.on_time_streak_hours
from sections
cross join streak
