"""Sender allowlist applied before anything is stored.

Mail from a sender that is not on the allowlist is never downloaded beyond its
headers and never written anywhere (CLAUDE.md, Privacy). Matching is
case-insensitive. An exact entry matches one address; a domain entry matches
the domain itself and any of its subdomains.
"""

from email.utils import parseaddr
from pathlib import Path

import yaml
from pydantic import BaseModel, field_validator


class AllowlistError(Exception):
    """The allowlist file is missing or malformed."""


class SenderAllowlist(BaseModel):
    """Allowed sender addresses and domains."""

    exact: list[str] = []
    domains: list[str] = []

    @field_validator("exact", "domains")
    @classmethod
    def _normalize(cls, entries: list[str]) -> list[str]:
        return [entry.strip().lower() for entry in entries]

    def allows(self, from_header: str) -> bool:
        """Return whether a ``From`` header value belongs to an allowed sender."""
        address = parseaddr(from_header)[1].strip().lower()
        if "@" not in address:
            return False
        if address in self.exact:
            return True
        host = address.rsplit("@", maxsplit=1)[1]
        return any(host == d or host.endswith(f".{d}") for d in self.domains)


def load_allowlist(path: Path) -> SenderAllowlist:
    """Load and validate the allowlist YAML file; fails fast on any problem."""
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise AllowlistError(f"Allowlist file must be a mapping: {path}")
    return SenderAllowlist.model_validate(raw)
