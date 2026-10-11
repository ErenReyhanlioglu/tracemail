"""Writes parser output to the parsed zone as JSONL (ADR-0006, ADR-0018).

Partition overwrite: one file per record type per received date, replaced
whole each time that day is parsed. A day with no records of a type still gets
an empty file, so a re-parse that produces nothing replaces stale output.

An unchanged file is not rewritten (ADR-0030, option 2): before writing, the
stored object's MD5 is read from its metadata and compared with the new
content. The stored file therefore always equals what the parser produced,
while a write (GCS Class A) is spent only when the content changed. The
metadata read is Class B when the object exists; for a missing object the
404 is not billed.
"""

import base64
import hashlib
from collections.abc import Sequence
from datetime import date
from typing import Protocol

import google.cloud.storage as storage
from pydantic import BaseModel

PARSED_PREFIX = "parsed"
JSONL_CONTENT_TYPE = "application/x-ndjson"


class PartitionWrite(BaseModel):
    """What writing one partition file cost and did."""

    bytes_written: int
    written: bool
    metadata_read: bool


class ParsedStore(Protocol):
    """Overwritable storage for one day's records of one type."""

    def write_partition(
        self, record_type: str, received_date: date, rows: Sequence[BaseModel]
    ) -> PartitionWrite: ...


def parsed_object_key(record_type: str, received_date: date) -> str:
    """Return the key of one record type's file for one received date."""
    return (
        f"{PARSED_PREFIX}/{record_type}/"
        f"received_date={received_date.isoformat()}/data.jsonl"
    )


def to_jsonl(rows: Sequence[BaseModel]) -> bytes:
    """Serialize rows as JSON Lines (one JSON object per line)."""
    return "".join(f"{row.model_dump_json()}\n" for row in rows).encode("utf-8")


def md5_base64(data: bytes) -> str:
    """The MD5 of the data in the form GCS reports it (base64)."""
    # MD5 here detects unchanged content, as GCS itself does; not security.
    digest = hashlib.md5(data, usedforsecurity=False).digest()
    return base64.b64encode(digest).decode("ascii")


class GcsParsedStore:
    """Parsed store backed by the data bucket."""

    def __init__(self, bucket: storage.Bucket) -> None:
        self._bucket = bucket

    def write_partition(
        self, record_type: str, received_date: date, rows: Sequence[BaseModel]
    ) -> PartitionWrite:
        """Replace the partition's file unless it already holds this content."""
        data = to_jsonl(rows)
        key = parsed_object_key(record_type, received_date)
        stored = self._bucket.get_blob(key)
        if stored is not None and stored.md5_hash == md5_base64(data):
            return PartitionWrite(bytes_written=0, written=False, metadata_read=True)
        blob = self._bucket.blob(key)
        blob.upload_from_string(data, content_type=JSONL_CONTENT_TYPE)
        return PartitionWrite(
            bytes_written=len(data), written=True, metadata_read=stored is not None
        )
