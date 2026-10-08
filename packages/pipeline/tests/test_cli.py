"""Tests for the pipeline command-line entry points."""

from datetime import UTC, date, datetime
from typing import Any

import pytest
from pydantic import ValidationError

from tracemail_pipeline import cli
from tracemail_pipeline.config import PipelineSettings

ENV = {
    "TRACEMAIL_IMAP_HOST": "imap.example.com",
    "TRACEMAIL_IMAP_PORT": "993",
    "TRACEMAIL_IMAP_USER": "user@example.com",
    "TRACEMAIL_IMAP_PASSWORD": "not-a-real-password",
    "TRACEMAIL_IMAP_MAILBOX": "INBOX",
    "TRACEMAIL_SENDER_ALLOWLIST_PATH": "allowlist.yaml",
    "TRACEMAIL_GCP_PROJECT": "test-project",
    "TRACEMAIL_DATA_BUCKET": "test-bucket",
    "TRACEMAIL_BQ_LOCATION": "us-central1",
    "TRACEMAIL_BQ_LANDING_DATASET": "landing",
    "TRACEMAIL_BQ_OPS_DATASET": "ops",
    "TRACEMAIL_BQ_MAX_BYTES_BILLED": "1073741824",
    "TRACEMAIL_OPS_RETENTION_DAYS": "400",
}


@pytest.fixture
def env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name, value in ENV.items():
        monkeypatch.setenv(name, value)


def test_parser_reads_ingest_dates() -> None:
    args = cli.build_parser().parse_args(
        ["ingest-mail", "--start-date", "2026-10-01", "--end-date", "2026-10-04"]
    )
    assert (args.start_date, args.end_date) == (date(2026, 10, 1), date(2026, 10, 4))


def test_parser_requires_a_command() -> None:
    with pytest.raises(SystemExit):
        cli.build_parser().parse_args([])


def test_day_start_utc_returns_midnight_utc() -> None:
    assert cli.day_start_utc(date(2026, 10, 4)) == datetime(2026, 10, 4, tzinfo=UTC)


def test_main_dispatches_ingest_mail_with_parsed_dates(
    env: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[tuple[Any, ...]] = []
    monkeypatch.setattr(cli, "run_ingest_mail", lambda *a: calls.append(a))
    cli.main(["ingest-mail", "--start-date", "2026-10-01", "--end-date", "2026-10-02"])
    settings, start, end = calls[0]
    assert settings.imap_mailbox == "INBOX"
    assert (start, end) == (date(2026, 10, 1), date(2026, 10, 2))


def test_main_dispatches_raw_inventory_with_parsed_dates(
    env: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[tuple[Any, ...]] = []
    monkeypatch.setattr(cli, "run_raw_inventory", lambda *a: calls.append(a))
    cli.main(
        ["raw-inventory", "--start-date", "2026-10-01", "--end-date", "2026-10-02"]
    )
    assert (calls[0][1], calls[0][2]) == (date(2026, 10, 1), date(2026, 10, 2))


def test_main_dispatches_parse_mail_with_parsed_dates(
    env: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[tuple[Any, ...]] = []
    monkeypatch.setattr(cli, "run_parse_mail", lambda *a: calls.append(a))
    cli.main(["parse-mail", "--start-date", "2026-10-01", "--end-date", "2026-10-02"])
    assert (calls[0][1], calls[0][2]) == (date(2026, 10, 1), date(2026, 10, 2))


def test_main_dispatches_list_mailboxes(
    env: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[Any] = []
    monkeypatch.setattr(cli, "run_list_mailboxes", calls.append)
    cli.main(["list-mailboxes"])
    assert len(calls) == 1


def test_settings_validation_error_never_contains_the_password(
    env: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("TRACEMAIL_DATA_BUCKET")
    with pytest.raises(ValidationError) as error:
        PipelineSettings()  # type: ignore[call-arg]
    assert "not-a-real-password" not in str(error.value)


def test_settings_keep_the_imap_password_secret(env: None) -> None:
    settings = PipelineSettings()  # type: ignore[call-arg]
    assert "not-a-real-password" not in repr(settings)
