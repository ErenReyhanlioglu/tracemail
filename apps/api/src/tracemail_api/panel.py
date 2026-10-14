"""Response schema of the public health panel (ADR-0044).

An explicit whitelist of system-level values: states, times, durations, and
counts. No field names a company, posting, sender, or error message, and the
privacy test checks every field reachable from here (CLAUDE.md, Privacy).
The panel query returns one row whose nested fields validate into
``HealthPanel``; BigQuery aggregates over no rows return null, which reads
as an empty list.
"""

from datetime import date, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, field_validator

# Windows of the panel's sections (ADR-0044).
WINDOW_DAYS = 30
STAGE_HOURS = 24
MEDIAN_DAYS = 7


class StageState(StrEnum):
    """What one stage did for one hourly interval."""

    OK = "ok"
    LATE = "late"
    FAILED = "failed"
    SKIPPED = "skipped"
    MISSED = "missed"


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


class HealthPanel(BaseModel):
    """Everything the public health panel shows."""

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

    @field_validator("stages", "freshness_days", "dbt_days", "resources", mode="before")
    @classmethod
    def _null_is_empty(cls, value: Any) -> Any:
        return [] if value is None else value
