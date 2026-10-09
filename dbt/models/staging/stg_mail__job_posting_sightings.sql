-- One posting card seen in one message: renamed and keyed, nothing joined.

with source as (
    select * from {{ source('mail', 'job_posting_sightings') }}
)

select
    {{ dbt_utils.generate_surrogate_key(['source_key', 'position']) }} as sighting_key,
    source_key,
    received_date,
    parser_name,
    parser_version,
    template,
    position as card_position,
    job_id,
    title,
    company,
    location,
    flags,
    connections as connection_count,
    alumni as alumni_count,
    unrecognized_lines,
    context as sighting_context,
    context_value,
    related_job_id
from source
