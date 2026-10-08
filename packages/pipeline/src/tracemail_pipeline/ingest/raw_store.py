"""Write-once raw object storage in GCS (ADR-0006).

Raw objects are never overwritten: every write uses the create-only
precondition ``if_generation_match=0``, so writing a key that already exists
is a no-op instead of a change. Keys are deterministic, which turns re-fetched
mail into such no-ops (ADR-0007).
"""

import hashlib
from datetime import date
from typing import Protocol

import google.cloud.storage as storage
from google.api_core.exceptions import PreconditionFailed

RAW_MAIL_PREFIX = "raw/mail"
EML_CONTENT_TYPE = "message/rfc822"
CREATE_ONLY_GENERATION = 0


class RawStore(Protocol):
    """Write-once storage for original source bytes."""

    def exists(self, key: str) -> bool: ...

    def existing_keys(self, prefix: str) -> set[str]: ...

    def read(self, key: str) -> bytes: ...

    def write_once(self, key: str, data: bytes) -> bool: ...


def mail_partition_prefix(received_date: date) -> str:
    """Return the key prefix holding every message received on one day."""
    return f"{RAW_MAIL_PREFIX}/received_date={received_date.isoformat()}/"


def mail_object_key(received_date: date, digest: str) -> str:
    """Build the object key for one mail message.

    The partition is the message's received date (IMAP internal date, UTC), not
    the run date, so the same message always maps to the same key no matter
    which run fetches it.
    """
    return f"{mail_partition_prefix(received_date)}{digest}.eml"


def message_digest(message_id: str | None, raw: bytes | None) -> str:
    """Return the dedup digest: sha256 of the Message-ID, else of the raw bytes."""
    if message_id:
        return hashlib.sha256(message_id.encode("utf-8")).hexdigest()
    if raw is None:
        raise ValueError("A message without Message-ID needs its raw bytes")
    return hashlib.sha256(raw).hexdigest()


class GcsRawStore:
    """Raw store backed by a GCS bucket."""

    def __init__(self, bucket: storage.Bucket) -> None:
        self._bucket = bucket

    def exists(self, key: str) -> bool:
        """Return whether an object with this key is already stored."""
        return bool(self._bucket.blob(key).exists())

    def existing_keys(self, prefix: str) -> set[str]:
        """Return every key under a prefix, in one listing (a Class A operation
        per page) instead of one existence check per object."""
        return {blob.name for blob in self._bucket.list_blobs(prefix=prefix)}

    def read(self, key: str) -> bytes:
        """Return an object's original bytes."""
        return bytes(self._bucket.blob(key).download_as_bytes())

    def write_once(self, key: str, data: bytes) -> bool:
        """Create the object; return ``False`` if it already existed."""
        blob = self._bucket.blob(key)
        try:
            blob.upload_from_string(
                data,
                content_type=EML_CONTENT_TYPE,
                if_generation_match=CREATE_ONLY_GENERATION,
            )
        except PreconditionFailed:
            return False
        return True
