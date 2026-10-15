"""Tests for deployment ingestion and parsing (ADR-0045), against a fake API."""

import io
import json
import urllib.error
from datetime import UTC, date, datetime
from types import SimpleNamespace
from typing import Any

import pytest

from tracemail_pipeline import delivery
from tracemail_pipeline.ingest.deployments import (
    JSON_CONTENT_TYPE,
    DeploymentIngestResult,
    deployment_object_key,
    ingest_deployments,
)
from tracemail_pipeline.ingest.github_api import (
    DeliverySettings,
    GithubApiError,
    UrllibGithubApi,
)
from tracemail_pipeline.load.landing import LoadLandingResult
from tracemail_pipeline.parse.deployments import (
    DEPLOYMENTS,
    DeploymentParseResult,
    parse_deployment,
    parse_deployments,
)
from tracemail_pipeline.parse.parsed_store import PartitionWrite

SHA = "a" * 40
WINDOW = (
    datetime(2026, 10, 14, 13, tzinfo=UTC),
    datetime(2026, 10, 14, 15, tzinfo=UTC),
)


def deployment(deployment_id: int, created: str, sha: str = SHA) -> dict[str, Any]:
    return {"id": deployment_id, "sha": sha, "created_at": created}


def status(state: str, at: str, run: int = 38578638171) -> dict[str, Any]:
    url = f"https://github.example/o/r/actions/runs/{run}/job/1"
    return {"state": state, "created_at": at, "log_url": url}


class FakeGithub:
    """Answers GET paths from a dict and counts requests."""

    def __init__(self, answers: dict[str, Any]) -> None:
        self.answers = answers
        self.requests = 0

    def get(self, path: str) -> Any:
        self.requests += 1
        return self.answers[path]


def github(statuses: list[dict[str, Any]], pulls: list[dict[str, Any]]) -> FakeGithub:
    return FakeGithub(
        {
            "/deployments?environment=production&per_page=100": [
                deployment(2, "2026-10-14T14:18:29Z"),
                deployment(1, "2026-10-13T10:00:00Z"),
            ],
            "/deployments/2/statuses": statuses,
            f"/commits/{SHA}/pulls": pulls,
            "/pulls/24/commits?per_page=100": [
                {"commit": {"author": {"date": "2026-10-14T14:12:00Z"}}},
                {"commit": {"author": {"date": "2026-10-14T14:10:14Z"}}},
            ],
        }
    )


PULL = {
    "number": 24,
    "title": "fix: pending hours",
    "merged_at": "2026-10-14T14:13:44Z",
}
DONE = [
    status("success", "2026-10-14T14:20:52Z"),
    status("in_progress", "2026-10-14T14:18:52Z"),
]


def test_finished_deployment_in_the_window_is_stored_once_as_json(
    fake_store: Any,
) -> None:
    api = github(DONE, [PULL])
    first = ingest_deployments(api, fake_store, *WINDOW)
    second = ingest_deployments(api, fake_store, *WINDOW)
    key = deployment_object_key(date(2026, 10, 14), 2)
    assert list(fake_store.objects) == [key]
    assert fake_store.content_types[key] == JSON_CONTENT_TYPE
    assert (first.in_window, first.written, first.written_days) == (
        1,
        1,
        [date(2026, 10, 14)],
    )
    assert (second.written, second.already_stored, second.written_days) == (0, 1, [])
    assert first.github_requests == 4
    # The second run asks GitHub only for the list: the stored deployment is
    # skipped before its statuses, pull request, and commits are requested.
    assert second.github_requests == 5
    assert second.gcs_existence_checks == 1


def test_deployment_still_running_is_left_for_a_later_run(
    fake_store: Any,
) -> None:
    api = github([status("in_progress", "2026-10-14T14:18:52Z")], [PULL])
    result = ingest_deployments(api, fake_store, *WINDOW)
    assert (result.unfinished, result.written, fake_store.objects) == (1, 0, {})


def test_parsed_row_keeps_state_run_pull_request_and_first_commit(
    fake_store: Any,
) -> None:
    ingest_deployments(github(DONE, [PULL]), fake_store, *WINDOW)
    key = deployment_object_key(date(2026, 10, 14), 2)
    row = parse_deployment(key, date(2026, 10, 14), fake_store.objects[key])
    assert (row.state, row.workflow_run_id, row.pull_request_number) == (
        "success",
        38578638171,
        24,
    )
    assert row.first_commit_at == datetime(2026, 10, 14, 14, 10, 14, tzinfo=UTC)
    assert row.finished_at == datetime(2026, 10, 14, 14, 20, 52, tzinfo=UTC)


def test_deployment_without_a_pull_request_has_no_lead_time(
    fake_store: Any,
) -> None:
    ingest_deployments(github(DONE, []), fake_store, *WINDOW)
    key = deployment_object_key(date(2026, 10, 14), 2)
    row = parse_deployment(key, date(2026, 10, 14), fake_store.objects[key])
    assert (row.pull_request_number, row.first_commit_at, row.merged_at) == (
        None,
        None,
        None,
    )


class FakeParsedStore:
    def __init__(self) -> None:
        self.partitions: dict[tuple[str, date], list[Any]] = {}

    def write_partition(self, record_type: str, day: date, rows: Any) -> PartitionWrite:
        self.partitions[(record_type, day)] = list(rows)
        return PartitionWrite(bytes_written=1, written=True, metadata_read=False)


def test_parse_rewrites_each_day_from_its_raw_records(fake_store: Any) -> None:
    ingest_deployments(github(DONE, [PULL]), fake_store, *WINDOW)
    parsed = FakeParsedStore()
    result = parse_deployments(
        fake_store, parsed, [date(2026, 10, 14), date(2026, 10, 15)]
    )
    assert [len(rows) for rows in parsed.partitions.values()] == [1, 0]
    assert (DEPLOYMENTS, date(2026, 10, 15)) in parsed.partitions
    assert (result.records, result.gcs_lists, result.files_written) == (1, 2, 2)


class FakeResponse(io.BytesIO):
    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *args: object) -> None:
        self.close()


SETTINGS = DeliverySettings(
    github_api_url="https://api.github.example/", github_repository="o/r"
)


def test_api_requests_the_repository_path_and_counts_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: list[str] = []

    def urlopen(request: Any, timeout: float) -> FakeResponse:
        seen.append(request.full_url)
        return FakeResponse(json.dumps([{"id": 1}]).encode())

    monkeypatch.setattr("urllib.request.urlopen", urlopen)
    api = UrllibGithubApi(SETTINGS)
    assert api.get("/deployments") == [{"id": 1}]
    assert seen == ["https://api.github.example/repos/o/r/deployments"]
    assert api.requests == 1


def test_api_failure_is_a_github_error_without_the_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def urlopen(request: Any, timeout: float) -> FakeResponse:
        raise urllib.error.URLError("rate limited")

    monkeypatch.setattr("urllib.request.urlopen", urlopen)
    with pytest.raises(GithubApiError, match="GET /deployments failed: URLError"):
        UrllibGithubApi(SETTINGS).get("/deployments")


def test_scheduled_run_looks_back_one_hour_and_full_window_a_day(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    windows: list[tuple[datetime, datetime]] = []

    def window(start: datetime, end: datetime) -> list[date]:
        windows.append((start, end))
        return [date(2026, 10, 14)]

    monkeypatch.setattr(delivery, "deliver_window", window)
    days = delivery.deliver_for_interval(
        "2026-10-14T13:00:00+00:00", "2026-10-14T14:00:00+00:00", "scheduled"
    )
    delivery.deliver_for_interval(
        "2026-10-14T13:00:00+00:00", "2026-10-14T14:00:00+00:00", "manual"
    )
    end = datetime(2026, 10, 14, 14, tzinfo=UTC)
    assert [start for start, _ in windows] == [
        datetime(2026, 10, 14, 12, tzinfo=UTC),
        datetime(2026, 10, 13, 13, tzinfo=UTC),
    ]
    assert all(stop == end for _, stop in windows)
    assert days == ["2026-10-14"]


class Recorder:
    """Stands in for the run-record writer: the job names in order."""

    def __init__(self) -> None:
        self.jobs: list[str] = []

    def write(self, record: Any) -> None:
        self.jobs.append(record.job_name)


@pytest.mark.parametrize(
    ("written", "jobs"),
    [
        ([], ["ingest_deployments"]),
        (
            [date(2026, 10, 14)],
            ["ingest_deployments", "parse_deployments", "load_deployments"],
        ),
    ],
)
def test_window_parses_and_loads_only_days_with_new_records(
    monkeypatch: pytest.MonkeyPatch, written: list[date], jobs: list[str]
) -> None:
    recorder = Recorder()
    settings = SimpleNamespace(
        data_bucket="bucket", bq_landing_dataset="landing", code_version="sha"
    )
    monkeypatch.setattr(delivery, "load_settings", lambda: settings)
    monkeypatch.setattr(delivery, "DeliverySettings", lambda: SETTINGS)
    monkeypatch.setattr(delivery, "bucket", lambda s: None)
    monkeypatch.setattr(delivery, "warehouse", lambda s: None)
    monkeypatch.setattr(delivery, "run_writer", lambda s: recorder)
    monkeypatch.setattr(
        delivery,
        "ingest_deployments",
        lambda *a: DeploymentIngestResult(written_days=written),
    )
    monkeypatch.setattr(
        delivery, "parse_deployments", lambda *a: DeploymentParseResult()
    )
    monkeypatch.setattr(delivery, "load_landing", lambda *a: LoadLandingResult())
    assert delivery.deliver_window(*WINDOW) == written
    assert recorder.jobs == jobs
