"""Tests for the parse step and the parsed zone."""

import json
from collections.abc import Sequence
from datetime import date
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from tracemail_pipeline.dates import days_between
from tracemail_pipeline.ingest.raw_store import mail_object_key
from tracemail_pipeline.parse.parse_mail import (
    ACTIONS,
    OUTCOMES,
    SIGHTINGS,
    UPDATES,
    parse_mail,
    source_message,
)
from tracemail_pipeline.parse.parsed_store import (
    GcsParsedStore,
    PartitionWrite,
    md5_base64,
    parsed_object_key,
    to_jsonl,
)

FIXTURES = Path(__file__).parent / "fixtures" / "linkedin"
DAY = date(2026, 10, 1)
NEXT_DAY = date(2026, 10, 2)


class FakeParsedStore:
    """Like the GCS store: skips a file whose content is unchanged."""

    def __init__(self) -> None:
        self.files: dict[tuple[str, date], bytes] = {}

    def write_partition(
        self, record_type: str, received_date: date, rows: Sequence[BaseModel]
    ) -> PartitionWrite:
        data = to_jsonl(rows)
        stored = self.files.get((record_type, received_date))
        if stored == data:
            return PartitionWrite(bytes_written=0, written=False, metadata_read=True)
        self.files[(record_type, received_date)] = data
        return PartitionWrite(
            bytes_written=len(data), written=True, metadata_read=stored is not None
        )

    def rows(self, record_type: str, day: date = DAY) -> list[dict[str, Any]]:
        lines = self.files[(record_type, day)].decode().splitlines()
        return [json.loads(line) for line in lines]


def store_fixtures(raw_store: Any, names: list[str], day: date = DAY) -> None:
    for name in names:
        raw = (FIXTURES / f"{name}.eml").read_bytes()
        raw_store.write_once(mail_object_key(day, name), raw)


def test_parse_mail_writes_one_partition_per_record_type_per_day(
    fake_store: Any,
) -> None:
    store_fixtures(
        fake_store, ["linkedin_job_alert", "linkedin_application_confirmation"]
    )
    parsed = FakeParsedStore()
    result = parse_mail(fake_store, parsed, days_between(DAY, NEXT_DAY))
    assert set(parsed.files) == {
        (SIGHTINGS, DAY),
        (ACTIONS, DAY),
        (UPDATES, DAY),
        (OUTCOMES, DAY),
    }
    assert len(parsed.rows(SIGHTINGS)) == result.sightings == 8
    assert len(parsed.rows(ACTIONS)) == result.actions == 1
    assert [row["outcome"] for row in parsed.rows(OUTCOMES)] == ["parsed", "parsed"]


def test_parse_mail_writes_application_updates_to_their_own_partition(
    fake_store: Any,
) -> None:
    store_fixtures(fake_store, ["linkedin_application_rejected"])
    parsed = FakeParsedStore()
    result = parse_mail(fake_store, parsed, days_between(DAY, NEXT_DAY))
    [row] = parsed.rows(UPDATES)
    assert (row["job_id"], row["update_type"]) == ("1000000005", "rejection")
    assert result.updates == 1
    assert result.volume().records_out == 1


def test_parse_mail_records_unclaimed_and_failed_messages_without_stopping(
    fake_store: Any, message_factory: Any
) -> None:
    store_fixtures(fake_store, ["linkedin_job_alert"])
    other = message_factory("hr@company.example", "<x@company.example>")
    fake_store.write_once(mail_object_key(DAY, "other"), other.raw)
    broken = message_factory("jobs-noreply@linkedin.com", "<y@linkedin.com>")
    fake_store.write_once(mail_object_key(DAY, "broken"), broken.raw)
    result = parse_mail(fake_store, FakeParsedStore(), days_between(DAY, NEXT_DAY))
    assert (result.parsed, result.failed, result.unclaimed) == (1, 1, 1)


def test_parse_mail_is_idempotent(fake_store: Any) -> None:
    store_fixtures(fake_store, ["linkedin_saved_job_reminder"])
    first, second = FakeParsedStore(), FakeParsedStore()
    parse_mail(fake_store, first, days_between(DAY, NEXT_DAY))
    parse_mail(fake_store, second, days_between(DAY, NEXT_DAY))
    assert first.files == second.files


def test_parse_mail_writes_empty_partitions_for_a_day_without_mail(
    fake_store: Any,
) -> None:
    parsed = FakeParsedStore()
    result = parse_mail(fake_store, parsed, days_between(DAY, NEXT_DAY))
    assert parsed.files == {
        (SIGHTINGS, DAY): b"",
        (ACTIONS, DAY): b"",
        (UPDATES, DAY): b"",
        (OUTCOMES, DAY): b"",
    }
    assert (result.days, result.messages) == (1, 0)


def test_parse_mail_reports_operations_and_timings(fake_store: Any) -> None:
    store_fixtures(fake_store, ["linkedin_job_alert"], DAY)
    store_fixtures(fake_store, ["linkedin_facet_suggestions"], NEXT_DAY)
    result = parse_mail(
        fake_store, FakeParsedStore(), days_between(DAY, date(2026, 10, 3))
    )
    assert (result.gcs_lists, result.gcs_reads, result.gcs_writes) == (2, 2, 8)
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


class Row(BaseModel):
    value: int


ROW_1_JSONL = b'{"value":1}\n'
ROW_3_JSONL = b'{"value":3}\n'


class FakeBlob:
    def __init__(self, key: str, uploads: dict[str, bytes]) -> None:
        self.key = key
        self.uploads = uploads
        self.md5_hash = md5_base64(uploads[key]) if key in uploads else None

    def upload_from_string(self, data: bytes, content_type: str) -> None:
        self.uploads[self.key] = data


class FakeBucket:
    """Bucket double: get_blob returns None for a missing object (a 404)."""

    def __init__(self) -> None:
        self.uploads: dict[str, bytes] = {}
        self.metadata_reads = 0

    def get_blob(self, key: str) -> FakeBlob | None:
        self.metadata_reads += 1
        return FakeBlob(key, self.uploads) if key in self.uploads else None

    def blob(self, key: str) -> FakeBlob:
        return FakeBlob(key, self.uploads)


def test_gcs_parsed_store_writes_a_missing_partition_without_a_billed_read() -> None:
    bucket = FakeBucket()
    write = GcsParsedStore(bucket).write_partition(SIGHTINGS, DAY, [Row(value=1)])
    assert write == PartitionWrite(bytes_written=12, written=True, metadata_read=False)
    assert bucket.uploads == {parsed_object_key(SIGHTINGS, DAY): ROW_1_JSONL}


def test_gcs_parsed_store_overwrites_a_partition_whose_content_changed() -> None:
    bucket = FakeBucket()
    store = GcsParsedStore(bucket)
    store.write_partition(SIGHTINGS, DAY, [Row(value=1), Row(value=2)])
    write = store.write_partition(SIGHTINGS, DAY, [Row(value=3)])
    assert (write.written, write.metadata_read) == (True, True)
    assert bucket.uploads == {parsed_object_key(SIGHTINGS, DAY): ROW_3_JSONL}


def test_gcs_parsed_store_skips_a_partition_whose_content_is_unchanged() -> None:
    bucket = FakeBucket()
    store = GcsParsedStore(bucket)
    store.write_partition(SIGHTINGS, DAY, [Row(value=1)])
    write = store.write_partition(SIGHTINGS, DAY, [Row(value=1)])
    assert write == PartitionWrite(bytes_written=0, written=False, metadata_read=True)


def test_gcs_parsed_store_rewrites_when_the_stored_object_has_no_md5() -> None:
    bucket = FakeBucket()
    store = GcsParsedStore(bucket)
    store.write_partition(SIGHTINGS, DAY, [])
    original = bucket.get_blob

    def without_md5(key: str) -> FakeBlob | None:
        blob = original(key)
        if blob is not None:
            blob.md5_hash = None
        return blob

    bucket.get_blob = without_md5  # type: ignore[method-assign]
    assert store.write_partition(SIGHTINGS, DAY, []).written


def test_reparsing_an_unchanged_day_writes_nothing_and_counts_the_skips(
    fake_store: Any,
) -> None:
    store_fixtures(fake_store, ["linkedin_job_alert"])
    parsed = FakeParsedStore()
    first = parse_mail(fake_store, parsed, days_between(DAY, NEXT_DAY))
    second = parse_mail(fake_store, parsed, days_between(DAY, NEXT_DAY))
    assert (first.gcs_writes, first.parsed_unchanged, first.gcs_metadata_reads) == (
        4,
        0,
        0,
    )
    assert (second.gcs_writes, second.parsed_unchanged, second.gcs_metadata_reads) == (
        0,
        4,
        4,
    )
    assert second.bytes_written == 0


def test_new_mail_rewrites_only_the_partitions_that_changed(fake_store: Any) -> None:
    store_fixtures(fake_store, ["linkedin_job_alert"])
    parsed = FakeParsedStore()
    parse_mail(fake_store, parsed, days_between(DAY, NEXT_DAY))
    store_fixtures(fake_store, ["linkedin_facet_suggestions"])
    result = parse_mail(fake_store, parsed, days_between(DAY, NEXT_DAY))
    # New sightings and a new outcome row; actions and updates stay empty.
    assert (result.gcs_writes, result.parsed_unchanged) == (2, 2)
