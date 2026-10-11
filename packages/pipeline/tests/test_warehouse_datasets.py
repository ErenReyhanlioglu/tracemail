"""Tests for dataset handling in the BigQuery warehouse (mocked client)."""

from unittest.mock import MagicMock

from google.api_core.exceptions import NotFound
from google.cloud import bigquery

from tracemail_pipeline.load.warehouse import BigQueryWarehouse

SCHEMA = [bigquery.SchemaField("day", "DATE")]


def warehouse_with(client: MagicMock) -> BigQueryWarehouse:
    client.project = "test-project"
    client.create_table.return_value = bigquery.Table(
        "test-project.landing.t", schema=SCHEMA
    )
    return BigQueryWarehouse(client, "us-central1", 1_000_000)


def test_existing_dataset_is_read_not_created() -> None:
    client = MagicMock()
    warehouse_with(client).ensure_table("landing", "t", SCHEMA, "day")
    client.get_dataset.assert_called_once_with("test-project.landing")
    client.create_dataset.assert_not_called()


def test_missing_dataset_is_created_in_the_configured_location() -> None:
    client = MagicMock()
    client.get_dataset.side_effect = NotFound("missing")  # type: ignore[no-untyped-call]
    warehouse_with(client).ensure_table("landing", "t", SCHEMA, "day")
    created = client.create_dataset.call_args.args[0]
    assert (created.dataset_id, created.location) == ("landing", "us-central1")
