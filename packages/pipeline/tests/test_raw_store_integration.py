"""Integration test: write-once semantics against the real dev bucket.

Writes under a dedicated ``integration-tests/`` prefix, never under ``raw/``,
and deletes what it wrote. Run with ``just test-integration``.
"""

import uuid
from collections.abc import Iterator

import pytest
from google.cloud import storage

from tracemail_pipeline.config import PipelineSettings
from tracemail_pipeline.ingest.raw_store import GcsRawStore

TEST_PREFIX = "integration-tests"

pytestmark = pytest.mark.integration


@pytest.fixture
def bucket() -> Iterator[storage.Bucket]:
    settings = PipelineSettings()  # type: ignore[call-arg]
    bucket = storage.Client(project=settings.gcp_project).bucket(settings.data_bucket)
    yield bucket
    for blob in bucket.list_blobs(prefix=f"{TEST_PREFIX}/"):
        blob.delete()


def test_gcs_write_once_refuses_to_overwrite_an_existing_object(
    bucket: storage.Bucket,
) -> None:
    store = GcsRawStore(bucket)
    key = f"{TEST_PREFIX}/{uuid.uuid4().hex}.eml"
    assert store.write_once(key, b"first") is True
    assert store.exists(key) is True
    assert key in store.existing_keys(f"{TEST_PREFIX}/")
    assert store.write_once(key, b"second") is False
    assert bucket.blob(key).download_as_bytes() == b"first"
