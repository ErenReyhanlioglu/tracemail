"""Tests for one mail-ingestion run over a data interval."""

import hashlib
import logging
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

import pytest

from tracemail_pipeline.ingest.allowlist import SenderAllowlist
from tracemail_pipeline.ingest.mail_ingest import (
    PROGRESS_LOG_EVERY,
    MailIngestResult,
    ingest_mail,
)

START = datetime(2026, 10, 4, 13, tzinfo=UTC)
END = datetime(2026, 10, 4, 14, tzinfo=UTC)
ALLOWLIST = SenderAllowlist(domains=["allowed.example"])
KEY_PREFIX = "raw/mail/received_date=2026-10-04/"
COUNT_FIELDS = {"listed", "rejected", "already_stored", "written"}


def run(reader: Any, store: Any) -> MailIngestResult:
    return ingest_mail(reader, store, ALLOWLIST, START, END)


def counts(result: MailIngestResult) -> dict[str, int]:
    return result.model_dump(include=COUNT_FIELDS)


def expected(**values: int) -> dict[str, int]:
    return {field: values.get(field, 0) for field in COUNT_FIELDS}


def test_ingest_writes_allowed_mail_keyed_by_message_id(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
    fake_store: Any,
) -> None:
    message = message_factory("hr@allowed.example", "<id@allowed.example>")
    result = run(make_reader(make_fake_imap({"1": message})), fake_store)
    digest = hashlib.sha256(b"<id@allowed.example>").hexdigest()
    assert counts(result) == expected(listed=1, written=1)
    assert fake_store.objects == {f"{KEY_PREFIX}{digest}.eml": message.raw}


def test_ingest_never_downloads_or_stores_mail_from_other_senders(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
    fake_store: Any,
) -> None:
    imap = make_fake_imap({"1": message_factory("someone@other.example", "<x@o>")})
    result = run(make_reader(imap), fake_store)
    assert counts(result) == expected(listed=1, rejected=1)
    assert fake_store.objects == {}
    assert all("BODY.PEEK[]" not in call[3] for call in imap.fetch_calls())


def test_ingest_skips_already_stored_mail_without_downloading_it(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
    fake_store: Any,
) -> None:
    message = message_factory("hr@allowed.example", "<id@allowed.example>")
    run(make_reader(make_fake_imap({"1": message})), fake_store)
    imap = make_fake_imap({"1": message})
    result = run(make_reader(imap), fake_store)
    assert counts(result) == expected(listed=1, already_stored=1)
    assert all("BODY.PEEK[]" not in call[3] for call in imap.fetch_calls())


def test_ingest_keys_mail_without_message_id_by_raw_bytes_and_stays_idempotent(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
    fake_store: Any,
) -> None:
    message = message_factory("hr@allowed.example", None)
    first = run(make_reader(make_fake_imap({"1": message})), fake_store)
    second = run(make_reader(make_fake_imap({"1": message})), fake_store)
    digest = hashlib.sha256(message.raw).hexdigest()
    assert counts(first) == expected(listed=1, written=1)
    assert counts(second) == expected(listed=1, already_stored=1)
    assert list(fake_store.objects) == [f"{KEY_PREFIX}{digest}.eml"]


def test_ingest_reports_operations_bytes_and_timings(
    make_fake_imap: Callable[..., Any],
    make_reader: Callable[[Any], Any],
    message_factory: Callable[..., Any],
    fake_store: Any,
) -> None:
    written = message_factory("hr@allowed.example", "<id@allowed.example>")
    rejected = message_factory("someone@other.example", "<x@o>")
    result = run(make_reader(make_fake_imap({"1": written, "2": rejected})), fake_store)
    # 1 SEARCH + 1 batched header FETCH + 1 body FETCH
    assert result.imap_commands == 3
    assert (result.gcs_lists, result.gcs_writes) == (1, 1)
    assert result.bytes_written == len(written.raw)
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
    messages = {
        str(uid): message_factory("hr@allowed.example", f"<{uid}@allowed.example>")
        for uid in range(1, PROGRESS_LOG_EVERY + 1)
    }
    with caplog.at_level(logging.INFO):
        run(make_reader(make_fake_imap(messages)), fake_store)
    progress = f"Mail ingest progress: {PROGRESS_LOG_EVERY}/{PROGRESS_LOG_EVERY}"
    assert progress in caplog.text
    assert "Mail ingest finished" in caplog.text
    assert "hr@allowed.example" not in caplog.text
