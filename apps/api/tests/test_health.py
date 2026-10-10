"""Tests for the public health endpoint."""

import logging

import pytest
from api_fakes import FakeMarts, api_client
from google.api_core.exceptions import Forbidden
from google.auth.exceptions import DefaultCredentialsError

URL = "/api/v1/health"


def test_health_is_200_when_bigquery_answers() -> None:
    with api_client(marts=FakeMarts()) as client:
        response = client.get(URL)
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "bigquery": "ok"}


# google-api-core and google-auth leave their exception constructors
# unannotated.
ERRORS = [
    Forbidden("Access Denied: Dataset test-project:marts"),  # type: ignore[no-untyped-call]
    DefaultCredentialsError("no credentials"),  # type: ignore[no-untyped-call]
    ConnectionError("network down"),
]


@pytest.mark.parametrize("error", ERRORS)
def test_health_is_503_without_error_details(
    error: Exception, caplog: pytest.LogCaptureFixture
) -> None:
    with (
        caplog.at_level(logging.WARNING),
        api_client(marts=FakeMarts(error=error)) as client,
    ):
        response = client.get(URL)
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "bigquery": "unavailable"}
    assert str(error) not in caplog.text
    assert type(error).__name__ in caplog.text


def test_health_needs_no_session() -> None:
    with api_client() as client:
        assert client.get(URL).status_code == 200
