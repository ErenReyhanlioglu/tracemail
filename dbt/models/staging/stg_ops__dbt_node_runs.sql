-- One row per dbt node executed in a build (ADR-0023).

with source as (
    select * from {{ source('ops', 'dbt_node_runs') }}
)

select
    {{ dbt_utils.generate_surrogate_key(['invocation_id', 'node_id']) }}
        as node_run_key,
    run_id,
    invocation_id,
    node_id,
    resource_type,
    status as node_status,
    started_at,
    execution_seconds,
    failures,
    bytes_processed,
    bytes_billed,
    slot_ms
from source
