"""Tests for BigQuery schemas generated from record models.

``fixtures/schemas/landing_and_ops.json`` is a committed snapshot of every
generated schema. When a model changes on purpose, regenerate it with
``uv run python packages/pipeline/tests/test_bq_schema.py`` and review the
diff: it is the table change BigQuery will receive.
"""

import json
from datetime import date, datetime
from enum import StrEnum
from pathlib import Path
from typing import Any

import pytest
from pydantic import BaseModel

from tracemail_pipeline.load.bq_schema import (
    UnsupportedFieldTypeError,
    schema_for,
    schema_version,
)
from tracemail_pipeline.load.landing import LANDING_MODELS
from tracemail_pipeline.load.run_records import RUNS_TABLE, PipelineRun

SNAPSHOT = Path(__file__).parent / "fixtures" / "schemas" / "landing_and_ops.json"


class Color(StrEnum):
    RED = "red"


class Example(BaseModel):
    name: str
    count: int
    ratio: float
    flag: bool
    day: date
    at: datetime
    color: Color
    tags: list[str] = []
    note: str | None = None
    extra: dict[str, Any] | None = None


class Nested(BaseModel):
    inner: Example


def current_schemas() -> dict[str, list[dict[str, Any]]]:
    models: dict[str, type[BaseModel]] = {**LANDING_MODELS, RUNS_TABLE: PipelineRun}
    return {
        name: [field.to_api_repr() for field in schema_for(model)]
        for name, model in sorted(models.items())
    }


def test_schema_for_maps_every_supported_type() -> None:
    fields = {f.name: (f.field_type, f.mode) for f in schema_for(Example)}
    assert fields == {
        "name": ("STRING", "NULLABLE"),
        "count": ("INT64", "NULLABLE"),
        "ratio": ("FLOAT64", "NULLABLE"),
        "flag": ("BOOL", "NULLABLE"),
        "day": ("DATE", "NULLABLE"),
        "at": ("TIMESTAMP", "NULLABLE"),
        "color": ("STRING", "NULLABLE"),
        "tags": ("STRING", "REPEATED"),
        "note": ("STRING", "NULLABLE"),
        "extra": ("JSON", "NULLABLE"),
    }


def test_schema_for_rejects_nested_models_instead_of_guessing() -> None:
    with pytest.raises(UnsupportedFieldTypeError):
        schema_for(Nested)


def test_schema_version_is_stable_and_changes_with_the_schema() -> None:
    class Extended(Example):
        added: str | None = None

    assert schema_version(Example) == schema_version(Example)
    assert schema_version(Example) != schema_version(Extended)


def test_generated_schemas_match_the_committed_snapshot() -> None:
    expected = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    assert current_schemas() == expected, (
        "Generated BigQuery schemas changed; regenerate the snapshot and review it"
    )


if __name__ == "__main__":
    SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT.write_text(
        json.dumps(current_schemas(), indent=2) + "\n", encoding="utf-8"
    )
