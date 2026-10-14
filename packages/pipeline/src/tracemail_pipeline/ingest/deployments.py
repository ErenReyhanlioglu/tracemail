"""Deployment ingestion: GitHub's deployment records into the raw zone (ADR-0045).

For a time window, every production deployment created in it that has
finished (its latest status is terminal) is stored once, as GitHub returned
it: the deployment, its statuses, and the pull request that brought its
commit with that pull request's commits, for the change's first commit. The
key is the deployment's own id under its UTC creation date, so a re-run
writes the same key and the create-only precondition makes it a no-op; a
deployment still running is left for a later run. Nothing is listed in GCS.
"""

import json
import logging
import time
from datetime import UTC, date, datetime
from typing import Any

from pydantic import BaseModel

from tracemail_pipeline.ingest.github_api import GithubApi
from tracemail_pipeline.ingest.raw_store import RawStore
from tracemail_pipeline.load.run_records import RunVolume

logger = logging.getLogger(__name__)

RAW_DEPLOYMENTS_PREFIX = "raw/github/deployments"
JSON_CONTENT_TYPE = "application/json"
ENVIRONMENT = "production"
# GitHub's newest-first page; the window of an hourly run holds far fewer.
PAGE_SIZE = 100
TERMINAL_STATES = frozenset({"success", "failure", "error"})


class DeploymentIngestResult(BaseModel):
    """Volume, operations, and timings for one run; the only thing logged."""

    listed: int = 0
    in_window: int = 0
    unfinished: int = 0
    already_stored: int = 0
    written: int = 0
    # Creation dates that got new raw objects: the days to parse and load.
    written_days: list[date] = []
    bytes_written: int = 0
    github_requests: int = 0
    # Objects created (Class A); a write rejected as already stored returns
    # 412 and is not billed.
    gcs_writes: int = 0
    seconds_total: float = 0.0

    def volume(self) -> RunVolume:
        """Common volume fields for the run record (ADR-0020)."""
        return RunVolume(
            records_in=self.in_window,
            records_out=self.written,
            bytes_out=self.bytes_written,
        )


def deployment_partition_prefix(created: date) -> str:
    """The key prefix of every deployment created on one UTC day."""
    return f"{RAW_DEPLOYMENTS_PREFIX}/created_date={created.isoformat()}/"


def deployment_object_key(created: date, deployment_id: int) -> str:
    """The object key of one deployment record."""
    return f"{deployment_partition_prefix(created)}{deployment_id}.json"


def created_at(deployment: dict[str, Any]) -> datetime:
    """A deployment's creation time, in UTC."""
    return datetime.fromisoformat(str(deployment["created_at"])).astimezone(UTC)


def ingest_deployments(
    api: GithubApi, store: RawStore, window_start: datetime, window_end: datetime
) -> DeploymentIngestResult:
    """Store every finished production deployment created in the window."""
    started = time.perf_counter()
    result = DeploymentIngestResult()
    listed = api.get(f"/deployments?environment={ENVIRONMENT}&per_page={PAGE_SIZE}")
    result.listed = len(listed)
    days: set[date] = set()
    for deployment in listed:
        if not window_start <= created_at(deployment) < window_end:
            continue
        result.in_window += 1
        _store_deployment(api, store, deployment, result, days)
    result.written_days = sorted(days)
    result.github_requests = api.requests
    result.seconds_total = time.perf_counter() - started
    logger.info("Deployment ingestion finished: %s", result.model_dump())
    return result


def _store_deployment(
    api: GithubApi,
    store: RawStore,
    deployment: dict[str, Any],
    result: DeploymentIngestResult,
    days: set[date],
) -> None:
    """Write one deployment once it has finished."""
    statuses = api.get(f"/deployments/{deployment['id']}/statuses")
    if not statuses or statuses[0]["state"] not in TERMINAL_STATES:
        result.unfinished += 1
        return
    record = {
        "deployment": deployment,
        "statuses": statuses,
        **_change(api, deployment),
    }
    data = json.dumps(record, sort_keys=True, separators=(",", ":")).encode("utf-8")
    day = created_at(deployment).date()
    if store.write_once(
        deployment_object_key(day, deployment["id"]), data, JSON_CONTENT_TYPE
    ):
        result.written += 1
        result.gcs_writes += 1
        result.bytes_written += len(data)
        days.add(day)
    else:
        result.already_stored += 1


def _change(api: GithubApi, deployment: dict[str, Any]) -> dict[str, Any]:
    """The pull request that brought the deployed commit, and its commits."""
    pulls = api.get(f"/commits/{deployment['sha']}/pulls")
    if not pulls:
        return {"pull_request": None, "pull_request_commits": []}
    pull = pulls[0]
    commits = api.get(f"/pulls/{pull['number']}/commits?per_page={PAGE_SIZE}")
    return {"pull_request": pull, "pull_request_commits": commits}
