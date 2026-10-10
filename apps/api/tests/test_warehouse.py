"""Tests for the marts reader against a mocked BigQuery client."""

import asyncio
from datetime import UTC, date, datetime
from typing import Any
from unittest.mock import MagicMock

from api_fakes import make_settings
from google.cloud import bigquery

from tracemail_api.warehouse import MartsReader

ROW = {
    "application_key": "app-1",
    "company": "Example Company",
    "title": "Example Role",
    "location": None,
    "channel": "linkedin",
    "posting_url": None,
    "applied_on": date(2026, 10, 1),
    "current_status": "applied",
    "last_event_date": date(2026, 10, 1),
    "days_since_last_event": 9,
    "is_silent": False,
    "is_closed_without_reply": False,
    "event_count": 1,
}


def reader_with(client: Any) -> MartsReader:
    return MartsReader(client, make_settings())


def test_applications_query_uses_marts_as_default_dataset_and_byte_cap() -> None:
    client = MagicMock()
    client.query.return_value.result.return_value = [MagicMock(items=ROW.items)]
    rows = asyncio.run(reader_with(client).applications())
    assert [row.application_key for row in rows] == ["app-1"]
    _, kwargs = client.query.call_args
    config: bigquery.QueryJobConfig = kwargs["job_config"]
    assert str(config.default_dataset) == "test-project.marts"
    assert config.maximum_bytes_billed == 1_000_000
    assert kwargs["location"] == "us-central1"


def test_applications_sql_names_tables_without_project_or_dataset() -> None:
    client = MagicMock()
    client.query.return_value.result.return_value = []
    asyncio.run(reader_with(client).applications())
    sql: str = client.query.call_args.args[0]
    assert "from dim_applications" in sql
    assert "test-project" not in sql and "marts." not in sql


def test_check_and_modified_are_metadata_calls_on_marts() -> None:
    client = MagicMock()
    client.get_table.return_value.modified = datetime(2026, 10, 1, tzinfo=UTC)
    reader = reader_with(client)
    asyncio.run(reader.check())
    modified = asyncio.run(reader.applications_modified())
    client.get_dataset.assert_called_once_with("test-project.marts")
    client.get_table.assert_called_once_with("test-project.marts.dim_applications")
    assert modified == datetime(2026, 10, 1, tzinfo=UTC)
    client.query.assert_not_called()


def test_close_closes_the_client() -> None:
    client = MagicMock()
    reader_with(client).close()
    client.close.assert_called_once_with()
