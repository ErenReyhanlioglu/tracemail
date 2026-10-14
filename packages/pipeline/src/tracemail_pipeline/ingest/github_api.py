"""Read-only access to GitHub's REST API for deployment records (ADR-0045).

The repository is public and its deployments, statuses, and pull requests
answer without authentication, so no credential exists to leak; the limit is
60 requests an hour per address. Every request is counted for the run's
result (ADR-0017). The standard library suffices for a few GET requests.
"""

import json
import urllib.error
import urllib.request
from typing import Any, Protocol

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_PREFIX = "TRACEMAIL_"
ACCEPT = "application/vnd.github+json"
TIMEOUT_SECONDS = 30


class GithubApiError(Exception):
    """GitHub answered with an error or could not be reached."""


class DeliverySettings(BaseSettings):
    """Where the deployments come from. Separate from the mail settings, so
    a missing value stops only the delivery step."""

    model_config = SettingsConfigDict(
        env_prefix=ENV_PREFIX, extra="ignore", hide_input_in_errors=True
    )

    github_api_url: str
    # owner/name of the repository whose deployments are measured.
    github_repository: str


class GithubApi(Protocol):
    """GET requests against one repository, counted."""

    requests: int

    def get(self, path: str) -> Any: ...


class UrllibGithubApi:
    """GitHub's REST API over urllib, scoped to one repository."""

    def __init__(self, settings: DeliverySettings) -> None:
        self._base = (
            f"{settings.github_api_url.rstrip('/')}/repos/{settings.github_repository}"
        )
        self.requests = 0

    def get(self, path: str) -> Any:
        """The decoded JSON of ``GET /repos/{owner}/{repo}{path}``."""
        request = urllib.request.Request(
            f"{self._base}{path}", headers={"Accept": ACCEPT}
        )
        self.requests += 1
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
                return json.load(response)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            raise GithubApiError(f"GET {path} failed: {type(e).__name__}") from e
