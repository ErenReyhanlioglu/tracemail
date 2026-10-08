"""Thin wrapper over the BigQuery client: tables, partition loads, queries.

The loader creates the datasets and tables it needs (ADR-0019). Schema changes
are applied only when additive (new nullable or repeated columns); anything
else raises ``SchemaChangeError`` instead of silently changing a table. Every
query carries ``maximum_bytes_billed`` (CLAUDE.md, BigQuery and dbt).
"""

from collections.abc import Sequence
from datetime import date
from typing import Any, Protocol

from google.cloud import bigquery
from pydantic import BaseModel

REQUIRED = "REQUIRED"
LEGACY_TYPE_NAMES = {
    "INTEGER": "INT64",
    "FLOAT": "FLOAT64",
    "BOOLEAN": "BOOL",
    "RECORD": "STRUCT",
}
PARTITION_DECORATOR_FORMAT = "%Y%m%d"
MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000


class SchemaChangeError(Exception):
    """An existing table's schema differs in a non-additive way."""


class LoadStats(BaseModel):
    """What one load job wrote, from the job's own statistics."""

    rows: int
    bytes: int


class QueryStats(BaseModel):
    """Rows returned and bytes processed / billed by one query job."""

    rows: list[dict[str, Any]]
    bytes_processed: int
    bytes_billed: int


class Warehouse(Protocol):
    """Warehouse operations used by the load step and run records."""

    def ensure_table(
        self,
        dataset: str,
        table: str,
        schema: Sequence[bigquery.SchemaField],
        partition_field: str,
        partition_expiration_days: int | None = None,
    ) -> None: ...

    def load_partition(
        self,
        source_uri: str,
        dataset: str,
        table: str,
        day: date,
        schema: Sequence[bigquery.SchemaField],
    ) -> LoadStats: ...

    def delete_partition(self, dataset: str, table: str, day: date) -> None: ...

    def append_rows(
        self,
        dataset: str,
        table: str,
        rows: Sequence[dict[str, Any]],
        schema: Sequence[bigquery.SchemaField],
    ) -> None: ...

    def query(self, sql: str, parameters: Sequence[Any]) -> QueryStats: ...


class BigQueryWarehouse:
    """``Warehouse`` backed by a BigQuery client in one project and location."""

    def __init__(
        self, client: bigquery.Client, location: str, max_bytes_billed: int
    ) -> None:
        self._client = client
        self._location = location
        self._max_bytes_billed = max_bytes_billed

    def ensure_table(
        self,
        dataset: str,
        table: str,
        schema: Sequence[bigquery.SchemaField],
        partition_field: str,
        partition_expiration_days: int | None = None,
    ) -> None:
        """Create the dataset and day-partitioned table if missing; apply
        additive schema changes before any load; refuse any other change."""
        dataset_ref = bigquery.Dataset(f"{self._client.project}.{dataset}")
        dataset_ref.location = self._location
        self._client.create_dataset(dataset_ref, exists_ok=True)
        wanted = bigquery.Table(self._table_id(dataset, table), schema=list(schema))
        wanted.time_partitioning = bigquery.TimePartitioning(
            field=partition_field,
            expiration_ms=(
                partition_expiration_days * MILLISECONDS_PER_DAY
                if partition_expiration_days is not None
                else None
            ),
        )
        existing = self._client.create_table(wanted, exists_ok=True)
        added = _additive_changes(list(existing.schema), list(schema))
        if added:
            existing.schema = [*existing.schema, *added]
            self._client.update_table(existing, ["schema"])

    def load_partition(
        self,
        source_uri: str,
        dataset: str,
        table: str,
        day: date,
        schema: Sequence[bigquery.SchemaField],
    ) -> LoadStats:
        """Replace one day's partition with the rows in ``source_uri``."""
        config = bigquery.LoadJobConfig(
            source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
            schema=list(schema),
            write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
        )
        partition = (
            f"{self._table_id(dataset, table)}${day:{PARTITION_DECORATOR_FORMAT}}"
        )
        job = self._client.load_table_from_uri(
            source_uri, partition, job_config=config, location=self._location
        )
        job.result()
        return LoadStats(rows=job.output_rows or 0, bytes=job.output_bytes or 0)

    def delete_partition(self, dataset: str, table: str, day: date) -> None:
        """Remove one day's partition; a no-op if it is already empty."""
        partition = (
            f"{self._table_id(dataset, table)}${day:{PARTITION_DECORATOR_FORMAT}}"
        )
        self._client.delete_table(partition, not_found_ok=True)

    def append_rows(
        self,
        dataset: str,
        table: str,
        rows: Sequence[dict[str, Any]],
        schema: Sequence[bigquery.SchemaField],
    ) -> None:
        """Append rows with a batch load job (never streaming inserts)."""
        config = bigquery.LoadJobConfig(
            schema=list(schema),
            write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
        )
        job = self._client.load_table_from_json(
            list(rows),
            self._table_id(dataset, table),
            job_config=config,
            location=self._location,
        )
        job.result()

    def query(self, sql: str, parameters: Sequence[Any]) -> QueryStats:
        """Run a parameterized query under the bytes-billed guardrail."""
        config = bigquery.QueryJobConfig(
            query_parameters=list(parameters),
            maximum_bytes_billed=self._max_bytes_billed,
        )
        job = self._client.query(sql, job_config=config, location=self._location)
        rows = [dict(row.items()) for row in job.result()]
        return QueryStats(
            rows=rows,
            bytes_processed=job.total_bytes_processed or 0,
            bytes_billed=job.total_bytes_billed or 0,
        )

    def _table_id(self, dataset: str, table: str) -> str:
        return f"{self._client.project}.{dataset}.{table}"


def _additive_changes(
    existing: list[bigquery.SchemaField], wanted: list[bigquery.SchemaField]
) -> list[bigquery.SchemaField]:
    """Return fields to add; raise if an existing field changed or a new field
    is REQUIRED (which BigQuery cannot add to a table with rows)."""
    current = {field.name: field for field in existing}
    added = []
    for field in wanted:
        old = current.get(field.name)
        if old is None:
            if field.mode == REQUIRED:
                raise SchemaChangeError(f"New field {field.name} must be optional")
            added.append(field)
        elif (_type_name(old), old.mode) != (_type_name(field), field.mode):
            raise SchemaChangeError(f"Field {field.name} changed type or mode")
    return added


def _type_name(field: bigquery.SchemaField) -> str:
    """BigQuery reports legacy names (INTEGER) for standard ones (INT64)."""
    name = str(field.field_type).upper()
    return LEGACY_TYPE_NAMES.get(name, name)
