"""Tests for the private application list: access, paging, and caching."""

import asyncio
from datetime import UTC, date, datetime

from api_fakes import FakeMarts, api_client, application, sign_in

from tracemail_api.routes.applications import MAX_PAGE_SIZE, ApplicationCache

URL = "/api/v1/applications"
ROWS = [application(f"app-{n}", date(2026, 10, 10 - n)) for n in range(5)]


def test_visitor_gets_401_and_no_query_runs() -> None:
    marts = FakeMarts(ROWS)
    with api_client(marts=marts) as client:
        response = client.get(URL)
    assert response.status_code == 401
    assert response.json() == {"detail": "Not signed in"}
    assert marts.queries == 0


def test_owner_gets_one_page_with_the_total() -> None:
    with api_client(marts=FakeMarts(ROWS)) as client:
        sign_in(client)
        body = client.get(URL, params={"page": 2, "page_size": 2}).json()
    assert [item["application_key"] for item in body["items"]] == ["app-2", "app-3"]
    assert (body["page"], body["page_size"], body["total"]) == (2, 2, 5)


def test_page_past_the_end_is_empty_not_an_error() -> None:
    with api_client(marts=FakeMarts(ROWS)) as client:
        sign_in(client)
        body = client.get(URL, params={"page": 9}).json()
    assert (body["items"], body["total"]) == ([], 5)


def test_invalid_paging_is_422() -> None:
    with api_client(marts=FakeMarts(ROWS)) as client:
        sign_in(client)
        assert client.get(URL, params={"page": 0}).status_code == 422
        too_big = {"page_size": MAX_PAGE_SIZE + 1}
        assert client.get(URL, params=too_big).status_code == 422


def test_repeated_requests_reuse_the_cache_until_the_table_changes() -> None:
    marts = FakeMarts(ROWS)
    with api_client(marts=marts) as client:
        sign_in(client)
        client.get(URL)
        client.get(URL)
        assert marts.queries == 1
        marts.modified = datetime(2026, 10, 2, tzinfo=UTC)
        client.get(URL)
    assert marts.queries == 2


def test_cache_rereads_when_the_local_date_changes() -> None:
    marts = FakeMarts(ROWS)
    cache = ApplicationCache()
    for day in (10, 10, 11):
        asyncio.run(cache.rows(marts, date(2026, 10, day)))
    assert marts.queries == 2


def test_marts_client_is_closed_on_shutdown() -> None:
    marts = FakeMarts()
    with api_client(marts=marts):
        assert not marts.closed
    assert marts.closed
