"""API settings read from the environment.

Every value without a default is required: a missing value fails at startup
instead of falling back to a plausible-looking one (CLAUDE.md, Configuration
and Secrets).
"""

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_PREFIX = "TRACEMAIL_API_"
# Values shared with the pipeline keep the pipeline's variable names.
SHARED_PREFIX = "TRACEMAIL_"
# ADR-0015: the owner session lasts 90 days unless configured otherwise.
DEFAULT_SESSION_DAYS = 90
# ADR-0044: every hourly interval reaches the marts within 2 hours (the dbt
# var freshness_target_hours computes it; this is the label), 99% of them.
DEFAULT_FRESHNESS_TARGET_HOURS = 2
DEFAULT_FRESHNESS_OBJECTIVE_PERCENT = 99.0
# Requests per client and minute on the public endpoints (CLAUDE.md, API).
DEFAULT_PUBLIC_REQUESTS_PER_MINUTE = 60


class ApiSettings(BaseSettings):
    """Configuration for the HTTP API."""

    # hide_input_in_errors: a validation error must never echo input values,
    # because they include secrets (SecretStr only masks after validation).
    model_config = SettingsConfigDict(
        env_prefix=ENV_PREFIX,
        extra="ignore",
        hide_input_in_errors=True,
        validate_by_name=True,
    )

    gcp_project: str = Field(validation_alias=f"{SHARED_PREFIX}GCP_PROJECT")
    bq_location: str = Field(validation_alias=f"{SHARED_PREFIX}BQ_LOCATION")
    bq_marts_dataset: str = Field(validation_alias=f"{SHARED_PREFIX}BQ_MARTS_DATASET")
    # Upper bound on bytes billed by any single query (CLAUDE.md, cost guardrail).
    bq_max_bytes_billed: int = Field(
        validation_alias=f"{SHARED_PREFIX}BQ_MAX_BYTES_BILLED"
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
    freshness_target_hours: int = DEFAULT_FRESHNESS_TARGET_HOURS
    freshness_objective_percent: float = DEFAULT_FRESHNESS_OBJECTIVE_PERCENT
    public_requests_per_minute: int = DEFAULT_PUBLIC_REQUESTS_PER_MINUTE
