-- The end-to-end freshness SLO per hourly interval (ADR-0044, Google SRE
-- "X% of data processed in Y"): an hour is on time when every stage that ran
-- or should have run finished successfully within freshness_target_hours of
-- the hour's start, so mail that arrived at the start of the hour reached the
-- marts in time. The hour's state is its worst stage. An hour with a stage
-- still pending is not judged yet: is_on_time is null. A read-time view.

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
        when logical_or(stage_state = 'pending') then 'pending'
        else 'ok'
    end as hour_state,
    case
        when logical_or(stage_state in ('failed', 'missed', 'late')) then false
        when logical_or(stage_state = 'pending') then null
        else true
    end as is_on_time
from stages
group by hour_start
