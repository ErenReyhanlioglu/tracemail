"""Tests for owner login, sessions, and logout, with a fake Google client.

The fake stands in for Authlib's client: Authlib's own state, nonce, PKCE, and
ID-token checks are not re-tested here; what is tested is what the API does
with their result.
"""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from authlib.integrations.starlette_client import OAuthError
from fastapi.testclient import TestClient
from pydantic import SecretStr
from starlette.requests import Request
from starlette.responses import RedirectResponse, Response

from tracemail_api.auth.google import (
    CALLBACK_PATH,
    PKCE_METHOD,
    SCOPE,
    callback_url,
    google_client,
)
from tracemail_api.auth.sessions import (
    EXPIRES_KEY,
    ROLE_KEY,
    Role,
    current_role,
    start_session,
)
from tracemail_api.config import ApiSettings
from tracemail_api.main import SESSION_COOKIE, create_app
from tracemail_api.routes.auth import get_google

OWNER_SUB = "100000000000000000001"
OTHER_SUB = "100000000000000000002"
GOOGLE_AUTHORIZE = "https://accounts.google.test/authorize"
# TestClient talks plain HTTP; the cookie is Secure, so use an https base URL.
BASE_URL = "https://testserver"


def settings() -> ApiSettings:
    return ApiSettings(
        google_client_id="client-id",
        google_client_secret=SecretStr("client-secret"),
        owner_sub=OWNER_SUB,
        session_secret=SecretStr("session-secret"),
        public_url="http://localhost:8000/",
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


def client_with(google: FakeGoogle) -> Iterator[TestClient]:
    app = create_app(settings())
    app.dependency_overrides[get_google] = lambda: google
    with TestClient(app, base_url=BASE_URL, follow_redirects=False) as client:
        yield client


@pytest.fixture
def owner_client() -> Iterator[TestClient]:
    yield from client_with(FakeGoogle())


def test_login_redirects_to_google_with_the_configured_callback_url() -> None:
    google = FakeGoogle()
    for client in client_with(google):
        response = client.get("/api/v1/auth/google/login")
        assert response.status_code == 302
        assert response.headers["location"] == GOOGLE_AUTHORIZE
    assert google.redirect_uri == f"http://localhost:8000{CALLBACK_PATH}"


def test_owner_callback_sets_a_secure_httponly_lax_cookie_and_redirects(
    owner_client: TestClient,
) -> None:
    response = owner_client.get("/api/v1/auth/google/callback")
    assert (response.status_code, response.headers["location"]) == (303, "/")
    cookie = response.headers["set-cookie"].lower()
    assert cookie.startswith(f"{SESSION_COOKIE}=")
    for attribute in ("httponly", "secure", "samesite=lax", "max-age=7776000"):
        assert attribute in cookie
    assert owner_client.get("/api/v1/auth/me").json() == {"role": "owner"}


def test_other_account_gets_403_with_its_own_id_and_no_session() -> None:
    for client in client_with(FakeGoogle(sub=OTHER_SUB)):
        response = client.get("/api/v1/auth/google/callback")
        assert response.status_code == 403
        assert response.json() == {
            "detail": "This account is not authorized",
            "account_id": OTHER_SUB,
        }
        assert SESSION_COOKIE not in response.cookies
        assert client.get("/api/v1/auth/me").status_code == 401


@pytest.mark.parametrize(
    "google", [FakeGoogle(error="mismatching_state"), FakeGoogle(sub=None)]
)
def test_failed_callback_returns_400_without_details_or_session(
    google: FakeGoogle,
) -> None:
    for client in client_with(google):
        response = client.get("/api/v1/auth/google/callback")
        assert response.status_code == 400
        assert response.json() == {"detail": "Login failed"}
        assert client.get("/api/v1/auth/me").status_code == 401


def test_me_without_a_session_is_401(owner_client: TestClient) -> None:
    assert owner_client.get("/api/v1/auth/me").status_code == 401


def test_logout_ends_the_session(owner_client: TestClient) -> None:
    owner_client.get("/api/v1/auth/google/callback")
    assert owner_client.post("/api/v1/auth/logout").status_code == 204
    assert owner_client.get("/api/v1/auth/me").status_code == 401


def test_tampered_cookie_is_ignored(owner_client: TestClient) -> None:
    owner_client.get("/api/v1/auth/google/callback")
    value = owner_client.cookies[SESSION_COOKIE]
    owner_client.cookies.set(SESSION_COOKIE, value[:-2] + "xx")
    assert owner_client.get("/api/v1/auth/me").status_code == 401


def test_every_response_sets_no_referrer(owner_client: TestClient) -> None:
    response = owner_client.get("/api/v1/auth/me")
    assert response.headers["referrer-policy"] == "no-referrer"


def test_session_expires_at_its_fixed_end_and_is_cleared() -> None:
    start = datetime(2026, 10, 1, tzinfo=UTC)
    session: dict[str, Any] = {"_state_google_x": "pending login"}
    start_session(session, Role.OWNER, start, timedelta(days=90))
    assert set(session) == {ROLE_KEY, EXPIRES_KEY}
    assert current_role(session, start + timedelta(days=89)) == Role.OWNER
    assert current_role(session, start + timedelta(days=90)) is None
    assert session == {}


@pytest.mark.parametrize(
    "session",
    [{}, {ROLE_KEY: "admin", EXPIRES_KEY: 1}, {ROLE_KEY: "owner", EXPIRES_KEY: "x"}],
)
def test_session_without_a_known_role_and_expiry_has_no_role(
    session: dict[str, Any],
) -> None:
    assert current_role(session, datetime(2026, 10, 1, tzinfo=UTC)) is None


def test_google_client_requests_identity_scopes_with_pkce() -> None:
    client: Any = google_client(settings())
    assert client.client_kwargs == {"scope": SCOPE, "code_challenge_method": "S256"}
    assert (SCOPE, PKCE_METHOD) == ("openid email", "S256")


def test_callback_url_joins_base_url_and_fixed_path() -> None:
    assert (
        callback_url(settings()) == "http://localhost:8000/api/v1/auth/google/callback"
    )
