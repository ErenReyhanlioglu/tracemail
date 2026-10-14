-- One row per commit sent to production (ADR-0045). Re-runs of the deploy
-- job and duplicate pushes collapse into the commit's first successful
-- deployment; failed attempts are counted beside it, and a commit that never
-- deployed keeps a row with no deployed_at. Lead time runs from the change's
-- first commit. Change failures and their fixes come from the owner-kept
-- seed: a fixing deployment is rework, and its recovery time runs from the
-- failure's detection. A read-time view.

with attempts as (
    select * from {{ ref('stg_github__deployments') }}
),

failures as (
    select * from {{ ref('deployment_failures') }}
),

per_commit as (
    select
        commit_sha,
        min(if(deployment_state = 'success', finished_at, null)) as deployed_at,
        countif(deployment_state != 'success') as failed_attempts,
        any_value(pull_request_number) as pull_request_number,
        any_value(pull_request_title) as pull_request_title,
        any_value(merged_at) as merged_at,
        any_value(first_commit_at) as first_commit_at
    from attempts
    group by commit_sha
)

select
    per_commit.commit_sha,
    per_commit.deployed_at,
    per_commit.failed_attempts,
    per_commit.pull_request_number,
    per_commit.pull_request_title,
    per_commit.merged_at,
    per_commit.first_commit_at,
    timestamp_diff(per_commit.deployed_at, per_commit.first_commit_at, second)
        as lead_time_seconds,
    failed.failed_sha is not null as is_change_failure,
    fixed.fixed_sha is not null as is_rework,
    timestamp_diff(per_commit.deployed_at, fixed.detected_at, second)
        as recovery_seconds
from per_commit
left join failures as failed on per_commit.commit_sha = failed.failed_sha
left join failures as fixed on per_commit.commit_sha = fixed.fixed_sha
