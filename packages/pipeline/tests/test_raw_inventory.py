"""Tests for the raw-zone inventory."""

import logging
from collections.abc import Callable
from datetime import date
from typing import Any

import pytest

from tracemail_pipeline.ingest.allowlist import SenderAllowlist
from tracemail_pipeline.ingest.raw_inventory import UNMATCHED, raw_inventory
from tracemail_pipeline.ingest.raw_store import mail_object_key

ALLOWLIST = SenderAllowlist(exact=["alerts@board.example"], domains=["company.example"])


def store_message(
    store: Any, factory: Callable[..., Any], day: date, sender: str, digest: str
) -> None:
    store.write_once(mail_object_key(day, digest), factory(sender, None).raw)


def test_raw_inventory_counts_messages_per_allowlist_entry(
    fake_store: Any, message_factory: Callable[..., Any]
) -> None:
    day = date(2026, 10, 4)
    store_message(fake_store, message_factory, day, "alerts@board.example", "a")
    store_message(fake_store, message_factory, day, "alerts@board.example", "b")
    store_message(fake_store, message_factory, day, "hr@jobs.company.example", "c")
    result = raw_inventory(fake_store, ALLOWLIST, day, date(2026, 10, 5))
    assert result.by_entry == {"alerts@board.example": 2, "company.example": 1}
    assert result.messages == 3
    assert (result.gcs_lists, result.gcs_reads) == (1, 3)


def test_raw_inventory_only_reads_days_inside_the_range(
    fake_store: Any, message_factory: Callable[..., Any]
) -> None:
    store_message(
        fake_store, message_factory, date(2026, 10, 3), "alerts@board.example", "a"
    )
    store_message(
        fake_store, message_factory, date(2026, 10, 5), "alerts@board.example", "b"
    )
    result = raw_inventory(fake_store, ALLOWLIST, date(2026, 10, 4), date(2026, 10, 6))
    assert result.messages == 1
    assert result.gcs_lists == 2


def test_raw_inventory_reports_senders_removed_from_the_allowlist_without_naming_them(
    fake_store: Any,
    message_factory: Callable[..., Any],
    caplog: pytest.LogCaptureFixture,
) -> None:
    day = date(2026, 10, 4)
    store_message(fake_store, message_factory, day, "person@removed.example", "a")
    with caplog.at_level(logging.INFO):
        result = raw_inventory(fake_store, ALLOWLIST, day, date(2026, 10, 5))
    assert result.by_entry == {UNMATCHED: 1}
    assert "person@removed.example" not in caplog.text
