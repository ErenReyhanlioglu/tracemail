"""dbt build results recorded in ``ops`` (ADR-0023).

After a dbt build, its artifacts are read and recorded like every other step
(ADR-0017, ADR-0020): one row per executed node in ``ops.dbt_node_runs``, and
one ``ops.pipeline_runs`` row for the build with its duration, node counts,
billed bytes, and test and documentation coverage. Both are appended with
batch load jobs, never SQL inserts. A build may span several invocations
(Cosmos runs one per task), so several run-results files are combined.

A failed build is recorded too, and then reported as ``DbtBuildFailedError``.
"""

import time
import uuid
from collections import Counter
from collections.abc import Sequence
from datetime import datetime
from pathlib import Path

from pydantic import BaseModel

from tracemail_pipeline.load.bq_schema import schema_for
from tracemail_pipeline.load.dbt_artifacts import (
    Coverage,
    NodeResult,
    RunResults,
    read_coverage,
    read_run_results,
)
from tracemail_pipeline.load.run_records import (
    PipelineRun,
    RunContext,
    RunStatus,
    RunVolume,
    WarehouseRunRecordWriter,
    lineage_names,
    scrub_error_message,
)
from tracemail_pipeline.load.warehouse import Warehouse

NODE_RUNS_TABLE = "dbt_node_runs"
PARTITION_FIELD = "started_at"
FAILED_STATUSES = frozenset({"error", "fail", "runtime error"})


class DbtBuildFailedError(Exception):
    """At least one dbt node errored or one data test failed."""


class DbtNodeRun(BaseModel):
    """One row of ``ops.dbt_node_runs``."""

    run_id: str
    invocation_id: str
    node_id: str
    resource_type: str
    status: str
    started_at: datetime
    execution_seconds: float
    failures: int | None
    bytes_processed: int | None
    bytes_billed: int | None
    slot_ms: int | None
    bigquery_job_id: str | None


class DbtBuildResult(BaseModel):
    """The build's result model (ADR-0017), stored as run-record metrics."""

    invocations: int = 0
    nodes_by_status: dict[str, int] = {}
    models: int = 0
    tests: int = 0
    bytes_processed: int = 0
    bytes_billed: int = 0
    slot_ms: int = 0
    seconds_elapsed: float = 0.0
    seconds_recording: float = 0.0
    coverage: Coverage = Coverage()

    def failed(self) -> int:
        """Nodes that errored and tests that failed."""
        return sum(self.nodes_by_status.get(s, 0) for s in FAILED_STATUSES)

    def volume(self) -> RunVolume:
        """Common volume fields for the run record (ADR-0020)."""
        nodes = sum(self.nodes_by_status.values())
        failed = self.failed()
        return RunVolume(
            records_in=nodes, records_out=nodes - failed, records_failed=failed
        )


def summarize(invocations: Sequence[RunResults], coverage: Coverage) -> DbtBuildResult:
    """Combine one build's invocations into its result model."""
    nodes = [node for invocation in invocations for node in invocation.results]
    kinds = Counter(_resource_type(node.unique_id) for node in nodes)
    return DbtBuildResult(
        invocations=len(invocations),
        nodes_by_status=dict(Counter(node.status for node in nodes)),
        models=kinds["model"],
        tests=kinds["test"],
        bytes_processed=sum(_response_int(n, "bytes_processed") or 0 for n in nodes),
        bytes_billed=sum(_response_int(n, "bytes_billed") or 0 for n in nodes),
        slot_ms=sum(_response_int(n, "slot_ms") or 0 for n in nodes),
        seconds_elapsed=sum(invocation.elapsed_time for invocation in invocations),
        coverage=coverage,
    )


def node_runs(run_id: str, invocations: Sequence[RunResults]) -> list[DbtNodeRun]:
    """One ``ops.dbt_node_runs`` row per executed node."""
    return [
        DbtNodeRun(
            run_id=run_id,
            invocation_id=invocation.metadata.invocation_id,
            node_id=node.unique_id,
            resource_type=_resource_type(node.unique_id),
            status=node.status,
            started_at=invocation.metadata.invocation_started_at,
            execution_seconds=node.execution_time,
            failures=node.failures,
            bytes_processed=_response_int(node, "bytes_processed"),
            bytes_billed=_response_int(node, "bytes_billed"),
            slot_ms=_response_int(node, "slot_ms"),
            bigquery_job_id=node.adapter_response.get("job_id"),
        )
        for invocation in invocations
        for node in invocation.results
    ]


def build_run_record(
    run_id: str,
    context: RunContext,
    invocations: Sequence[RunResults],
    result: DbtBuildResult,
) -> PipelineRun:
    """The build's ``ops.pipeline_runs`` row; timed by dbt's own metadata."""
    started = min(i.metadata.invocation_started_at for i in invocations)
    finished = max(i.metadata.generated_at for i in invocations)
    failed = _failed_nodes(invocations)
    return PipelineRun(
        **context.model_dump(),
        **result.volume().model_dump(),
        run_id=run_id,
        status=RunStatus.FAIL if failed else RunStatus.COMPLETE,
        started_at=started,
        finished_at=finished,
        duration_seconds=(finished - started).total_seconds(),
        error_type=DbtBuildFailedError.__name__ if failed else None,
        error_message=scrub_error_message(", ".join(failed)) if failed else None,
        metrics=result.model_dump(mode="json"),
    )


def record_dbt_build(
    warehouse: Warehouse,
    writer: WarehouseRunRecordWriter,
    context: RunContext,
    run_results_paths: Sequence[Path],
    manifest_path: Path,
) -> DbtBuildResult:
    """Record one dbt build in ``ops``; raise if any node failed."""
    started = time.perf_counter()
    invocations = [read_run_results(path) for path in run_results_paths]
    result = summarize(invocations, read_coverage(manifest_path))
    run_id = str(uuid.uuid4())
    schema = schema_for(DbtNodeRun)
    warehouse.ensure_table(
        writer.dataset,
        NODE_RUNS_TABLE,
        schema,
        PARTITION_FIELD,
        partition_expiration_days=writer.retention_days,
    )
    rows = [row.model_dump(mode="json") for row in node_runs(run_id, invocations)]
    warehouse.append_rows(writer.dataset, NODE_RUNS_TABLE, rows, schema)
    result.seconds_recording = time.perf_counter() - started
    context = context.model_copy(
        update={"outputs": lineage_names("bq", output_datasets(invocations))}
    )
    writer.write(build_run_record(run_id, context, invocations, result))
    if result.failed():
        raise DbtBuildFailedError(f"{result.failed()} dbt nodes failed")
    return result


def output_datasets(invocations: Sequence[RunResults]) -> list[str]:
    """Datasets the build wrote to, from each node's relation name
    (`` `project`.`dataset`.`table` ``); tests write nothing."""
    datasets = {
        node.relation_name.split(".")[1].strip("`")
        for invocation in invocations
        for node in invocation.results
        if node.relation_name and not node.unique_id.startswith("test.")
    }
    return sorted(datasets)


def _resource_type(unique_id: str) -> str:
    return unique_id.split(".", maxsplit=1)[0]


def _response_int(node: NodeResult, key: str) -> int | None:
    value = node.adapter_response.get(key)
    return int(value) if value is not None else None


def _failed_nodes(invocations: Sequence[RunResults]) -> list[str]:
    return [
        node.unique_id
        for invocation in invocations
        for node in invocation.results
        if node.status in FAILED_STATUSES
    ]
