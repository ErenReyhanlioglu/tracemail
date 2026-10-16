"""Tests for the public health-panel endpoints: schemas, caches, isolation of
the three parts, and the rate limit."""

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any
from unittest.mock import MagicMock

import pytest
from api_fakes import FakeMarts, api_client, make_settings
from google.api_core.exceptions import Forbidden

from tracemail_api.panel import DeliveryPanel, RunsPanel, StageRow, StageState
from tracemail_api.rate_limit import WINDOW_SECONDS, RateLimiter
from tracemail_api.routes.public import refresh_window
from tracemail_api.warehouse import MartsReader

PANEL = "/api/v1/public/health-panel"
RUNS = f"{PANEL}/runs"
STORAGE = f"{PANEL}/storage"
DELIVERY = f"{PANEL}/delivery"
PARTS = [RUNS, STORAGE, DELIVERY]


def denied() -> Forbidden:
    return Forbidden("Access Denied: Table landing.github_deployments")  # type: ignore[no-untyped-call]


def test_every_panel_part_is_open_to_visitors() -> None:
    with api_client(marts=FakeMarts()) as client:
        runs, storage, delivery = (client.get(url) for url in PARTS)
    assert [r.status_code for r in (runs, storage, delivery)] == [200, 200, 200]
    assert runs.json()["on_time_streak_hours"] == 31
    assert runs.json()["stages"][0]["hours"] == ["ok", "skipped"]
    assert runs.json()["freshness_objective_percent"] == 99.0
    assert storage.json()["resources"][0]["projected_month"] is None
    assert delivery.json()["delivery"]["deployments"] == 14


def test_each_panel_part_reads_bigquery_once_per_refresh_window() -> None:
    marts = FakeMarts()
    with api_client(marts=marts) as client:
        for url in PARTS + PARTS:
            client.get(url)
    assert marts.part_reads == {"runs": 1, "storage": 1, "delivery": 1}


def test_a_failing_part_answers_503_and_leaves_the_others_up(
    caplog: pytest.LogCaptureFixture,
) -> None:
    marts = FakeMarts(failing_parts={"delivery": denied()})
    with caplog.at_level(logging.WARNING), api_client(marts=marts) as client:
        codes = [client.get(url).status_code for url in PARTS]
        body = client.get(DELIVERY).text
    assert codes == [200, 200, 503]
    assert "Health panel part delivery unavailable (Forbidden)" in caplog.text
    assert "github_deployments" not in caplog.text
    assert "github_deployments" not in body


def test_a_failed_part_is_read_again_on_the_next_request() -> None:
    marts = FakeMarts(failing_parts={"storage": denied()})
    with api_client(marts=marts) as client:
        first = client.get(STORAGE).status_code
        marts.failing_parts.clear()
        second = client.get(STORAGE).status_code
    assert (first, second) == (503, 200)
    assert marts.part_reads["storage"] == 2


@pytest.mark.parametrize(
    ("earlier", "later", "same"),
    [
        ((10, 6), (10, 34), True),
        ((10, 4), (10, 6), False),
        ((10, 34), (10, 36), False),
        ((10, 36), (11, 4), True),
    ],
)
def test_refresh_windows_start_five_minutes_past_the_hour_and_half_hour(
    earlier: tuple[int, int], later: tuple[int, int], same: bool
) -> None:
    first = datetime(2026, 10, 14, *earlier, tzinfo=UTC)
    second = datetime(2026, 10, 14, *later, tzinfo=UTC)
    assert (refresh_window(first) == refresh_window(second)) is same


def test_panel_parts_answer_429_over_the_per_client_limit() -> None:
    settings = make_settings().model_copy(update={"public_requests_per_minute": 2})
    with api_client(marts=FakeMarts(), settings=settings) as client:
        codes = [client.get(url).status_code for url in PARTS]
        other = client.get(RUNS, headers={"cf-connecting-ip": "203.0.113.7"})
    assert codes == [200, 200, 429]
    assert other.status_code == 200


def test_rate_limiter_starts_counting_again_in_the_next_window() -> None:
    limiter = RateLimiter(limit=1)
    assert limiter.allow("a", 0.0)
    assert not limiter.allow("a", 1.0)
    assert limiter.allow("b", 1.0)
    assert limiter.allow("a", float(WINDOW_SECONDS))


def test_stage_rows_accept_pending_hours() -> None:
    row = StageRow.model_validate(
        {
            "job_name": "ingest_mail",
            "last_run_at": None,
            "last_run_status": None,
            "last_duration_seconds": None,
            "median_duration_seconds": None,
            "hours": ["ok", "pending"],
        }
    )
    assert row.hours[-1] is StageState.PENDING


def test_panel_parts_read_null_sections_as_empty_lists() -> None:
    read_at = datetime(2026, 10, 14, tzinfo=UTC)
    runs = RunsPanel.model_validate(
        {
            "read_at": read_at,
            "freshness_target_hours": 2,
            "freshness_objective_percent": 99.0,
            **PANEL_ROW,
            "resources": None,
        }
    )
    delivery = DeliveryPanel.model_validate({"read_at": read_at, **DELIVERY_ROW})
    assert runs.stages == [] and runs.resources == []
    assert delivery.recent_deployments == [] and delivery.delivery_days == []
    assert delivery.delivery.deployments == 0


PANEL_ROW: dict[str, Any] = {
    "last_ingest": None,
    "on_time_streak_hours": 0,
    "stages": None,
    "freshness_days": None,
    "dbt_days": None,
    "last_build": None,
    "resources": [
        {
            "allowance": "gcs_class_a",
            "used_to_date": 1,
            "projected_month": 2.0,
            "monthly_free": 5000,
        }
    ],
}
DELIVERY_ROW: dict[str, Any] = {
    "delivery": {
        "deployments": 0,
        "failed_attempts": 0,
        "median_lead_time_seconds": None,
        "changes_with_lead_time": 0,
        "change_failures": 0,
        "median_recovery_seconds": None,
        "recovered_failures": 0,
        "rework_deployments": 0,
        "last_deployed_at": None,
    },
    "delivery_days": None,
    "recent_deployments": None,
}
STORAGE_ROW: dict[str, Any] = {
    "allowance": "bigquery_storage_bytes",
    "used_to_date": 1_600_000,
    "monthly_free": 10_737_418_240,
}


def rows(row: dict[str, Any]) -> list[MagicMock]:
    return [MagicMock(items=row.items)]


def params(call: Any) -> dict[str, Any]:
    return {p.name: p.value for p in call.kwargs["job_config"].query_parameters}


def reader(row: dict[str, Any]) -> tuple[MartsReader, MagicMock]:
    client = MagicMock()
    client.query.return_value.result.return_value = rows(row)
    return MartsReader(client, make_settings()), client


def test_runs_part_queries_run_records_with_its_parameters() -> None:
    marts, client = reader(PANEL_ROW)
    [panel] = asyncio.run(marts.runs_panel())
    assert [r.allowance for r in panel.resources] == ["gcs_class_a"]
    [call] = client.query.call_args_list
    assert "from fct_hourly_stages" in call.args[0]
    assert "fct_deployments" not in call.args[0]
    assert params(call) == {
        "display_timezone": "Europe/Istanbul",
        "window_days": 30,
        "stage_hours": 24,
        "median_days": 7,
    }


def test_storage_part_reads_table_metadata_without_a_projection() -> None:
    marts, client = reader(STORAGE_ROW)
    [panel] = asyncio.run(marts.storage_panel())
    assert panel.resources[0].allowance == "bigquery_storage_bytes"
    assert panel.resources[0].projected_month is None
    [call] = client.query.call_args_list
    assert "from fct_bigquery_storage" in call.args[0]


def test_delivery_part_queries_deployments_with_its_parameters() -> None:
    marts, client = reader(DELIVERY_ROW)
    [panel] = asyncio.run(marts.delivery_panel())
    assert panel.delivery.deployments == 0
    [call] = client.query.call_args_list
    assert "from fct_deployments" in call.args[0]
    assert params(call) == {
        "display_timezone": "Europe/Istanbul",
        "window_days": 30,
        "recent_deployments": 5,
    }
