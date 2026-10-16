"""Shared test helpers: settings, fake Google and BigQuery, and test clients.

No test reaches Google or BigQuery: the app is built with a fake marts reader
and its Google client is replaced through the dependency override.
"""

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, date, datetime
from typing import Any

from authlib.integrations.starlette_client import OAuthError
from fastapi.testclient import TestClient
from pydantic import SecretStr
from starlette.requests import Request
from starlette.responses import RedirectResponse, Response

from tracemail_api.config import ApiSettings
from tracemail_api.main import create_app
from tracemail_api.panel import DeliveryPanel, RunsPanel, StoragePanel
from tracemail_api.routes.auth import get_google
from tracemail_api.warehouse import ApplicationRow, MartsReader, PostingRow

OWNER_SUB = "100000000000000000001"
OTHER_SUB = "100000000000000000002"
GOOGLE_AUTHORIZE = "https://accounts.google.test/authorize"
# TestClient talks plain HTTP; the cookie is Secure, so use an https base URL.
BASE_URL = "https://testserver"
CALLBACK = "/api/v1/auth/google/callback"


def make_settings() -> ApiSettings:
    return ApiSettings(
        google_client_id="client-id",
        google_client_secret=SecretStr("client-secret"),
        owner_sub=OWNER_SUB,
        session_secret=SecretStr("session-secret"),
        public_url="http://localhost:8000/",
        gcp_project="test-project",
        bq_location="us-central1",
        bq_marts_dataset="marts",
        bq_max_bytes_billed=1_000_000,
    )


def application(key: str, last_event: date) -> ApplicationRow:
    return ApplicationRow(
        application_key=key,
        company="Example Company",
        title="Example Role",
        location="Istanbul",
        channel="linkedin",
        posting_url=None,
        applied_on=last_event,
        current_status="applied",
        last_event_date=last_event,
        days_since_last_event=1,
        is_silent=False,
        is_closed_without_reply=False,
        event_count=1,
    )


class FakeGoogle:
    """Returns a fixed identity, or raises like Authlib on a bad callback."""

    def __init__(self, sub: str | None = OWNER_SUB, error: str | None = None) -> None:
        self.sub = sub
        self.error = error
        self.redirect_uri: str | None = None

    async def authorize_redirect(self, request: Request, redirect_uri: str) -> Response:
        self.redirect_uri = redirect_uri
        return RedirectResponse(GOOGLE_AUTHORIZE, status_code=302)

    async def authorize_access_token(self, request: Request) -> dict[str, Any]:
        if self.error is not None:
            raise OAuthError(error=self.error)
        return {} if self.sub is None else {"userinfo": {"sub": self.sub}}


def posting(
    key: str,
    first_seen: date,
    *,
    saved: bool = False,
    applied_on: date | None = None,
    title: str = "Example Role",
    company: str = "Example Company",
) -> PostingRow:
    return PostingRow(
        posting_key=key,
        title=title,
        company=company,
        location="Istanbul",
        posting_url=None,
        first_seen_date=first_seen,
        last_seen_date=first_seen,
        mention_count=1,
        is_saved=saved,
        has_application=applied_on is not None,
        applied_on=applied_on,
    )


PANEL_READ_AT = datetime(2026, 10, 14, 0, 0, 3, tzinfo=UTC)


def runs_panel_row() -> RunsPanel:
    """A small run-records part: one stage, one day of each strip, one
    allowance."""
    started = PANEL_READ_AT
    return RunsPanel.model_validate(
        {
            "read_at": started,
            "freshness_target_hours": 2,
            "freshness_objective_percent": 99.0,
            "last_ingest": {
                "started_at": started,
                "duration_seconds": 4.2,
                "run_status": "COMPLETE",
            },
            "on_time_streak_hours": 31,
            "stages": [
                {
                    "job_name": "ingest_mail",
                    "last_run_at": started,
                    "last_run_status": "COMPLETE",
                    "last_duration_seconds": 4.2,
                    "median_duration_seconds": 4.0,
                    "hours": ["ok", "skipped"],
                }
            ],
            "freshness_days": [
                {
                    "local_date": date(2026, 10, 13),
                    "state": "ok",
                    "hours": 24,
                    "on_time": 24,
                }
            ],
            "dbt_days": [
                {
                    "local_date": date(2026, 10, 12),
                    "state": "failed",
                    "builds": 3,
                    "builds_ok": 2,
                }
            ],
            "last_build": None,
            "resources": [
                {
                    "allowance": "gcs_class_a",
                    "used_to_date": 1273,
                    "projected_month": 1975.0,
                    "monthly_free": 5000,
                }
            ],
        }
    )


def storage_panel_row() -> StoragePanel:
    """BigQuery storage as one allowance without a projection."""
    return StoragePanel.model_validate(
        {
            "read_at": PANEL_READ_AT,
            "resources": [
                {
                    "allowance": "bigquery_storage_bytes",
                    "used_to_date": 1_600_000,
                    "projected_month": None,
                    "monthly_free": 10_737_418_240,
                }
            ],
        }
    )


def delivery_panel_row() -> DeliveryPanel:
    """Delivery metrics with one day and one deployment."""
    return DeliveryPanel.model_validate(
        {
            "read_at": PANEL_READ_AT,
            "delivery": {
                "deployments": 14,
                "failed_attempts": 1,
                "median_lead_time_seconds": 706.0,
                "changes_with_lead_time": 14,
                "change_failures": 1,
                "median_recovery_seconds": 20571.0,
                "recovered_failures": 1,
                "rework_deployments": 1,
                "last_deployed_at": PANEL_READ_AT,
            },
            "delivery_days": [{"local_date": date(2026, 10, 13), "state": "ok"}],
            "recent_deployments": [
                {
                    "deployed_at": PANEL_READ_AT,
                    "pull_request_number": 24,
                    "pull_request_title": "fix: pending hours",
                    "lead_time_seconds": 514.0,
                    "is_change_failure": False,
                }
            ],
        }
    )


class FakeMarts(MartsReader):
    """Serves fixed rows and counts queries; can simulate an outage, of the
    whole warehouse or of panel parts (by name: runs, storage, delivery)."""

    def __init__(
        self,
        rows: list[ApplicationRow] | None = None,
        error: Exception | None = None,
        postings: list[PostingRow] | None = None,
        failing_parts: dict[str, Exception] | None = None,
    ) -> None:
        self.rows = rows or []
        self.posting_rows = postings or []
        self.error = error
        self.failing_parts = failing_parts or {}
        self.part_reads: dict[str, int] = {}
        self.last_modified = datetime(2026, 10, 1, tzinfo=UTC)
        self.queries = 0
        self.closed = False

    def close(self) -> None:
        self.closed = True

    async def check(self) -> None:
        if self.error is not None:
            raise self.error

    async def modified(self, table: str) -> datetime | None:
        return self.last_modified

    async def applications(self) -> list[ApplicationRow]:
        self.queries += 1
        return self.rows

    async def postings(self) -> list[PostingRow]:
        self.queries += 1
        return self.posting_rows

    def _read_part(self, name: str) -> None:
        self.queries += 1
        self.part_reads[name] = self.part_reads.get(name, 0) + 1
        if name in self.failing_parts:
            raise self.failing_parts[name]

    async def runs_panel(self) -> list[RunsPanel]:
        self._read_part("runs")
        return [runs_panel_row()]

    async def storage_panel(self) -> list[StoragePanel]:
        self._read_part("storage")
        return [storage_panel_row()]

    async def delivery_panel(self) -> list[DeliveryPanel]:
        self._read_part("delivery")
        return [delivery_panel_row()]


@contextmanager
def api_client(
    google: FakeGoogle | None = None,
    marts: FakeMarts | None = None,
    settings: ApiSettings | None = None,
) -> Iterator[TestClient]:
    """A test client for an app wired to fakes; the lifespan runs."""
    app = create_app(settings or make_settings(), marts or FakeMarts())
    fake_google = google or FakeGoogle()
    app.dependency_overrides[get_google] = lambda: fake_google
    with TestClient(app, base_url=BASE_URL, follow_redirects=False) as client:
        yield client


def sign_in(client: TestClient) -> None:
    """Complete a login with the fake Google identity."""
    client.get(CALLBACK)
