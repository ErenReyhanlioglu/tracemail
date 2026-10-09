-- Read-time view of each application's waiting time (ADR-0024, ADR-0027).
-- It depends on today's date, so it is a view computed when read, never a
-- stored table (ADR-0022). "Today" is the owner's local date.
--
-- An open application (applied or in progress) is "silent" once it has had
-- no event for silence_days, which suggests a follow-up; after
-- closed_after_days without an event it is "closed without reply" and no
-- longer suggests one. Its stored status does not change.

{{ config(materialized='view') }}

with applications as (
    select * from {{ ref('dim_applications') }}
),

aged as (
    select
        application_key,
        current_status,
        last_event_date,
        current_status in ('applied', 'in_progress') as is_open,
        date_diff(
            current_date('{{ var("display_timezone") }}'), last_event_date, day
        ) as days_since_last_event
    from applications
)

select
    application_key,
    current_status,
    last_event_date,
    days_since_last_event,
    is_open
    and days_since_last_event >= {{ var('silence_days') }}
    and days_since_last_event < {{ var('closed_after_days') }} as is_silent,
    is_open
    and days_since_last_event >= {{ var('closed_after_days') }}
        as is_closed_without_reply
from aged
