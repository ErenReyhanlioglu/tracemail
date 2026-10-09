"""Sender exclusion list applied before anything is stored (ADR-0025).

The mailbox is dedicated to the job search, so every message is kept except
mail from excluded senders: personal accounts (banks, security notices) and
newsletters. Excluded mail is never downloaded beyond its headers and never
written anywhere (CLAUDE.md, Privacy). Matching is case-insensitive. An exact
entry matches one address; a domain entry matches the domain itself and any of
its subdomains.
"""

from email.utils import parseaddr
from pathlib import Path

import yaml
from pydantic import BaseModel, field_validator


class SenderExclusionsError(Exception):
    """The exclusion file is missing or malformed."""


class SenderExclusions(BaseModel):
    """Excluded sender addresses and domains."""

    exact: list[str] = []
    domains: list[str] = []

    @field_validator("exact", "domains")
    @classmethod
    def _normalize(cls, entries: list[str]) -> list[str]:
        return [entry.strip().lower() for entry in entries]

    def excludes(self, from_header: str) -> bool:
        """Return whether a ``From`` header value belongs to an excluded sender."""
        return self.matching_entry(from_header) is not None

    def matching_entry(self, from_header: str) -> str | None:
        """Return the exclusion entry a ``From`` header matches, if any."""
        address = parseaddr(from_header)[1].strip().lower()
        if "@" not in address:
            return None
        if address in self.exact:
            return address
        host = address.rsplit("@", maxsplit=1)[1]
        for domain in self.domains:
            if host == domain or host.endswith(f".{domain}"):
                return domain
        return None


def load_sender_exclusions(path: Path) -> SenderExclusions:
    """Load and validate the exclusion YAML file; fails fast on any problem."""
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise SenderExclusionsError(f"Exclusion file must be a mapping: {path}")
    return SenderExclusions.model_validate(raw)
