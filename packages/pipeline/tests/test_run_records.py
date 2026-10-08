"""Tests for run records (ADR-0020)."""

from datetime import UTC, datetime
from typing import Any

import pytest
from pydantic import BaseModel

from tracemail_pipeline.load.run_records import (
    RUNS_TABLE,
    PipelineRun,
    RunContext,
    RunStatus,
    RunVolume,
    WarehouseRunRecordWriter,
    lineage_names,
    run_recorded,
    scrub_error_message,
)

CONTEXT = RunContext(
    job_name="parse_mail",
    inputs=["gcs:bucket/raw/mail"],
    outputs=["gcs:bucket/parsed/job_actions"],
    interval_start=datetime(2026, 10, 1, tzinfo=UTC),
    interval_end=datetime(2026, 10, 2, tzinfo=UTC),
    schema_version="abc123",
)


class Result(BaseModel):
    messages: int = 5

    def volume(self) -> RunVolume:
        return RunVolume(records_in=self.messages, records_out=7, bytes_out=99)


class ListWriter:
    def __init__(self) -> None:
        self.runs: list[PipelineRun] = []

    def write(self, run: PipelineRun) -> None:
        self.runs.append(run)


def test_completed_step_is_recorded_with_volume_and_metrics() -> None:
    writer = ListWriter()
    result = run_recorded(writer, CONTEXT, Result)
    [run] = writer.runs
    assert result == Result()
    assert run.status == RunStatus.COMPLETE
    assert (run.records_in, run.records_out, run.bytes_out) == (5, 7, 99)
    assert run.metrics == {"messages": 5}
    assert run.job_name == "parse_mail" and run.schema_version == "abc123"
    assert run.finished_at >= run.started_at and run.duration_seconds >= 0


def test_failed_step_is_recorded_and_the_error_is_reraised() -> None:
    writer = ListWriter()

    def fail() -> Result:
        raise ValueError("bucket unreachable")

    with pytest.raises(ValueError, match="bucket unreachable"):
        run_recorded(writer, CONTEXT, fail)
    [run] = writer.runs
    assert (run.status, run.error_type) == (RunStatus.FAIL, "ValueError")
    assert run.error_message == "bucket unreachable"
    assert run.metrics is None and run.records_in == 0


def test_each_execution_gets_its_own_run_id() -> None:
    writer = ListWriter()
    run_recorded(writer, CONTEXT, Result)
    run_recorded(writer, CONTEXT, Result)
    assert writer.runs[0].run_id != writer.runs[1].run_id


@pytest.mark.parametrize(
    "message",
    [
        "Bad From header: Jane Recruiter <jane@company.example>",
        "Could not open https://www.linkedin.com/comm/jobs/view/1?otpToken=abc",
        "Unexpected subject 'Başvurunuz Example Company şirketine gönderildi'",
    ],
)
def test_error_messages_are_scrubbed_of_personal_data(message: str) -> None:
    scrubbed = scrub_error_message(message)
    for leak in ["jane@company.example", "otpToken", "Example Company"]:
        assert leak not in scrubbed


def test_error_messages_keep_own_bucket_paths_that_make_failures_actionable() -> None:
    message = "404 Not found: URI gs://bucket/parsed/job_actions/received_date=2026-09-01/data.jsonl"
    assert scrub_error_message(message) == message


def test_error_messages_are_truncated() -> None:
    assert len(scrub_error_message("x" * 5000)) == 300


def test_lineage_names_prefix_each_dataset() -> None:
    assert lineage_names("bq", ["landing.a", "landing.b"]) == [
        "bq:landing.a",
        "bq:landing.b",
    ]


class RecordingWarehouse:
    def __init__(self) -> None:
        self.ensure_calls: list[tuple[str, str, str, int | None]] = []
        self.rows: list[dict[str, Any]] = []

    def ensure_table(
        self,
        dataset: str,
        table: str,
        schema: Any,
        partition_field: str,
        partition_expiration_days: int | None = None,
    ) -> None:
        self.ensure_calls.append(
            (dataset, table, partition_field, partition_expiration_days)
        )

    def append_rows(self, dataset: str, table: str, rows: Any, schema: Any) -> None:
        self.rows.extend(rows)


def test_warehouse_writer_ensures_the_table_once_with_retention_and_appends() -> None:
    warehouse = RecordingWarehouse()
    writer = WarehouseRunRecordWriter(warehouse, "ops", retention_days=400)  # type: ignore[arg-type]
    run_recorded(writer, CONTEXT, Result)
    run_recorded(writer, CONTEXT, Result)
    assert warehouse.ensure_calls == [("ops", RUNS_TABLE, "started_at", 400)]
    assert len(warehouse.rows) == 2
    assert warehouse.rows[0]["status"] == "COMPLETE"
    assert isinstance(warehouse.rows[0]["started_at"], str)
