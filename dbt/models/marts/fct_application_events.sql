-- One row per application event (ADR-0024). Incremental: a run recomputes
-- only the applications that received mail in the last few loaded days,
-- from their full history, and merges them by key; the result equals a full
-- refresh. Days older than the lookback that are backfilled or replayed need
-- `--full-refresh` (CLAUDE.md, replaying history).

{{
    config(
        materialized='incremental',
        unique_key='event_key',
        incremental_strategy='merge',
        on_schema_change='fail',
    )
}}

with events as (
    select * from {{ ref('int_application_events_unioned') }}
    {% if is_incremental() %}
    where posting_key in (
        select posting_key
        from {{ ref('int_application_events_unioned') }}
        where source_received_date >= (
            select date_sub(
                max(source_received_date),
                interval {{ var('event_lookback_days') }} day
            )
            from {{ this }}
        )
    )
    {% endif %}
)

select
    {{ dbt_utils.generate_surrogate_key([
        'posting_key',
        'event_type',
        "if(event_type = 'application_submitted', null, event_date)",
    ]) }} as event_key,
    {{ dbt_utils.generate_surrogate_key(['posting_key']) }} as application_key,
    posting_key,
    event_type,
    event_date,
    is_inferred,
    source_received_date,
    source_key
from events
