-- One row per finished production deployment attempt (ADR-0045). A commit
-- can have several: a re-run deploy job, or a duplicate push.

with source as (
    select * from {{ source('github', 'github_deployments') }}
)

select
    deployment_id,
    commit_sha,
    created_at,
    finished_at,
    state as deployment_state,
    workflow_run_id,
    pull_request_number,
    pull_request_title,
    merged_at,
    first_commit_at,
    source_key,
    parser_name,
    parser_version
from source
