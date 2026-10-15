-- One row per commit sent to production (ADR-0045, ADR-0046). Re-runs of the
-- deploy job and duplicate pushes collapse into the commit's first
-- successful deployment; failed attempts are counted beside it, and a commit
-- that never deployed keeps a row with no deployed_at. Lead time runs from
-- the change's first commit. Change failures come from the owner-kept seed:
-- a failure's recovery time runs from its detection to the recorded
-- recovery, or else to the deployment of the pull request that fixed it,
-- which is rework. A read-time view.

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
),

fixing as (
    select pull_request_number, min(deployed_at) as deployed_at
    from per_commit
    where pull_request_number is not null
    group by pull_request_number
),

recoveries as (
    select
        failures.failed_sha,
        timestamp_diff(
            coalesce(failures.recovered_at, fixing.deployed_at),
            failures.detected_at,
            second
        ) as recovery_seconds
    from failures
    left join fixing on failures.fixed_pull_request = fixing.pull_request_number
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
    recoveries.failed_sha is not null as is_change_failure,
    recoveries.recovery_seconds,
    per_commit.pull_request_number in (
        select fixed_pull_request from failures where fixed_pull_request is not null
    ) as is_rework
from per_commit
left join recoveries on per_commit.commit_sha = recoveries.failed_sha
