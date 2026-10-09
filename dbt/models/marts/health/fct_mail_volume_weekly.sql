-- Weekly mail volume against recent history (ADR-0020 volume anomaly): a
-- complete week with far fewer messages than the weeks before it suggests a
-- silently broken mailbox connection. Weeks without mail count as zero.
-- Thresholds are variables; counts stay raw (weekly volume is small).

with weekly as (
    select
        date_trunc(received_date, isoweek) as week_start,
        count(*) as messages
    from {{ ref('stg_mail__parse_outcomes') }}
    group by week_start
),

complete_weeks as (
    select week_start
    from unnest(generate_date_array(
        (select min(week_start) from weekly),
        date_sub(
            date_trunc(current_date('{{ var("display_timezone") }}'), isoweek),
            interval 1 week
        ),
        interval 1 week
    )) as week_start
),

filled as (
    select
        complete_weeks.week_start,
        coalesce(weekly.messages, 0) as messages
    from complete_weeks
    left join weekly on complete_weeks.week_start = weekly.week_start
),

with_history as (
    select
        week_start,
        messages,
        avg(messages) over trailing as trailing_mean,
        count(*) over trailing as trailing_weeks
    from filled
    window trailing as (
        order by week_start
        rows between {{ var('volume_trailing_weeks') }} preceding and 1 preceding
    )
)

select
    week_start,
    messages,
    trailing_mean,
    trailing_weeks,
    trailing_weeks = {{ var('volume_trailing_weeks') }}
    and messages < trailing_mean * {{ var('volume_drop_ratio') }} as is_low_volume
from with_history
