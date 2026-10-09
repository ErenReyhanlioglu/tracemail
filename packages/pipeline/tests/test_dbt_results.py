"""Tests for recording dbt builds in ops (ADR-0023).

Artifacts are synthetic: the smallest ``run_results.json`` and
``manifest.json`` shapes the recorder reads, written to a temporary folder.
"""

import json
from pathlib import Path
from typing import Any

import pytest

from tracemail_pipeline.load.dbt_artifacts import read_coverage
from tracemail_pipeline.load.dbt_results import (
    NODE_RUNS_TABLE,
    DbtBuildFailedError,
    record_dbt_build,
)
from tracemail_pipeline.load.run_records import (
    RUNS_TABLE,
    RunContext,
    WarehouseRunRecordWriter,
)

CONTEXT = RunContext(job_name="dbt_build", inputs=["bq:landing.x"], outputs=[])
MIB = 1_048_576


class RecordingWarehouse:
    def __init__(self) -> None:
        self.ensured: list[tuple[str, str, str, int | None]] = []
        self.rows: dict[str, list[dict[str, Any]]] = {}

    def ensure_table(
        self,
        dataset: str,
        table: str,
        schema: Any,
        partition_field: str,
        partition_expiration_days: int | None = None,
    ) -> None:
        self.ensured.append(
            (dataset, table, partition_field, partition_expiration_days)
        )

    def append_rows(self, dataset: str, table: str, rows: Any, schema: Any) -> None:
        self.rows.setdefault(table, []).extend(rows)


def node(
    unique_id: str, status: str, billed: int, relation: str | None = None
) -> dict[str, Any]:
    return {
        "unique_id": unique_id,
        "status": status,
        "execution_time": 1.5,
        "failures": 0 if unique_id.startswith("test.") else None,
        "relation_name": relation,
        "adapter_response": {"bytes_billed": billed, "slot_ms": 10, "job_id": "j1"},
        "compiled_code": "select 1",
    }


def write_run_results(path: Path, invocation: str, nodes: list[dict[str, Any]]) -> Path:
    path.write_text(
        json.dumps(
            {
                "metadata": {
                    "invocation_id": invocation,
                    "invocation_started_at": "2026-10-09T19:00:00Z",
                    "generated_at": "2026-10-09T19:01:00Z",
                    "dbt_version": "1.12.5",
                },
                "elapsed_time": 60.0,
                "results": nodes,
            }
        ),
        encoding="utf-8",
    )
    return path


def write_manifest(path: Path) -> Path:
    model = {"resource_type": "model", "package_name": "tracemail"}
    nodes = {
        "model.tracemail.a": {
            **model,
            "unique_id": "model.tracemail.a",
            "description": "A",
        },
        "model.tracemail.b": {
            **model,
            "unique_id": "model.tracemail.b",
            "description": "",
        },
        "model.dbt_utils.x": {
            "unique_id": "model.dbt_utils.x",
            "resource_type": "model",
            "package_name": "dbt_utils",
        },
        "test.tracemail.t": {
            "unique_id": "test.tracemail.t",
            "resource_type": "test",
            "package_name": "tracemail",
            "depends_on": {"nodes": ["model.tracemail.a"]},
        },
    }
    payload = {"metadata": {"project_name": "tracemail"}, "nodes": nodes}
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def record(tmp_path: Path, nodes: list[dict[str, Any]]) -> RecordingWarehouse:
    warehouse = RecordingWarehouse()
    writer = WarehouseRunRecordWriter(warehouse, "ops", retention_days=400)  # type: ignore[arg-type]
    results = write_run_results(tmp_path / "run_results.json", "inv-1", nodes)
    record_dbt_build(
        warehouse,  # type: ignore[arg-type]
        writer,
        CONTEXT,
        [results],
        write_manifest(tmp_path / "manifest.json"),
    )
    return warehouse


GOOD_NODES = [
    node("model.tracemail.a", "success", 10 * MIB, "`p`.`marts`.`a`"),
    node("seed.tracemail.s", "success", 0, "`p`.`staging`.`s`"),
    node("test.tracemail.t", "pass", 10 * MIB),
]


def test_coverage_counts_only_root_project_models(tmp_path: Path) -> None:
    coverage = read_coverage(write_manifest(tmp_path / "manifest.json"))
    assert (coverage.models, coverage.models_tested, coverage.models_documented) == (
        2,
        1,
        1,
    )


def test_build_writes_one_node_row_per_node_and_one_run_record(tmp_path: Path) -> None:
    warehouse = record(tmp_path, GOOD_NODES)
    nodes = warehouse.rows[NODE_RUNS_TABLE]
    assert [row["resource_type"] for row in nodes] == ["model", "seed", "test"]
    assert {row["invocation_id"] for row in nodes} == {"inv-1"}
    [run] = warehouse.rows[RUNS_TABLE]
    assert (run["status"], run["records_in"], run["records_failed"]) == (
        "COMPLETE",
        3,
        0,
    )
    assert run["duration_seconds"] == 60.0
    assert run["outputs"] == ["bq:marts", "bq:staging"]
    assert run["metrics"]["bytes_billed"] == 20 * MIB
    assert run["metrics"]["coverage"]["models_tested"] == 1
    assert ("ops", NODE_RUNS_TABLE, "started_at", 400) in warehouse.ensured


def test_failed_test_is_recorded_then_raised(tmp_path: Path) -> None:
    nodes = [*GOOD_NODES[:2], node("test.tracemail.t", "fail", 10 * MIB)]
    warehouse = RecordingWarehouse()
    writer = WarehouseRunRecordWriter(warehouse, "ops", retention_days=400)  # type: ignore[arg-type]
    results = write_run_results(tmp_path / "run_results.json", "inv-1", nodes)
    with pytest.raises(DbtBuildFailedError):
        record_dbt_build(
            warehouse,  # type: ignore[arg-type]
            writer,
            CONTEXT,
            [results],
            write_manifest(tmp_path / "manifest.json"),
        )
    [run] = warehouse.rows[RUNS_TABLE]
    assert (run["status"], run["error_type"]) == ("FAIL", "DbtBuildFailedError")
    assert run["records_failed"] == 1
    assert "test.tracemail.t" in run["error_message"]


def test_several_invocations_are_combined_into_one_build(tmp_path: Path) -> None:
    first = write_run_results(tmp_path / "a.json", "inv-1", GOOD_NODES[:1])
    second = write_run_results(tmp_path / "b.json", "inv-2", GOOD_NODES[2:])
    warehouse = RecordingWarehouse()
    writer = WarehouseRunRecordWriter(warehouse, "ops", retention_days=400)  # type: ignore[arg-type]
    result = record_dbt_build(
        warehouse,  # type: ignore[arg-type]
        writer,
        CONTEXT,
        [first, second],
        write_manifest(tmp_path / "manifest.json"),
    )
    assert (result.invocations, result.models, result.tests) == (2, 1, 1)
    assert {row["invocation_id"] for row in warehouse.rows[NODE_RUNS_TABLE]} == {
        "inv-1",
        "inv-2",
    }
