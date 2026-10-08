"""Tests for the landing load step, the warehouse schema guard, and checks."""

from collections.abc import Sequence
from datetime import date
from typing import Any

import pytest
from google.cloud import bigquery

from tracemail_pipeline.load.landing import (
    LANDING_MODELS,
    PARTITION_FIELD,
    landing_fingerprints,
    landing_schema_version,
    load_landing,
)
from tracemail_pipeline.load.warehouse import (
    LoadStats,
    QueryStats,
    SchemaChangeError,
    _additive_changes,
)

DAY = date(2026, 10, 1)


class FakeWarehouse:
    def __init__(self, rows_per_load: int = 3) -> None:
        self.rows_per_load = rows_per_load
        self.ensured: list[tuple[str, str, str, int | None]] = []
        self.loads: list[tuple[str, str, date]] = []
        self.deleted: list[tuple[str, date]] = []
        self.queries: list[tuple[str, Sequence[Any]]] = []
        self.appended: list[dict[str, Any]] = []

    def ensure_table(
        self,
        dataset: str,
        table: str,
        schema: Sequence[bigquery.SchemaField],
        partition_field: str,
        partition_expiration_days: int | None = None,
    ) -> None:
        self.ensured.append(
            (dataset, table, partition_field, partition_expiration_days)
        )

    def load_partition(
        self,
        source_uri: str,
        dataset: str,
        table: str,
        day: date,
        schema: Sequence[bigquery.SchemaField],
    ) -> LoadStats:
        self.loads.append((source_uri, table, day))
        return LoadStats(rows=self.rows_per_load, bytes=self.rows_per_load * 100)

    def delete_partition(self, dataset: str, table: str, day: date) -> None:
        self.deleted.append((table, day))

    def append_rows(
        self,
        dataset: str,
        table: str,
        rows: Sequence[dict[str, Any]],
        schema: Sequence[bigquery.SchemaField],
    ) -> None:
        self.appended.extend(rows)

    def query(self, sql: str, parameters: Sequence[Any]) -> QueryStats:
        self.queries.append((sql, parameters))
        return QueryStats(
            rows=[{"row_count": 2, "fingerprint": 42}],
            bytes_processed=10,
            bytes_billed=0,
        )


def test_load_landing_ensures_every_table_partitioned_by_received_date() -> None:
    warehouse = FakeWarehouse()
    load_landing(warehouse, "landing", "bucket", DAY, date(2026, 10, 2))
    assert warehouse.ensured == [
        ("landing", table, PARTITION_FIELD, None) for table in LANDING_MODELS
    ]


def test_load_landing_loads_one_partition_per_day_and_record_type() -> None:
    warehouse = FakeWarehouse()
    result = load_landing(warehouse, "landing", "bucket", DAY, date(2026, 10, 3))
    assert len(warehouse.loads) == result.bq_load_jobs == 6
    assert (
        "gs://bucket/parsed/job_posting_sightings/received_date=2026-10-01/data.jsonl",
        "job_posting_sightings",
        DAY,
    ) in warehouse.loads
    assert (result.days, result.rows_loaded, result.bytes_loaded) == (2, 18, 1800)
    assert result.volume().records_out == 18


def test_load_landing_explicitly_empties_partitions_of_empty_days() -> None:
    warehouse = FakeWarehouse(rows_per_load=0)
    result = load_landing(warehouse, "landing", "bucket", DAY, date(2026, 10, 2))
    assert sorted(warehouse.deleted) == sorted((table, DAY) for table in LANDING_MODELS)
    assert result.partitions_emptied == 3


def test_load_landing_does_not_delete_partitions_that_received_rows() -> None:
    warehouse = FakeWarehouse(rows_per_load=1)
    load_landing(warehouse, "landing", "bucket", DAY, date(2026, 10, 2))
    assert warehouse.deleted == []


def test_landing_fingerprints_query_each_table_with_date_parameters() -> None:
    warehouse = FakeWarehouse()
    prints = landing_fingerprints(warehouse, "landing", DAY, date(2026, 10, 2))
    assert set(prints) == set(LANDING_MODELS)
    assert prints["job_actions"].row_count == 2
    sql, parameters = warehouse.queries[0]
    assert "`landing.job_posting_sightings`" in sql
    assert "@start" in sql and "@end" in sql
    assert [p.name for p in parameters] == ["start", "end"]


def test_landing_schema_version_is_a_short_stable_fingerprint() -> None:
    assert landing_schema_version() == landing_schema_version()
    assert len(landing_schema_version()) == 12


def field(name: str, field_type: str, mode: str = "NULLABLE") -> bigquery.SchemaField:
    return bigquery.SchemaField(name, field_type, mode=mode)


def test_additive_changes_returns_only_new_optional_fields() -> None:
    existing = [field("a", "INTEGER")]
    wanted = [field("a", "INT64"), field("b", "STRING")]
    assert [f.name for f in _additive_changes(existing, wanted)] == ["b"]


def test_additive_changes_treats_legacy_type_names_as_unchanged() -> None:
    existing = [field("a", "INTEGER"), field("b", "FLOAT"), field("c", "BOOLEAN")]
    wanted = [field("a", "INT64"), field("b", "FLOAT64"), field("c", "BOOL")]
    assert _additive_changes(existing, wanted) == []


@pytest.mark.parametrize(
    ("existing", "wanted"),
    [
        ([field("a", "STRING")], [field("a", "INT64")]),
        ([field("a", "STRING")], [field("a", "STRING", "REPEATED")]),
        ([], [field("a", "STRING", "REQUIRED")]),
    ],
)
def test_additive_changes_refuses_breaking_changes(
    existing: list[bigquery.SchemaField], wanted: list[bigquery.SchemaField]
) -> None:
    with pytest.raises(SchemaChangeError):
        _additive_changes(existing, wanted)
