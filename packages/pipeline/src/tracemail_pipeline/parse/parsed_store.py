"""Writes parser output to the parsed zone as JSONL (ADR-0006, ADR-0018).

Partition overwrite: one file per record type per received date, rewritten
whole each time that day is parsed. A day with no records of a type still gets
an empty file, so a re-parse that produces nothing replaces stale output.
"""

from collections.abc import Sequence
from datetime import date
from typing import Protocol

from google.cloud import storage
from pydantic import BaseModel

PARSED_PREFIX = "parsed"
JSONL_CONTENT_TYPE = "application/x-ndjson"


class ParsedStore(Protocol):
    """Overwritable storage for one day's records of one type."""

    def write_partition(
        self, record_type: str, received_date: date, rows: Sequence[BaseModel]
    ) -> int: ...


def parsed_object_key(record_type: str, received_date: date) -> str:
    """Return the key of one record type's file for one received date."""
    return (
        f"{PARSED_PREFIX}/{record_type}/"
        f"received_date={received_date.isoformat()}/data.jsonl"
    )


def to_jsonl(rows: Sequence[BaseModel]) -> bytes:
    """Serialize rows as JSON Lines (one JSON object per line)."""
    return "".join(f"{row.model_dump_json()}\n" for row in rows).encode("utf-8")


class GcsParsedStore:
    """Parsed store backed by the data bucket."""

    def __init__(self, bucket: storage.Bucket) -> None:
        self._bucket = bucket

    def write_partition(
        self, record_type: str, received_date: date, rows: Sequence[BaseModel]
    ) -> int:
        """Replace the partition's file; return the number of bytes written."""
        data = to_jsonl(rows)
        blob = self._bucket.blob(parsed_object_key(record_type, received_date))
        blob.upload_from_string(data, content_type=JSONL_CONTENT_TYPE)
        return len(data)
