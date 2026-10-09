-- Every place a posting is mentioned: a card in a mail, an owner action, or
-- an employer update. One row per mention; the basis for one row per posting.

with sightings as (
    select
        parser_name as posting_source,
        job_id,
        title,
        company,
        location,
        received_date,
        source_key,
        'sighting' as mention_type
    from {{ ref('stg_mail__job_posting_sightings') }}
),

actions as (
    select
        parser_name as posting_source,
        job_id,
        title,
        company,
        location,
        received_date,
        source_key,
        concat('action_', action_type) as mention_type
    from {{ ref('stg_mail__job_actions') }}
),

updates as (
    select
        parser_name as posting_source,
        job_id,
        title,
        company,
        location,
        received_date,
        source_key,
        concat('update_', update_type) as mention_type
    from {{ ref('stg_mail__application_updates') }}
)

select * from sightings
union all
select * from actions
union all
select * from updates
