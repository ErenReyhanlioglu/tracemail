"""Run records in ``ops.pipeline_runs`` (ADR-0020).

Every pipeline step runs through ``run_recorded``: it measures the run,
appends one row whether the step completes or fails, and re-raises any
failure unchanged. Rows are appended, never replaced; each execution is its
own event. Field names follow OpenLineage (run id, job name, terminal state,
inputs and outputs); volume, latency, and error fields follow the data
observability and SRE frameworks named in ADR-0020.
"""

import re
import time
import uuid
from collections.abc import Callable, Sequence
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any, Protocol

from pydantic import BaseModel

from tracemail_pipeline.load.bq_schema import schema_for
from tracemail_pipeline.load.warehouse import Warehouse

RUNS_TABLE = "pipeline_runs"
PARTITION_FIELD = "started_at"
ERROR_MESSAGE_LIMIT = 300
# Exception messages can quote their input; strip what could be personal.
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")
# gs:// paths are kept: they name this project's own objects (dates, hashed
# message ids, record types), never personal data, and are what makes a
# failure actionable.
URL = re.compile(r"\b(?!gs://)[a-z][a-z0-9+.-]*://\S+", re.IGNORECASE)
QUOTED = re.compile(r"(['\"]).*?\1")


class RunStatus(StrEnum):
    """Terminal run states, named as in OpenLineage."""

    COMPLETE = "COMPLETE"
    FAIL = "FAIL"


class RunVolume(BaseModel):
    """The volume part of a run, common to every step."""

    records_in: int = 0
    records_out: int = 0
    records_failed: int = 0
    bytes_in: int = 0
    bytes_out: int = 0


class StepResult(Protocol):
    """A step's result model (ADR-0017) that can report its common volume."""

    def volume(self) -> RunVolume: ...

    def model_dump(self, *, mode: str) -> dict[str, Any]: ...


class RunContext(BaseModel):
    """What is known about a run before it starts."""

    job_name: str
    inputs: list[str]
    outputs: list[str]
    interval_start: datetime | None = None
    interval_end: datetime | None = None
    schema_version: str | None = None
    code_version: str | None = None


class PipelineRun(RunVolume):
    """One row of ``ops.pipeline_runs``."""

    run_id: str
    job_name: str
    status: RunStatus
    inputs: list[str]
    outputs: list[str]
    interval_start: datetime | None
    interval_end: datetime | None
    started_at: datetime
    finished_at: datetime
    duration_seconds: float
    schema_version: str | None
    code_version: str | None
    error_type: str | None = None
    error_message: str | None = None
    metrics: dict[str, Any] | None = None


class RunRecordWriter(Protocol):
    """Destination for run records."""

    def write(self, run: PipelineRun) -> None: ...


class WarehouseRunRecordWriter:
    """Appends run records to the ops dataset with batch load jobs."""

    def __init__(self, warehouse: Warehouse, dataset: str, retention_days: int) -> None:
        self._warehouse = warehouse
        self._dataset = dataset
        self._retention_days = retention_days
        self._table_ready = False

    @property
    def dataset(self) -> str:
        """The ops dataset that run records are written to."""
        return self._dataset

    @property
    def retention_days(self) -> int:
        """Days an ops partition is kept before it expires."""
        return self._retention_days

    def write(self, run: PipelineRun) -> None:
        """Append one run record with a batch load job (not a streaming
        insert), creating the table on first use. Partitions older than the
        retention period expire on their own."""
        schema = schema_for(PipelineRun)
        if not self._table_ready:
            self._warehouse.ensure_table(
                self._dataset,
                RUNS_TABLE,
                schema,
                PARTITION_FIELD,
                partition_expiration_days=self._retention_days,
            )
            self._table_ready = True
        row = run.model_dump(mode="json")
        self._warehouse.append_rows(self._dataset, RUNS_TABLE, [row], schema)


def run_recorded[ResultT: StepResult](
    writer: RunRecordWriter, context: RunContext, step: Callable[[], ResultT]
) -> ResultT:
    """Run a step, record it as COMPLETE or FAIL, and return its result."""
    run_id = str(uuid.uuid4())
    started_at = datetime.now(UTC)
    started = time.perf_counter()
    try:
        result = step()
    except Exception as e:
        writer.write(
            _record(run_id, context, started_at, started, RunStatus.FAIL, error=e)
        )
        raise
    writer.write(
        _record(run_id, context, started_at, started, RunStatus.COMPLETE, result)
    )
    return result


def _record(
    run_id: str,
    context: RunContext,
    started_at: datetime,
    started: float,
    status: RunStatus,
    result: StepResult | None = None,
    error: Exception | None = None,
) -> PipelineRun:
    volume = result.volume() if result is not None else RunVolume()
    return PipelineRun(
        **context.model_dump(),
        **volume.model_dump(),
        run_id=run_id,
        status=status,
        started_at=started_at,
        finished_at=datetime.now(UTC),
        duration_seconds=time.perf_counter() - started,
        error_type=type(error).__name__ if error is not None else None,
        error_message=scrub_error_message(str(error)) if error is not None else None,
        metrics=result.model_dump(mode="json") if result is not None else None,
    )


def scrub_error_message(message: str) -> str:
    """Remove e-mail addresses, URLs, and quoted values, then truncate.

    Run records are read by the public health panel's backend; the public API
    never exposes this field, and the scrub is a second line of defense.
    """
    message = EMAIL.sub("<email>", message)
    message = URL.sub("<url>", message)
    message = QUOTED.sub("<quoted>", message)
    return message[:ERROR_MESSAGE_LIMIT]


def lineage_names(prefix: str, names: Sequence[str]) -> list[str]:
    """Format dataset names for ``inputs`` / ``outputs`` (e.g. ``bq:ds.t``)."""
    return [f"{prefix}:{name}" for name in names]
