"""Tests for write-once raw storage and object keys."""

import hashlib
from datetime import date
from typing import Any

import pytest
from google.api_core.exceptions import PreconditionFailed

from tracemail_pipeline.ingest.raw_store import (
    GcsRawStore,
    mail_object_key,
    mail_partition_prefix,
    message_digest,
)


class FakeBlob:
    def __init__(self, bucket: "FakeBucket", key: str) -> None:
        self._bucket = bucket
        self._key = key

    def exists(self) -> bool:
        return self._key in self._bucket.objects

    def download_as_bytes(self) -> bytes:
        return self._bucket.objects[self._key]

    def upload_from_string(self, data: bytes, **kwargs: Any) -> None:
        self._bucket.upload_kwargs.append(kwargs)
        if kwargs.get("if_generation_match") == 0 and self.exists():
            raise PreconditionFailed("object exists")  # type: ignore[no-untyped-call]
        self._bucket.objects[self._key] = data


class FakeBucket:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}
        self.upload_kwargs: list[dict[str, Any]] = []

    def blob(self, key: str) -> FakeBlob:
        return FakeBlob(self, key)

    def list_blobs(self, prefix: str) -> list[Any]:
        return [
            type("Listed", (), {"name": key})()
            for key in self.objects
            if key.startswith(prefix)
        ]


def test_mail_object_key_partitions_by_received_date() -> None:
    key = mail_object_key(date(2026, 10, 4), "abc")
    assert key == "raw/mail/received_date=2026-10-04/abc.eml"


def test_message_digest_prefers_message_id() -> None:
    expected = hashlib.sha256(b"<id@example.com>").hexdigest()
    assert message_digest("<id@example.com>", b"ignored") == expected


def test_message_digest_falls_back_to_raw_bytes() -> None:
    assert message_digest(None, b"raw") == hashlib.sha256(b"raw").hexdigest()


def test_message_digest_requires_raw_bytes_without_message_id() -> None:
    with pytest.raises(ValueError):
        message_digest(None, None)


def test_write_once_uses_create_only_precondition() -> None:
    bucket = FakeBucket()
    assert GcsRawStore(bucket).write_once("k", b"data") is True
    assert bucket.upload_kwargs[0]["if_generation_match"] == 0
    assert bucket.upload_kwargs[0]["content_type"] == "message/rfc822"


def test_write_once_returns_false_and_keeps_original_when_key_exists() -> None:
    bucket = FakeBucket()
    store = GcsRawStore(bucket)
    store.write_once("k", b"first")
    assert store.write_once("k", b"second") is False
    assert bucket.objects["k"] == b"first"


def test_mail_partition_prefix_is_the_parent_of_every_key_of_that_day() -> None:
    prefix = mail_partition_prefix(date(2026, 10, 4))
    assert prefix == "raw/mail/received_date=2026-10-04/"
    assert mail_object_key(date(2026, 10, 4), "abc").startswith(prefix)


def test_existing_keys_lists_only_keys_under_the_prefix() -> None:
    bucket = FakeBucket()
    store = GcsRawStore(bucket)
    store.write_once("raw/mail/received_date=2026-10-04/a.eml", b"a")
    store.write_once("raw/mail/received_date=2026-10-05/b.eml", b"b")
    keys = store.existing_keys("raw/mail/received_date=2026-10-04/")
    assert keys == {"raw/mail/received_date=2026-10-04/a.eml"}


def test_read_returns_the_stored_bytes() -> None:
    store = GcsRawStore(FakeBucket())
    store.write_once("k", b"original")
    assert store.read("k") == b"original"


def test_exists_reflects_stored_objects() -> None:
    bucket = FakeBucket()
    store = GcsRawStore(bucket)
    assert store.exists("k") is False
    store.write_once("k", b"data")
    assert store.exists("k") is True
