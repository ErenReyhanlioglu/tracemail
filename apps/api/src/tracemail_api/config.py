"""API settings read from the environment.

Every value without a default is required: a missing value fails at startup
instead of falling back to a plausible-looking one (CLAUDE.md, Configuration
and Secrets).
"""

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_PREFIX = "TRACEMAIL_API_"
# ADR-0015: the owner session lasts 90 days unless configured otherwise.
DEFAULT_SESSION_DAYS = 90


class ApiSettings(BaseSettings):
    """Configuration for the HTTP API."""

    # hide_input_in_errors: a validation error must never echo input values,
    # because they include secrets (SecretStr only masks after validation).
    model_config = SettingsConfigDict(
        env_prefix=ENV_PREFIX, extra="ignore", hide_input_in_errors=True
    )

    google_client_id: str
    google_client_secret: SecretStr
    # Google's stable account id of the one account allowed in (ADR-0015).
    owner_sub: str
    session_secret: SecretStr
    # Base URL the browser uses; the OAuth redirect URI is built from it, never
    # from the request, which is not the public one behind the tunnel.
    public_url: str
    session_days: int = DEFAULT_SESSION_DAYS
