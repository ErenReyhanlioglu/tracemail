-- Free-tier use for the current month, per allowance, projected to the end of
-- the month (CLAUDE.md, 85% rule). The projection is what was used so far
-- plus the rate of the last projection_lookback_hours carried over the rest
-- of the month: one-off work earlier in the month (a backfill) counts once,
-- and a newly started steady state is not diluted by quieter earlier days.
--
-- Counts only what the pipeline records in its run records: ingestion and
-- parsing GCS operations (ADR-0017) and dbt's billed bytes (ADR-0023).
-- Ad-hoc queries and other tools are not included; the billing report remains
-- the ground truth. A read-time view.

with runs as (
    select
        started_at,
        case
            when job_name in ('ingest_mail', 'parse_mail')
                then coalesce(int64(metrics.gcs_lists), 0)
                + coalesce(int64(metrics.gcs_writes), 0)
        end as gcs_class_a,
        case
            when job_name = 'parse_mail' then coalesce(int64(metrics.gcs_reads), 0)
        end as gcs_class_b,
        case
            when job_name in ('dbt_build', 'dbt_node_retry')
                then coalesce(int64(metrics.bytes_billed), 0)
        end as bigquery_query_bytes
    from {{ ref('stg_ops__pipeline_runs') }}
    where started_at >= timestamp_trunc(current_timestamp(), month)
),

unpivoted as (
    select started_at, allowance, amount
    from runs
    unpivot (amount for allowance in (gcs_class_a, gcs_class_b, bigquery_query_bytes))
),

window_bounds as (
    select
        timestamp_sub(
            current_timestamp(), interval {{ var('projection_lookback_hours') }} hour
        ) as recent_since,
        timestamp_diff(
            timestamp(date_add(date_trunc(current_date(), month), interval 1 month)),
            current_timestamp(),
            second
        ) / 3600 as hours_left
),

allowances as (
    select 'gcs_class_a' as allowance, {{ var('free_tier_gcs_class_a') }} as monthly_free
    union all
    select 'gcs_class_b', {{ var('free_tier_gcs_class_b') }}
    union all
    select 'bigquery_query_bytes', {{ var('free_tier_bigquery_query_bytes') }}
),

totals as (
    select
        allowances.allowance,
        allowances.monthly_free,
        coalesce(sum(unpivoted.amount), 0) as used_to_date,
        coalesce(
            sum(if(unpivoted.started_at >= window_bounds.recent_since, unpivoted.amount, 0)),
            0
        ) as used_recently,
        any_value(window_bounds.hours_left) as hours_left
    from allowances
    cross join window_bounds
    left join unpivoted on allowances.allowance = unpivoted.allowance
    group by allowances.allowance, allowances.monthly_free
),

projected as (
    select
        *,
        used_to_date
        + used_recently / {{ var('projection_lookback_hours') }} * hours_left
            as projected_month
    from totals
)

select
    allowance,
    date_trunc(current_date(), month) as month_start,
    used_to_date,
    used_recently,
    round(projected_month) as projected_month,
    monthly_free,
    round(100 * projected_month / monthly_free, 1) as projected_percent,
    projected_month > monthly_free * {{ var('free_tier_action_share') }}
        as needs_optimization
from projected
