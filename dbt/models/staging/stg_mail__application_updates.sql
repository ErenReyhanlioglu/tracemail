-- An employer's reaction to an application (viewed, rejection), as reported
-- by one message: renamed and keyed, nothing joined.

with source as (
    select * from {{ source('mail', 'application_updates') }}
)

select
    {{ dbt_utils.generate_surrogate_key(['source_key', 'job_id', 'update_type']) }}
        as update_key,
    source_key,
    received_date,
    parser_name,
    parser_version,
    template,
    job_id,
    update_type,
    applied_on,
    title,
    company,
    location
from source
