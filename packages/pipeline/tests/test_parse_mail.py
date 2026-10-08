"""Tests for the parse step and the parsed zone."""

import json
from collections.abc import Sequence
from datetime import date
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from tracemail_pipeline.ingest.raw_store import mail_object_key
from tracemail_pipeline.parse.parse_mail import (
    ACTIONS,
    OUTCOMES,
    SIGHTINGS,
    parse_mail,
    source_message,
)
from tracemail_pipeline.parse.parsed_store import (
    GcsParsedStore,
    parsed_object_key,
    to_jsonl,
)

FIXTURES = Path(__file__).parent / "fixtures" / "linkedin"
DAY = date(2026, 10, 1)
NEXT_DAY = date(2026, 10, 2)


class FakeParsedStore:
    def __init__(self) -> None:
        self.files: dict[tuple[str, date], bytes] = {}

    def write_partition(
        self, record_type: str, received_date: date, rows: Sequence[BaseModel]
    ) -> int:
        data = to_jsonl(rows)
        self.files[(record_type, received_date)] = data
        return len(data)

    def rows(self, record_type: str, day: date = DAY) -> list[dict[str, Any]]:
        lines = self.files[(record_type, day)].decode().splitlines()
        return [json.loads(line) for line in lines]


def store_fixtures(raw_store: Any, names: list[str], day: date = DAY) -> None:
    for name in names:
        raw = (FIXTURES / f"{name}.eml").read_bytes()
        raw_store.write_once(mail_object_key(day, name), raw)


def test_parse_mail_writes_three_partitions_per_day(fake_store: Any) -> None:
    store_fixtures(
        fake_store, ["linkedin_job_alert", "linkedin_application_confirmation"]
    )
    parsed = FakeParsedStore()
    result = parse_mail(fake_store, parsed, DAY, NEXT_DAY)
    assert set(parsed.files) == {(SIGHTINGS, DAY), (ACTIONS, DAY), (OUTCOMES, DAY)}
    assert len(parsed.rows(SIGHTINGS)) == result.sightings == 8
    assert len(parsed.rows(ACTIONS)) == result.actions == 1
    assert [row["outcome"] for row in parsed.rows(OUTCOMES)] == ["parsed", "parsed"]


def test_parse_mail_records_unclaimed_and_failed_messages_without_stopping(
    fake_store: Any, message_factory: Any
) -> None:
    store_fixtures(fake_store, ["linkedin_job_alert"])
    other = message_factory("hr@company.example", "<x@company.example>")
    fake_store.write_once(mail_object_key(DAY, "other"), other.raw)
    broken = message_factory("jobs-noreply@linkedin.com", "<y@linkedin.com>")
    fake_store.write_once(mail_object_key(DAY, "broken"), broken.raw)
    result = parse_mail(fake_store, FakeParsedStore(), DAY, NEXT_DAY)
    assert (result.parsed, result.failed, result.unclaimed) == (1, 1, 1)


def test_parse_mail_is_idempotent(fake_store: Any) -> None:
    store_fixtures(fake_store, ["linkedin_saved_job_reminder"])
    first, second = FakeParsedStore(), FakeParsedStore()
    parse_mail(fake_store, first, DAY, NEXT_DAY)
    parse_mail(fake_store, second, DAY, NEXT_DAY)
    assert first.files == second.files


def test_parse_mail_writes_empty_partitions_for_a_day_without_mail(
    fake_store: Any,
) -> None:
    parsed = FakeParsedStore()
    result = parse_mail(fake_store, parsed, DAY, NEXT_DAY)
    assert parsed.files == {
        (SIGHTINGS, DAY): b"",
        (ACTIONS, DAY): b"",
        (OUTCOMES, DAY): b"",
    }
    assert (result.days, result.messages) == (1, 0)


def test_parse_mail_reports_operations_and_timings(fake_store: Any) -> None:
    store_fixtures(fake_store, ["linkedin_job_alert"], DAY)
    store_fixtures(fake_store, ["linkedin_facet_suggestions"], NEXT_DAY)
    result = parse_mail(fake_store, FakeParsedStore(), DAY, date(2026, 10, 3))
    assert (result.gcs_lists, result.gcs_reads, result.gcs_writes) == (2, 2, 6)
    assert result.bytes_read > 0 and result.bytes_written > 0
    parts = (result.seconds_gcs_read, result.seconds_parse, result.seconds_gcs_write)
    assert all(0 <= part <= result.seconds_total for part in parts)


def test_source_message_reads_sender_date_and_plain_text() -> None:
    raw = (FIXTURES / "linkedin_job_alert.eml").read_bytes()
    message = source_message("k", DAY, raw)
    assert "jobalerts-noreply@linkedin.com" in message.from_header
    assert message.sent_at is not None and message.sent_at.tzinfo is not None
    assert message.plain_text is not None and "uyarınız" in message.plain_text


def test_parsed_object_key_uses_record_type_and_received_date() -> None:
    assert parsed_object_key(SIGHTINGS, DAY) == (
        "parsed/job_posting_sightings/received_date=2026-10-01/data.jsonl"
    )


def test_gcs_parsed_store_overwrites_the_partition_file() -> None:
    uploads: dict[str, bytes] = {}

    class Blob:
        def __init__(self, key: str) -> None:
            self.key = key

        def upload_from_string(self, data: bytes, content_type: str) -> None:
            uploads[self.key] = data

    class Bucket:
        def blob(self, key: str) -> Blob:
            return Blob(key)

    class Row(BaseModel):
        value: int

    store = GcsParsedStore(Bucket())
    store.write_partition(SIGHTINGS, DAY, [Row(value=1), Row(value=2)])
    store.write_partition(SIGHTINGS, DAY, [Row(value=3)])
    assert uploads == {parsed_object_key(SIGHTINGS, DAY): b'{"value":3}\n'}
