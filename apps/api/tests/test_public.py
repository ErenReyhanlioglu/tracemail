"""Tests for the public health-panel endpoint: schema, cache, rate limit."""

import asyncio
from datetime import UTC, datetime
from typing import Any
from unittest.mock import MagicMock

import pytest
from api_fakes import FakeMarts, api_client, make_settings

from tracemail_api.panel import HealthPanel
from tracemail_api.rate_limit import WINDOW_SECONDS, RateLimiter
from tracemail_api.routes.public import refresh_window
from tracemail_api.warehouse import MartsReader

URL = "/api/v1/public/health-panel"


def test_health_panel_is_open_to_visitors() -> None:
    with api_client(marts=FakeMarts()) as client:
        response = client.get(URL)
    assert response.status_code == 200
    body = response.json()
    assert body["on_time_streak_hours"] == 31
    assert body["stages"][0]["hours"] == ["ok", "skipped"]
    assert body["freshness_objective_percent"] == 99.0


def test_health_panel_reads_bigquery_once_per_refresh_window() -> None:
    marts = FakeMarts()
    with api_client(marts=marts) as client:
        client.get(URL)
        client.get(URL)
    assert marts.queries == 1


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


def test_health_panel_answers_429_over_the_per_client_limit() -> None:
    settings = make_settings().model_copy(update={"public_requests_per_minute": 2})
    with api_client(marts=FakeMarts(), settings=settings) as client:
        codes = [client.get(URL).status_code for _ in range(3)]
        other = client.get(URL, headers={"cf-connecting-ip": "203.0.113.7"})
    assert codes == [200, 200, 429]
    assert other.status_code == 200


def test_rate_limiter_starts_counting_again_in_the_next_window() -> None:
    limiter = RateLimiter(limit=1)
    assert limiter.allow("a", 0.0)
    assert not limiter.allow("a", 1.0)
    assert limiter.allow("b", 1.0)
    assert limiter.allow("a", float(WINDOW_SECONDS))


def test_health_panel_reads_null_sections_as_empty_lists() -> None:
    panel = HealthPanel.model_validate(
        {
            "read_at": datetime(2026, 10, 14, tzinfo=UTC),
            "freshness_target_hours": 2,
            "freshness_objective_percent": 99.0,
            "last_ingest": None,
            "on_time_streak_hours": 0,
            "stages": None,
            "freshness_days": None,
            "dbt_days": None,
            "last_build": None,
            "resources": None,
        }
    )
    assert panel.stages == [] and panel.resources == []


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
STORAGE_ROW: dict[str, Any] = {
    "allowance": "bigquery_storage_bytes",
    "used_to_date": 1_600_000,
    "monthly_free": 10_737_418_240,
}


def test_reader_runs_the_panel_and_storage_queries_with_parameters() -> None:
    client = MagicMock()
    client.query.return_value.result.side_effect = [
        [MagicMock(items=PANEL_ROW.items)],
        [MagicMock(items=STORAGE_ROW.items)],
    ]
    [panel] = asyncio.run(MartsReader(client, make_settings()).health_panel())
    assert [r.allowance for r in panel.resources] == [
        "gcs_class_a",
        "bigquery_storage_bytes",
    ]
    assert panel.resources[1].projected_month is None
    first, second = client.query.call_args_list
    assert "from fct_hourly_stages" in first.args[0]
    assert "from fct_bigquery_storage" in second.args[0]
    params = {p.name: p.value for p in first.kwargs["job_config"].query_parameters}
    assert params == {
        "display_timezone": "Europe/Istanbul",
        "window_days": 30,
        "stage_hours": 24,
        "median_days": 7,
    }
