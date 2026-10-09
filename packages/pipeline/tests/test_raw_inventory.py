"""Tests for the raw-zone inventory."""

import logging
from collections.abc import Callable
from datetime import date
from typing import Any

import pytest

from tracemail_pipeline.ingest.raw_inventory import (
    NO_ADDRESS,
    NOW_EXCLUDED,
    raw_inventory,
)
from tracemail_pipeline.ingest.raw_store import mail_object_key
from tracemail_pipeline.ingest.sender_exclusions import SenderExclusions

EXCLUSIONS = SenderExclusions(domains=["newsletter.example"])


def store_message(
    store: Any, factory: Callable[..., Any], day: date, sender: str, digest: str
) -> None:
    store.write_once(mail_object_key(day, digest), factory(sender, None).raw)


def test_raw_inventory_counts_messages_per_sender_domain(
    fake_store: Any, message_factory: Callable[..., Any]
) -> None:
    day = date(2026, 10, 4)
    store_message(fake_store, message_factory, day, "alerts@board.example", "a")
    store_message(fake_store, message_factory, day, "jobs@board.example", "b")
    store_message(fake_store, message_factory, day, "hr@jobs.company.example", "c")
    result = raw_inventory(fake_store, EXCLUSIONS, day, date(2026, 10, 5))
    assert result.by_domain == {"board.example": 2, "jobs.company.example": 1}
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
    result = raw_inventory(fake_store, EXCLUSIONS, date(2026, 10, 4), date(2026, 10, 6))
    assert result.messages == 1
    assert result.gcs_lists == 2


def test_raw_inventory_never_logs_full_sender_addresses(
    fake_store: Any,
    message_factory: Callable[..., Any],
    caplog: pytest.LogCaptureFixture,
) -> None:
    day = date(2026, 10, 4)
    store_message(fake_store, message_factory, day, "person@company.example", "a")
    with caplog.at_level(logging.INFO):
        raw_inventory(fake_store, EXCLUSIONS, day, date(2026, 10, 5))
    assert "company.example" in caplog.text
    assert "person@" not in caplog.text


def test_raw_inventory_groups_stored_mail_from_senders_excluded_later(
    fake_store: Any, message_factory: Callable[..., Any]
) -> None:
    day = date(2026, 10, 4)
    store_message(fake_store, message_factory, day, "hi@newsletter.example", "a")
    store_message(fake_store, message_factory, day, "no address", "b")
    result = raw_inventory(fake_store, EXCLUSIONS, day, date(2026, 10, 5))
    assert result.by_domain == {NOW_EXCLUDED: 1, NO_ADDRESS: 1}
