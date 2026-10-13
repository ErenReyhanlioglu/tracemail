"""Tests for owner login, sessions, and logout, with a fake Google client.

The fake stands in for Authlib's client: Authlib's own state, nonce, PKCE, and
ID-token checks are not re-tested here; what is tested is what the API does
with their result.
"""

import logging
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from api_fakes import (
    CALLBACK,
    GOOGLE_AUTHORIZE,
    OTHER_SUB,
    FakeGoogle,
    api_client,
    make_settings,
    sign_in,
)
from fastapi.testclient import TestClient

from tracemail_api.auth.google import CALLBACK_PATH, callback_url, google_client
from tracemail_api.auth.sessions import (
    EXPIRES_KEY,
    ROLE_KEY,
    Role,
    current_role,
    start_session,
)
from tracemail_api.main import ACCESS_LOGGER, SESSION_COOKIE


@pytest.fixture
def owner_client() -> Iterator[TestClient]:
    with api_client() as client:
        yield client


def test_login_redirects_to_google_with_the_configured_callback_url() -> None:
    google = FakeGoogle()
    with api_client(google) as client:
        response = client.get("/api/v1/auth/google/login")
    assert (response.status_code, response.headers["location"]) == (
        302,
        GOOGLE_AUTHORIZE,
    )
    assert google.redirect_uri == f"http://localhost:8000{CALLBACK_PATH}"


def test_owner_callback_sets_a_secure_httponly_lax_cookie_and_redirects(
    owner_client: TestClient,
) -> None:
    response = owner_client.get(CALLBACK)
    assert (response.status_code, response.headers["location"]) == (303, "/")
    cookie = response.headers["set-cookie"].lower()
    assert cookie.startswith(f"{SESSION_COOKIE}=")
    for attribute in ("httponly", "secure", "samesite=lax", "max-age=7776000"):
        assert attribute in cookie
    assert owner_client.get("/api/v1/auth/me").json() == {"role": "owner"}


def test_other_account_goes_to_login_as_not_authorized_without_id_or_session() -> None:
    with api_client(FakeGoogle(sub=OTHER_SUB)) as client:
        response = client.get(CALLBACK)
        assert (response.status_code, response.headers["location"]) == (
            303,
            "/login?error=not_authorized",
        )
        assert OTHER_SUB not in response.text
        assert SESSION_COOKIE not in response.cookies
        assert client.get("/api/v1/auth/me").status_code == 401


@pytest.mark.parametrize(
    "google", [FakeGoogle(error="mismatching_state"), FakeGoogle(sub=None)]
)
def test_failed_callback_is_sent_to_login_as_failed_without_session(
    google: FakeGoogle,
) -> None:
    with api_client(google) as client:
        response = client.get(CALLBACK)
        assert (response.status_code, response.headers["location"]) == (
            303,
            "/login?error=failed",
        )
        assert client.get("/api/v1/auth/me").status_code == 401


def test_me_without_a_session_is_401(owner_client: TestClient) -> None:
    assert owner_client.get("/api/v1/auth/me").status_code == 401


def test_logout_ends_the_session(owner_client: TestClient) -> None:
    sign_in(owner_client)
    assert owner_client.post("/api/v1/auth/logout").status_code == 204
    assert owner_client.get("/api/v1/auth/me").status_code == 401


def test_tampered_cookie_is_ignored(owner_client: TestClient) -> None:
    sign_in(owner_client)
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
    client: Any = google_client(make_settings())
    assert client.client_kwargs == {
        "scope": "openid email",
        "code_challenge_method": "S256",
    }


def test_callback_url_joins_base_url_and_fixed_path() -> None:
    assert callback_url(make_settings()) == f"http://localhost:8000{CALLBACK}"


def test_access_log_lines_never_contain_the_query_string(
    caplog: pytest.LogCaptureFixture,
) -> None:
    with api_client(), caplog.at_level(logging.INFO, logger=ACCESS_LOGGER):
        logging.getLogger(ACCESS_LOGGER).info(
            '%s - "%s %s HTTP/%s" %d',
            "127.0.0.1:1",
            "GET",
            f"{CALLBACK}?code=secret&state=s",
            "1.1",
            303,
        )
    assert caplog.messages == [f'127.0.0.1:1 - "GET {CALLBACK} HTTP/1.1" 303']
