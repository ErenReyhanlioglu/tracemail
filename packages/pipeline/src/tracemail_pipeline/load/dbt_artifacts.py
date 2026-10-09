"""Typed views of the dbt artifacts a build leaves in ``target/``.

``run_results.json`` (one per dbt invocation) gives each executed node's
status, timing, and BigQuery job statistics; ``manifest.json`` gives the
project's models and tests, for test and documentation coverage (ADR-0023).
Only the fields that are used are declared.
"""

from datetime import datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict


class _Artifact(BaseModel):
    """dbt artifacts carry many fields; only the ones used are declared."""

    model_config = ConfigDict(extra="ignore")


class NodeResult(_Artifact):
    """One entry of ``results`` in ``run_results.json``."""

    unique_id: str
    status: str
    execution_time: float
    failures: int | None = None
    relation_name: str | None = None
    adapter_response: dict[str, Any] = {}


class RunMetadata(_Artifact):
    """The ``metadata`` block of ``run_results.json``."""

    invocation_id: str
    invocation_started_at: datetime
    generated_at: datetime


class RunResults(_Artifact):
    """One dbt invocation's ``run_results.json``."""

    metadata: RunMetadata
    elapsed_time: float
    results: list[NodeResult]


class ManifestDependencies(_Artifact):
    nodes: list[str] = []


class ManifestNode(_Artifact):
    unique_id: str
    resource_type: str
    package_name: str
    description: str = ""
    depends_on: ManifestDependencies = ManifestDependencies()


class ManifestMetadata(_Artifact):
    project_name: str


class Manifest(_Artifact):
    """The parts of ``manifest.json`` needed for coverage."""

    metadata: ManifestMetadata
    nodes: dict[str, ManifestNode]


class Coverage(BaseModel):
    """How many of the project's models are tested and documented."""

    models: int = 0
    models_tested: int = 0
    models_documented: int = 0


def read_run_results(path: Path) -> RunResults:
    """Parse one ``run_results.json``."""
    return RunResults.model_validate_json(path.read_text(encoding="utf-8"))


def read_coverage(manifest_path: Path) -> Coverage:
    """Count the root project's models, and those with a test or description."""
    manifest = Manifest.model_validate_json(manifest_path.read_text(encoding="utf-8"))
    nodes = manifest.nodes.values()
    models = [
        node
        for node in nodes
        if node.resource_type == "model"
        and node.package_name == manifest.metadata.project_name
    ]
    tested = {
        dependency
        for node in nodes
        if node.resource_type == "test"
        for dependency in node.depends_on.nodes
    }
    return Coverage(
        models=len(models),
        models_tested=sum(model.unique_id in tested for model in models),
        models_documented=sum(bool(model.description.strip()) for model in models),
    )
