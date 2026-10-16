"""Response schemas of the public health panel (ADR-0044, ADR-0050).

An explicit whitelist of system-level values: states, times, durations, and
counts. No field names a company, posting, sender, or error message, and the
privacy test checks every field reachable from here (CLAUDE.md, Privacy).
The panel comes in three parts, one per query, so each loads and fails on
its own: run records, BigQuery storage, and delivery. Each query returns one
row whose nested fields validate into its part; BigQuery aggregates over no
rows return null, which reads as an empty list.
"""

from datetime import date, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, field_validator

# Windows of the panel's sections (ADR-0044).
WINDOW_DAYS = 30
STAGE_HOURS = 24
MEDIAN_DAYS = 7
# Latest deployments listed under the delivery metrics (ADR-0045).
RECENT_DEPLOYMENTS = 5


class StageState(StrEnum):
    """What one stage did for one hourly interval."""

    OK = "ok"
    LATE = "late"
    FAILED = "failed"
    SKIPPED = "skipped"
    MISSED = "missed"
    # No record yet, before the hour's deadline: not judged.
    PENDING = "pending"


class DayState(StrEnum):
    """The worst hour or build of a day."""

    OK = "ok"
    LATE = "late"
    FAILED = "failed"


class LastRun(BaseModel):
    """The latest run of a step."""

    started_at: datetime
    duration_seconds: float
    run_status: str


class StageRow(BaseModel):
    """One pipeline stage: its last run, median duration, and hourly cells
    (oldest first; fewer than ``STAGE_HOURS`` while history is short)."""

    job_name: str
    last_run_at: datetime | None
    last_run_status: str | None
    last_duration_seconds: float | None
    median_duration_seconds: float | None
    hours: list[StageState]


class FreshnessDay(BaseModel):
    """One local day of the freshness SLO."""

    local_date: date
    state: DayState
    hours: int
    on_time: int


class BuildDay(BaseModel):
    """One local day of dbt builds."""

    local_date: date
    state: DayState
    builds: int
    builds_ok: int


class LastBuild(BaseModel):
    """The latest dbt build's tests and model coverage."""

    started_at: datetime
    run_status: str
    tests: int | None
    tests_passed: int
    project_models: int | None
    models_tested: int | None
    models_documented: int | None


class Resource(BaseModel):
    """One free-tier allowance; storage has no projection without history."""

    allowance: str
    used_to_date: int
    projected_month: float | None
    monthly_free: int


class Delivery(BaseModel):
    """DORA's metrics over the window (ADR-0045); medians are null without
    data, and every ratio is sent as its two counts."""

    deployments: int
    failed_attempts: int
    median_lead_time_seconds: float | None
    changes_with_lead_time: int
    change_failures: int
    median_recovery_seconds: float | None
    # Failures with a recovery time: the count behind the median.
    recovered_failures: int
    rework_deployments: int
    last_deployed_at: datetime | None


class DeliveryDay(BaseModel):
    """One local day with deployments: failed if one needed intervention."""

    local_date: date
    state: DayState


class RecentDeployment(BaseModel):
    """One of the latest deployments; the pull request is public on GitHub."""

    deployed_at: datetime
    pull_request_number: int | None
    pull_request_title: str | None
    lead_time_seconds: float | None
    is_change_failure: bool


def _null_is_empty(value: Any) -> Any:
    return [] if value is None else value


class RunsPanel(BaseModel):
    """The parts read from run records: the status line, the stages, the
    history strips, and the allowances measured per run."""

    read_at: datetime
    freshness_target_hours: int
    freshness_objective_percent: float
    last_ingest: LastRun | None
    on_time_streak_hours: int
    stages: list[StageRow]
    freshness_days: list[FreshnessDay]
    dbt_days: list[BuildDay]
    last_build: LastBuild | None
    resources: list[Resource]

    nulls_are_empty = field_validator(
        "stages", "freshness_days", "dbt_days", "resources", mode="before"
    )(_null_is_empty)


class StoragePanel(BaseModel):
    """BigQuery storage, read from table metadata."""

    read_at: datetime
    resources: list[Resource]


class DeliveryPanel(BaseModel):
    """The delivery metrics, their daily strip, and the latest deployments."""

    read_at: datetime
    delivery: Delivery
    delivery_days: list[DeliveryDay]
    recent_deployments: list[RecentDeployment]

    nulls_are_empty = field_validator(
        "delivery_days", "recent_deployments", mode="before"
    )(_null_is_empty)
