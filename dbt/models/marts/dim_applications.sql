-- One row per application with its current status: the status set by the
-- latest status-setting event, ties on the same day broken by precedence
-- (ADR-0024). Values that depend on today's date live in
-- dim_application_status, not here (ADR-0022).

with events as (
    select * from {{ ref('fct_application_events') }}
),

statuses as (
    select * from {{ ref('event_type_statuses') }}
),

postings as (
    select * from {{ ref('dim_postings') }}
),

per_application as (
    select
        events.application_key,
        any_value(events.posting_key) as posting_key,
        max(if(events.event_type = 'application_submitted', events.event_date, null))
            as applied_on,
        logical_or(
            events.event_type = 'application_submitted' and events.is_inferred
        ) as is_submission_inferred,
        array_agg(
            statuses.sets_status ignore nulls
            order by events.event_date desc, statuses.status_precedence desc
            limit 1
        )[safe_offset(0)] as current_status,
        max(events.event_date) as last_event_date,
        count(*) as event_count
    from events
    left join statuses on events.event_type = statuses.event_type
    group by events.application_key
)

select
    per_application.application_key,
    per_application.posting_key,
    postings.company_key,
    postings.posting_source as channel,
    postings.title,
    postings.location,
    per_application.applied_on,
    per_application.is_submission_inferred,
    per_application.current_status,
    per_application.last_event_date,
    per_application.event_count
from per_application
left join postings on per_application.posting_key = postings.posting_key
