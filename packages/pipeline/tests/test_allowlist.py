"""Tests for the sender allowlist."""

from pathlib import Path

import pytest

from tracemail_pipeline.ingest.allowlist import (
    AllowlistError,
    SenderAllowlist,
    load_allowlist,
)

ALLOWLIST = SenderAllowlist(
    exact=["Alerts@Example.com"],
    domains=["jobs.example.org", "company.example"],
)


@pytest.mark.parametrize(
    "from_header",
    [
        "Alerts <alerts@example.com>",
        "ALERTS@EXAMPLE.COM",
        "ATS <noreply@jobs.example.org>",
        "Recruiter <hr@company.example>",
        "Recruiter <hr@careers.company.example>",
    ],
)
def test_allowlist_allows_exact_addresses_domains_and_subdomains(
    from_header: str,
) -> None:
    assert ALLOWLIST.allows(from_header)


@pytest.mark.parametrize(
    "from_header",
    [
        "Other <other@example.com>",
        "Lookalike <hr@evilcompany.example>",
        "Suffix trick <hr@company.example.attacker.test>",
        "Parent of allowed subdomain <x@example.org>",
        "No address at all",
        "",
    ],
)
def test_allowlist_rejects_everything_else(from_header: str) -> None:
    assert not ALLOWLIST.allows(from_header)


def test_load_allowlist_reads_yaml(tmp_path: Path) -> None:
    path = tmp_path / "allowlist.yaml"
    path.write_text("exact:\n  - a@example.com\ndomains:\n  - example.org\n")
    allowlist = load_allowlist(path)
    assert allowlist.allows("a@example.com")
    assert allowlist.allows("b@example.org")


def test_load_allowlist_rejects_a_non_mapping_file(tmp_path: Path) -> None:
    path = tmp_path / "allowlist.yaml"
    path.write_text("- a@example.com\n")
    with pytest.raises(AllowlistError):
        load_allowlist(path)
