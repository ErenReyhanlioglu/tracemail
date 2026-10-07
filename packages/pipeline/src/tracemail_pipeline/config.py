"""Pipeline settings read from the environment.

Every field is required: a missing value fails at startup instead of falling
back to a plausible-looking default (CLAUDE.md, Configuration and Secrets).
"""

from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_PREFIX = "TRACEMAIL_"


class PipelineSettings(BaseSettings):
    """Configuration for mail ingestion."""

    # hide_input_in_errors: a validation error must never echo input values,
    # because they include secrets (SecretStr only masks after validation).
    model_config = SettingsConfigDict(
        env_prefix=ENV_PREFIX, extra="ignore", hide_input_in_errors=True
    )

    imap_host: str
    imap_port: int
    imap_user: str
    imap_password: SecretStr
    imap_mailbox: str
    sender_allowlist_path: Path
    gcp_project: str
    data_bucket: str
