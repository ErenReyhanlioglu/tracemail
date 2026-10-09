"""Tests for the sender exclusion list."""

from pathlib import Path

import pytest

from tracemail_pipeline.ingest.sender_exclusions import (
    SenderExclusions,
    SenderExclusionsError,
    load_sender_exclusions,
)

EXCLUSIONS = SenderExclusions(
    exact=["Security@Example.com"],
    domains=["bank.example.org", "newsletter.example"],
)


@pytest.mark.parametrize(
    "from_header",
    [
        "Security <security@example.com>",
        "SECURITY@EXAMPLE.COM",
        "Bank <noreply@bank.example.org>",
        "News <hello@newsletter.example>",
        "News <hello@mail.newsletter.example>",
    ],
)
def test_exclusions_match_exact_addresses_domains_and_subdomains(
    from_header: str,
) -> None:
    assert EXCLUSIONS.excludes(from_header)


@pytest.mark.parametrize(
    "from_header",
    [
        "Recruiter <hr@example.com>",
        "Lookalike <hello@othernewsletter.example>",
        "Suffix trick <hello@newsletter.example.attacker.test>",
        "Parent of excluded subdomain <x@example.org>",
        "No address at all",
        "",
    ],
)
def test_exclusions_keep_everything_else(from_header: str) -> None:
    assert not EXCLUSIONS.excludes(from_header)


@pytest.mark.parametrize(
    ("from_header", "entry"),
    [
        ("Security <security@example.com>", "security@example.com"),
        ("News <hello@mail.newsletter.example>", "newsletter.example"),
        ("Recruiter <hr@example.com>", None),
    ],
)
def test_matching_entry_returns_the_configured_entry_not_the_address(
    from_header: str, entry: str | None
) -> None:
    assert EXCLUSIONS.matching_entry(from_header) == entry


def test_load_sender_exclusions_reads_yaml(tmp_path: Path) -> None:
    path = tmp_path / "exclusions.yaml"
    path.write_text("exact:\n  - a@example.com\ndomains:\n  - example.org\n")
    exclusions = load_sender_exclusions(path)
    assert exclusions.excludes("a@example.com")
    assert exclusions.excludes("b@example.org")


def test_load_sender_exclusions_rejects_a_non_mapping_file(tmp_path: Path) -> None:
    path = tmp_path / "exclusions.yaml"
    path.write_text("- a@example.com\n")
    with pytest.raises(SenderExclusionsError):
        load_sender_exclusions(path)
