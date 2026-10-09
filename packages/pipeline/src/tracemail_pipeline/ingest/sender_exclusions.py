"""Exclusion list applied before anything is stored (ADR-0025).

The mailbox is dedicated to the job search, so every message is kept except
mail from excluded senders (personal accounts, newsletters) and mail whose
subject marks it as an account-security message (one-time passcodes, address
verification) — application systems send those from the same addresses as
their application mail. Excluded mail is never downloaded beyond its headers
and never written anywhere (CLAUDE.md, Privacy).

Sender matching is case-insensitive: an exact entry matches one address; a
domain entry matches the domain itself and any of its subdomains. Subject
patterns match anywhere in the subject, ignoring case, including Turkish
dotted and dotless i.
"""

from email.utils import parseaddr
from pathlib import Path

import yaml
from pydantic import BaseModel, field_validator

# Case-folding "İ" leaves a combining dot, "I" becomes a dotted "i", and the
# dotless "ı" stays distinct. Folding all of them to plain "i" makes
# "TEK KULLANIMLIK ŞİFRE" match "tek kullanımlık şifre".
TURKISH_I_FOLD = str.maketrans({"ı": "i", "̇": None})


class SenderExclusionsError(Exception):
    """The exclusion file is missing or malformed."""


def fold(text: str) -> str:
    """Case-fold text for comparison, treating Turkish i variants as equal."""
    return text.casefold().translate(TURKISH_I_FOLD)


class SenderExclusions(BaseModel):
    """Excluded sender addresses and domains, and excluded subject patterns."""

    exact: list[str] = []
    domains: list[str] = []
    subjects: list[str] = []

    @field_validator("exact", "domains")
    @classmethod
    def _normalize(cls, entries: list[str]) -> list[str]:
        return [entry.strip().lower() for entry in entries]

    @field_validator("subjects")
    @classmethod
    def _fold_subjects(cls, entries: list[str]) -> list[str]:
        return [fold(entry.strip()) for entry in entries]

    def excludes(self, from_header: str, subject: str = "") -> bool:
        """Return whether a message with this ``From`` and subject is excluded."""
        if self.matching_entry(from_header) is not None:
            return True
        folded = fold(subject)
        return any(pattern in folded for pattern in self.subjects)

    def matching_entry(self, from_header: str) -> str | None:
        """Return the sender entry a ``From`` header matches, if any."""
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
