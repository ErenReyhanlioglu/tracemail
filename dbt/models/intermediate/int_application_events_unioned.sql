-- Application events from every source, deduplicated (ADR-0024).
--
-- An application exists when the owner's confirmation arrived, or when an
-- employer update names it: an update carries the application date, so a
-- submission is inferred when its confirmation was never received (for
-- example, older than the ingested history). A real confirmation always wins
-- over an inferred one. Other events are deduplicated per day.

with submitted as (
    select
        parser_name as posting_source,
        job_id,
        'application_submitted' as event_type,
        action_date as event_date,
        false as is_inferred,
        received_date as source_received_date,
        source_key
    from {{ ref('stg_mail__job_actions') }}
    where action_type = 'applied'
),

inferred_submitted as (
    select
        parser_name as posting_source,
        job_id,
        'application_submitted' as event_type,
        applied_on as event_date,
        true as is_inferred,
        received_date as source_received_date,
        source_key
    from {{ ref('stg_mail__application_updates') }}
    where applied_on is not null
),

employer_updates as (
    select
        parser_name as posting_source,
        job_id,
        update_type as event_type,
        received_date as event_date,
        false as is_inferred,
        received_date as source_received_date,
        source_key
    from {{ ref('stg_mail__application_updates') }}
),

all_events as (
    select * from submitted
    union all
    select * from inferred_submitted
    union all
    select * from employer_updates
),

deduplicated as (
    select *
    from all_events
    qualify row_number() over (
        partition by
            posting_source,
            job_id,
            event_type,
            if(event_type = 'application_submitted', null, event_date)
        order by is_inferred, source_received_date, source_key
    ) = 1
)

select
    {{ dbt_utils.generate_surrogate_key(['posting_source', 'job_id']) }}
        as posting_key,
    posting_source,
    job_id,
    event_type,
    event_date,
    is_inferred,
    source_received_date,
    source_key
from deduplicated
