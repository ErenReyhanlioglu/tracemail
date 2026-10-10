"""Tests for the Airflow entry points and dirty-day propagation (ADR-0021)."""

from datetime import UTC, date, datetime
from typing import Any

import pytest

from tracemail_pipeline import jobs
from tracemail_pipeline.ingest.mail_ingest import MailIngestResult

HOUR_START = "2026-10-08T10:00:00+00:00"
HOUR_END = "2026-10-08T11:00:00+00:00"
MIDNIGHT_START = "2026-10-08T00:00:00+00:00"
MIDNIGHT_END = "2026-10-08T01:00:00+00:00"
# The ingestion window of an interval on 2026-10-08, one day of slack each side.
WINDOW_DAYS = ["2026-10-07", "2026-10-08", "2026-10-09"]


@pytest.fixture
def recorded(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, Any]]:
    """Replace settings and the step functions; record what each step got."""
    calls: list[tuple[str, Any]] = []
    monkeypatch.setattr(jobs, "_settings", lambda: "settings")

    def fake_ingest(settings: Any, start: datetime, end: datetime) -> MailIngestResult:
        calls.append(("ingest", (start, end)))
        return MailIngestResult(written_days=[date(2026, 10, 8)])

    monkeypatch.setattr(jobs, "ingest_interval", fake_ingest)
    monkeypatch.setattr(
        jobs, "parse_mail_days", lambda settings, days: calls.append(("parse", days))
    )
    monkeypatch.setattr(
        jobs, "load_landing_days", lambda settings, days: calls.append(("load", days))
    )
    return calls


@pytest.mark.parametrize(
    ("run_type", "start", "expected"),
    [
        ("scheduled", datetime(2026, 10, 8, 10, tzinfo=UTC), False),
        ("scheduled", datetime(2026, 10, 8, 0, tzinfo=UTC), True),
        ("manual", datetime(2026, 10, 8, 10, tzinfo=UTC), True),
        ("backfill", datetime(2026, 10, 8, 10, tzinfo=UTC), True),
    ],
)
def test_full_window_runs_daily_and_on_every_manual_or_backfill_run(
    run_type: str, start: datetime, expected: bool
) -> None:
    assert jobs.is_full_window(run_type, start) is expected


@pytest.mark.parametrize("run_type", ["DagRunType.SCHEDULED", "", "Scheduled"])
def test_unknown_run_type_fails_instead_of_processing_the_full_window(
    run_type: str,
) -> None:
    with pytest.raises(jobs.UnknownRunTypeError):
        jobs.is_full_window(run_type, datetime(2026, 10, 8, 10, tzinfo=UTC))


def test_scheduled_hourly_run_returns_only_days_with_new_mail(
    recorded: list[tuple[str, Any]],
) -> None:
    days = jobs.ingest_for_interval(HOUR_START, HOUR_END, "scheduled")
    assert days == ["2026-10-08"]
    assert recorded == [
        (
            "ingest",
            (
                datetime(2026, 10, 8, 10, tzinfo=UTC),
                datetime(2026, 10, 8, 11, tzinfo=UTC),
            ),
        )
    ]


def test_daily_full_run_returns_the_whole_window_even_without_new_mail(
    recorded: list[tuple[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        jobs, "ingest_interval", lambda settings, start, end: MailIngestResult()
    )
    assert jobs.ingest_for_interval(MIDNIGHT_START, MIDNIGHT_END, "scheduled") == (
        WINDOW_DAYS
    )


def test_backfill_run_returns_the_whole_window(
    recorded: list[tuple[str, Any]],
) -> None:
    assert jobs.ingest_for_interval(HOUR_START, HOUR_END, "backfill") == WINDOW_DAYS


def test_parse_and_load_entry_points_receive_dates_not_strings(
    recorded: list[tuple[str, Any]],
) -> None:
    jobs.parse_days(["2026-10-07", "2026-10-08"])
    jobs.load_days(["2026-10-08"])
    assert recorded == [
        ("parse", [date(2026, 10, 7), date(2026, 10, 8)]),
        ("load", [date(2026, 10, 8)]),
    ]


def test_days_context_spans_from_the_first_day_to_the_day_after_the_last() -> None:
    settings: Any = type("S", (), {"code_version": "abc"})()
    context = jobs._days_context(  # noqa: SLF001
        settings, "parse_mail", [], [], [date(2026, 10, 9), date(2026, 10, 7)]
    )
    assert (context.interval_start, context.interval_end) == (
        datetime(2026, 10, 7, tzinfo=UTC),
        datetime(2026, 10, 10, tzinfo=UTC),
    )
    assert context.schema_version is not None


class ListWriter:
    def __init__(self) -> None:
        self.runs: list[Any] = []

    def write(self, run: Any) -> None:
        self.runs.append(run)


class FakeReader:
    def __init__(self) -> None:
        self.selected: list[str] = []

    def select_read_only(self, mailbox: str) -> None:
        self.selected.append(mailbox)


SETTINGS: Any = type(
    "S",
    (),
    {
        "code_version": None,
        "data_bucket": "bucket",
        "imap_mailbox": "INBOX",
        "bq_landing_dataset": "landing",
        "sender_exclusions_path": "exclusions.yaml",
    },
)()


@pytest.fixture
def writer(monkeypatch: pytest.MonkeyPatch) -> ListWriter:
    """Replace every cloud client builder; capture run records."""
    record_writer = ListWriter()
    monkeypatch.setattr(jobs, "run_writer", lambda settings: record_writer)
    monkeypatch.setattr(jobs, "bucket", lambda settings: "gcs-bucket")
    monkeypatch.setattr(jobs, "warehouse", lambda settings: "bq-warehouse")
    return record_writer


def test_parse_step_runs_on_the_given_days_and_leaves_a_run_record(
    writer: ListWriter, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[Any] = []

    def fake_parse(raw: Any, parsed: Any, days: Any) -> MailIngestResult:
        calls.append(days)
        return MailIngestResult()

    monkeypatch.setattr(jobs, "parse_mail", fake_parse)
    jobs.parse_mail_days(SETTINGS, [date(2026, 10, 8)])
    assert calls == [[date(2026, 10, 8)]]
    assert [run.job_name for run in writer.runs] == ["parse_mail"]


def test_load_step_runs_on_the_given_days_and_leaves_a_run_record(
    writer: ListWriter, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[Any] = []

    def fake_load(warehouse: Any, dataset: str, bucket: str, days: Any) -> Any:
        calls.append((warehouse, dataset, bucket, days))
        return MailIngestResult()

    monkeypatch.setattr(jobs, "load_landing", fake_load)
    jobs.load_landing_days(SETTINGS, [date(2026, 10, 8)])
    assert calls == [("bq-warehouse", "landing", "bucket", [date(2026, 10, 8)])]
    assert [run.job_name for run in writer.runs] == ["load_landing"]


def test_ingest_step_opens_the_mailbox_read_only_and_records_the_interval(
    writer: ListWriter, monkeypatch: pytest.MonkeyPatch
) -> None:
    reader = FakeReader()

    class Mailbox:
        def __enter__(self) -> FakeReader:
            return reader

        def __exit__(self, *args: object) -> None:
            return None

    monkeypatch.setattr(jobs, "open_mailbox", lambda settings: Mailbox())
    monkeypatch.setattr(jobs, "load_sender_exclusions", lambda path: "exclusions")
    monkeypatch.setattr(jobs, "ingest_mail", lambda *args: MailIngestResult())
    start = datetime(2026, 10, 8, 10, tzinfo=UTC)
    end = datetime(2026, 10, 8, 11, tzinfo=UTC)
    jobs.ingest_interval(SETTINGS, start, end)
    assert reader.selected == ["INBOX"]
    [run] = writer.runs
    assert (run.job_name, run.interval_start, run.interval_end) == (
        "ingest_mail",
        start,
        end,
    )
