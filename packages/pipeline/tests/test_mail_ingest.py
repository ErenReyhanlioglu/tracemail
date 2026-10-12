"""Tests for one mail-ingestion run over a data interval."""

import hashlib
import logging
from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import Any

import pytest

from tracemail_pipeline.ingest import mail_ingest
from tracemail_pipeline.ingest.mail_ingest import (
    BODY_FETCH_BATCH_SIZE,
    MailIngestResult,
    ingest_mail,
)
from tracemail_pipeline.ingest.sender_exclusions import SenderExclusions

START = datetime(2026, 10, 4, 13, tzinfo=UTC)
END = datetime(2026, 10, 4, 14, tzinfo=UTC)
EXCLUSIONS = SenderExclusions(
    domains=["excluded.example"], subjects=["one-time passcode"]
)
KEY_PREFIX = "raw/mail/received_date=2026-10-04/"
COUNT_FIELDS = {"listed", "excluded", "already_stored", "written"}


def run(reader: Any, store: Any) -> MailIngestResult:
    return ingest_mail(reader, store, EXCLUSIONS, START, END)


def counts(result: MailIngestResult) -> dict[str, int]:
    return result.model_dump(include=COUNT_FIELDS)


def expected(**values: int) -> dict[str, int]:
    return {field: values.get(field, 0) for field in COUNT_FIELDS}


def digest(message_id: str) -> str:
    return hashlib.sha256(message_id.encode()).hexdigest()


def test_ingest_writes_mail_from_any_other_sender_keyed_by_message_id(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
    fake_store: Any,
) -> None:
    message = message_factory("hr@company.example", "<id@company.example>")
    result = run(make_reader(make_fake_imap({"1": message})), fake_store)
    digest = hashlib.sha256(b"<id@company.example>").hexdigest()
    assert counts(result) == expected(listed=1, written=1)
    assert fake_store.objects == {f"{KEY_PREFIX}{digest}.eml": message.raw}


def test_ingest_never_downloads_or_stores_mail_from_excluded_senders(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
    fake_store: Any,
) -> None:
    imap = make_fake_imap({"1": message_factory("news@excluded.example", "<x@e>")})
    result = run(make_reader(imap), fake_store)
    assert counts(result) == expected(listed=1, excluded=1)
    assert fake_store.objects == {}
    assert all("BODY.PEEK[]" not in call[3] for call in imap.fetch_calls())


def test_ingest_never_downloads_security_mail_from_a_kept_sender(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
    fake_store: Any,
) -> None:
    passcode = message_factory(
        "talent@company.example", "<otp@company.example>", subject="One-Time Passcode"
    )
    imap = make_fake_imap({"1": passcode})
    result = run(make_reader(imap), fake_store)
    assert counts(result) == expected(listed=1, excluded=1)
    assert fake_store.objects == {}
    assert all("BODY.PEEK[]" not in call[3] for call in imap.fetch_calls())


class RecordingStore:
    """Wraps the write-once fake store and records what ingestion asked for."""

    def __init__(self, inner: Any) -> None:
        self.inner = inner
        self.listed_prefixes: list[str] = []
        self.exists_checks: list[str] = []
        self.write_attempts: list[str] = []

    @property
    def objects(self) -> dict[str, bytes]:
        return dict(self.inner.objects)

    def existing_keys(self, prefix: str) -> set[str]:
        self.listed_prefixes.append(prefix)
        return set(self.inner.existing_keys(prefix))

    def exists(self, key: str) -> bool:
        self.exists_checks.append(key)
        return bool(self.inner.exists(key))

    def read(self, key: str) -> bytes:
        return bytes(self.inner.read(key))

    def write_once(self, key: str, data: bytes) -> bool:
        self.write_attempts.append(key)
        return bool(self.inner.write_once(key, data))


@pytest.fixture
def store(fake_store: Any) -> RecordingStore:
    return RecordingStore(fake_store)


def test_ingest_never_overwrites_a_stored_message_even_if_its_bytes_differ(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
    store: RecordingStore,
) -> None:
    stored = message_factory("hr@company.example", "<id@company.example>")
    changed = message_factory(
        "hr@company.example", "<id@company.example>", subject="Changed subject"
    )
    run(make_reader(make_fake_imap({"1": stored})), store)
    result = run(make_reader(make_fake_imap({"1": changed})), store)
    assert counts(result) == expected(listed=1, already_stored=1)
    assert (result.gcs_writes, result.gcs_writes_rejected) == (0, 1)
    assert result.written_days == []
    assert list(store.objects.values()) == [stored.raw]


def test_ingest_lists_nothing_and_attempts_a_create_only_write_per_kept_message(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
    store: RecordingStore,
) -> None:
    messages = {
        "1": message_factory("hr@company.example", "<a@c>"),
        "2": message_factory("hr@company.example", "<b@c>"),
        "3": message_factory("news@excluded.example", "<x@e>"),
    }
    run(make_reader(make_fake_imap(messages)), store)
    run(make_reader(make_fake_imap(messages)), store)
    assert store.listed_prefixes == []
    assert store.exists_checks == []
    assert len(store.write_attempts) == 4
    assert len(store.objects) == 2


def test_ingest_stores_each_body_under_its_own_key_across_batches(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
    fake_store: Any,
) -> None:
    messages = {
        str(uid): message_factory(
            f"hr{uid}@company.example", f"<{uid}@company.example>"
        )
        for uid in range(1, 2 * BODY_FETCH_BATCH_SIZE + 2)
    }
    imap = make_fake_imap(messages)
    result = run(make_reader(imap), fake_store)
    expected_objects = {
        f"{KEY_PREFIX}{digest(f'<{uid}@company.example>')}.eml": message.raw
        for uid, message in messages.items()
    }
    assert fake_store.objects == expected_objects
    assert result.written == len(messages)
    body_fetches = [c for c in imap.fetch_calls() if "BODY.PEEK[]" in c[3]]
    assert len(body_fetches) == 3


def test_ingest_checks_existence_before_uploading_a_large_message(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
    store: RecordingStore,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    message = message_factory("hr@company.example", "<big@company.example>")
    monkeypatch.setattr(mail_ingest, "SINGLE_REQUEST_UPLOAD_MAX_BYTES", 10)
    first = run(make_reader(make_fake_imap({"1": message})), store)
    second = run(make_reader(make_fake_imap({"1": message})), store)
    assert counts(first) == expected(listed=1, written=1)
    assert counts(second) == expected(listed=1, already_stored=1)
    assert (second.gcs_existence_checks, second.gcs_writes_rejected) == (1, 0)
    assert len(store.write_attempts) == 1


def test_ingest_keys_mail_without_message_id_by_raw_bytes_and_stays_idempotent(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
    fake_store: Any,
) -> None:
    message = message_factory("hr@company.example", None)
    first = run(make_reader(make_fake_imap({"1": message})), fake_store)
    second = run(make_reader(make_fake_imap({"1": message})), fake_store)
    digest = hashlib.sha256(message.raw).hexdigest()
    assert counts(first) == expected(listed=1, written=1)
    assert counts(second) == expected(listed=1, already_stored=1)
    assert list(fake_store.objects) == [f"{KEY_PREFIX}{digest}.eml"]


def test_ingest_reports_the_received_days_that_got_new_mail_once_each(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
    fake_store: Any,
) -> None:
    messages = {
        "1": message_factory("hr@company.example", "<a@c>"),
        "2": message_factory("hr@company.example", "<b@c>"),
        "3": message_factory(
            "hr@company.example", "<c@c>", internal_date="02-Oct-2026 09:15:00 +0000"
        ),
    }
    first = run(make_reader(make_fake_imap(messages)), fake_store)
    again = run(make_reader(make_fake_imap(messages)), fake_store)
    assert first.written_days == [date(2026, 10, 2), date(2026, 10, 4)]
    assert again.written_days == []


def test_ingest_reports_operations_bytes_and_timings(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
    fake_store: Any,
) -> None:
    written = message_factory("hr@company.example", "<id@company.example>")
    excluded = message_factory("news@excluded.example", "<x@e>")
    result = run(make_reader(make_fake_imap({"1": written, "2": excluded})), fake_store)
    # 1 SEARCH + 1 batched header FETCH + 1 body FETCH
    assert result.imap_commands == 3
    assert result.gcs_writes == 1
    assert (result.gcs_writes_rejected, result.gcs_existence_checks) == (0, 0)
    assert result.bytes_written == len(written.raw)
    assert result.bytes_fetched == len(written.raw)
    assert result.volume().bytes_in == len(written.raw)
    timings = (
        result.seconds_imap_headers,
        result.seconds_imap_bodies,
        result.seconds_gcs,
    )
    assert all(0 <= part <= result.seconds_total for part in timings)


def test_ingest_logs_progress_and_final_metrics(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
    fake_store: Any,
    caplog: pytest.LogCaptureFixture,
) -> None:
    total = BODY_FETCH_BATCH_SIZE + 1
    messages = {
        str(uid): message_factory("hr@company.example", f"<{uid}@company.example>")
        for uid in range(1, total + 1)
    }
    with caplog.at_level(logging.INFO):
        run(make_reader(make_fake_imap(messages)), fake_store)
    progress = f"Mail ingest progress: {total}/{total}"
    assert progress in caplog.text
    assert "Mail ingest finished" in caplog.text
    assert "hr@company.example" not in caplog.text
