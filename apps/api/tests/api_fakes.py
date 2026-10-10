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
from tracemail_api.routes.auth import get_google
from tracemail_api.warehouse import ApplicationRow, MartsReader

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


class FakeMarts(MartsReader):
    """Serves fixed rows and counts queries; can simulate an outage."""

    def __init__(
        self, rows: list[ApplicationRow] | None = None, error: Exception | None = None
    ) -> None:
        self.rows = rows or []
        self.error = error
        self.modified = datetime(2026, 10, 1, tzinfo=UTC)
        self.queries = 0
        self.closed = False

    def close(self) -> None:
        self.closed = True

    async def check(self) -> None:
        if self.error is not None:
            raise self.error

    async def applications_modified(self) -> datetime | None:
        return self.modified

    async def applications(self) -> list[ApplicationRow]:
        self.queries += 1
        return self.rows


@contextmanager
def api_client(
    google: FakeGoogle | None = None, marts: FakeMarts | None = None
) -> Iterator[TestClient]:
    """A test client for an app wired to fakes; the lifespan runs."""
    app = create_app(make_settings(), marts or FakeMarts())
    fake_google = google or FakeGoogle()
    app.dependency_overrides[get_google] = lambda: fake_google
    with TestClient(app, base_url=BASE_URL, follow_redirects=False) as client:
        yield client


def sign_in(client: TestClient) -> None:
    """Complete a login with the fake Google identity."""
    client.get(CALLBACK)
