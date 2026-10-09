-- Exactly one row per stored message: how parsing went (parsed, failed,
-- unclaimed) and how many records it produced. Basis of parse-quality metrics.

with source as (
    select * from {{ source('mail', 'message_parse_outcomes') }}
)

select
    source_key,
    received_date,
    outcome as parse_outcome,
    parser_name,
    parser_version,
    template,
    reason as failure_reason,
    sightings as sighting_count,
    actions as action_count,
    updates as update_count
from source
