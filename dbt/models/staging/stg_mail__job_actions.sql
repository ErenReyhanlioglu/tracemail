-- An owner action on a posting (applied, saved, viewed), as reported by one
-- message: renamed and keyed, nothing joined.

with source as (
    select * from {{ source('mail', 'job_actions') }}
)

select
    {{ dbt_utils.generate_surrogate_key(['source_key', 'job_id', 'action']) }}
        as action_key,
    source_key,
    received_date,
    parser_name,
    parser_version,
    template,
    job_id,
    action as action_type,
    action_date,
    title,
    company,
    location
from source
