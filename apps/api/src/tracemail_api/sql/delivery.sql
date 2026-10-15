-- Delivery metrics for the health panel (ADR-0045, ADR-0046), apart from
-- the panel's main query: if the deployment data is missing or unreadable,
-- only this section is empty (incident 2026-10-14). Commits deployed in the
-- window; a commit that never deployed counts only through its failed
-- attempts. Reads two tables, so it is billed at least 20 MiB.
--
-- Parameters: @display_timezone, @window_days, @recent_deployments.

with deployments as (
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
        countif(recovery_seconds is not null) as recovered_failures,
        countif(is_rework) as rework_deployments,
        max(deployed_at) as last_deployed_at
    from deployments
)

select
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
