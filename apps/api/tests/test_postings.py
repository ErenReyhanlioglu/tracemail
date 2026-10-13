"""Tests for the private incoming-postings list: status, period, search,
paging."""

from datetime import date, timedelta

import pytest
from api_fakes import FakeMarts, api_client, posting, sign_in

from tracemail_api.routes.deps import local_today

URL = "/api/v1/postings"
TODAY = local_today()
POSTINGS = [
    posting("new-today", TODAY),
    posting("saved-3d", TODAY - timedelta(days=3), saved=True),
    posting(
        "applied-10d",
        TODAY - timedelta(days=10),
        saved=True,
        applied_on=date(2026, 9, 1),
    ),
    posting("new-40d", TODAY - timedelta(days=40)),
]


def keys(body: dict[str, list[dict[str, str]]]) -> list[str]:
    return [item["posting_key"] for item in body["items"]]


def get(params: dict[str, str | int]) -> dict:  # type: ignore[type-arg]
    with api_client(marts=FakeMarts(postings=POSTINGS)) as client:
        sign_in(client)
        response = client.get(URL, params=params)
        assert response.status_code == 200
        return response.json()  # type: ignore[no-any-return]


def test_visitor_gets_401_and_no_query_runs() -> None:
    marts = FakeMarts(postings=POSTINGS)
    with api_client(marts=marts) as client:
        assert client.get(URL).status_code == 401
    assert marts.queries == 0


def test_status_is_applied_over_saved_over_new() -> None:
    body = get({})
    statuses = {item["posting_key"]: item["status"] for item in body["items"]}
    assert statuses == {
        "new-today": "new",
        "saved-3d": "saved",
        "applied-10d": "applied",
        "new-40d": "new",
    }
    assert body["counts"] == {"all": 4, "applied": 1, "saved": 1, "new": 2}


@pytest.mark.parametrize(
    ("days", "expected"),
    [
        (1, ["new-today"]),
        (7, ["new-today", "saved-3d"]),
        (30, ["new-today", "saved-3d", "applied-10d"]),
    ],
)
def test_period_keeps_postings_first_seen_within_the_last_days(
    days: int, expected: list[str]
) -> None:
    body = get({"days": days})
    assert keys(body) == expected
    assert body["counts"]["all"] == len(expected)


def test_status_filter_narrows_items_but_counts_cover_the_period() -> None:
    body = get({"status": "new", "days": 30})
    assert keys(body) == ["new-today"]
    assert body["total"] == 1
    assert body["counts"] == {"all": 3, "applied": 1, "saved": 1, "new": 1}


def test_search_narrows_items_and_counts_by_title_or_company() -> None:
    rows = [
        posting("by-title", TODAY, title="Veri Mühendisi"),
        posting("by-company", TODAY, company="İş Bankası", saved=True),
        posting("other", TODAY),
    ]
    with api_client(marts=FakeMarts(postings=rows)) as client:
        sign_in(client)
        body = client.get(URL, params={"q": "veri"}).json()
        assert keys(body) == ["by-title"]
        assert body["counts"] == {"all": 1, "applied": 0, "saved": 0, "new": 1}
        body = client.get(URL, params={"q": "is bankasi", "status": "saved"}).json()
        assert keys(body) == ["by-company"]


@pytest.mark.parametrize(
    ("order", "expected"),
    [
        ("desc", ["new-today", "saved-3d", "applied-10d", "new-40d"]),
        ("asc", ["new-40d", "applied-10d", "saved-3d", "new-today"]),
    ],
)
def test_list_is_ordered_by_first_seen_in_either_direction(
    order: str, expected: list[str]
) -> None:
    assert keys(get({"order": order})) == expected


def test_list_can_be_ordered_by_last_seen() -> None:
    old_but_recent = posting("old-but-recent", TODAY - timedelta(days=20))
    old_but_recent.last_seen_date = TODAY
    rows = [posting("new-yesterday", TODAY - timedelta(days=1)), old_but_recent]
    with api_client(marts=FakeMarts(postings=rows)) as client:
        sign_in(client)
        body = client.get(URL, params={"sort": "last_seen"}).json()
        assert keys(body) == ["old-but-recent", "new-yesterday"]


def test_pages_slice_the_filtered_list() -> None:
    body = get({"page": 2, "page_size": 3})
    assert keys(body) == ["new-40d"]
    assert (body["page"], body["page_size"], body["total"]) == (2, 3, 4)


@pytest.mark.parametrize(
    "params",
    [
        {"status": "rejected"},
        {"days": 0},
        {"page_size": 101},
        {"q": "x" * 101},
        {"sort": "title"},
        {"order": "up"},
    ],
)
def test_invalid_parameters_are_422(params: dict[str, str | int]) -> None:
    with api_client(marts=FakeMarts(postings=POSTINGS)) as client:
        sign_in(client)
        assert client.get(URL, params=params).status_code == 422


def test_postings_are_cached_until_the_table_changes() -> None:
    marts = FakeMarts(postings=POSTINGS)
    with api_client(marts=marts) as client:
        sign_in(client)
        client.get(URL)
        client.get(URL, params={"status": "saved"})
        assert marts.queries == 1
