-- The end-to-end freshness SLO per hourly interval (ADR-0044, Google SRE
-- "X% of data processed in Y"): an hour is on time when every stage that ran
-- or should have run finished successfully within freshness_target_hours of
-- the hour's start, so mail that arrived at the start of the hour reached the
-- marts in time. The hour's state is its worst stage. A read-time view.

with stages as (
    select * from {{ ref('fct_hourly_stages') }}
)

select
    hour_start,
    date(hour_start, '{{ var("display_timezone") }}') as local_date,
    case
        when logical_or(stage_state = 'failed') then 'failed'
        when logical_or(stage_state = 'missed') then 'missed'
        when logical_or(stage_state = 'late') then 'late'
        else 'ok'
    end as hour_state,
    logical_and(stage_state in ('ok', 'skipped')) as is_on_time
from stages
group by hour_start
