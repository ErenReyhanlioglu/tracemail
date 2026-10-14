"""Deployment records: raw GitHub JSON → one parsed row each (ADR-0045).

For each creation date, every stored deployment of that day is read and
reduced to the fields the delivery metrics need; the day's parsed file is
rewritten whole (ADR-0018). ``received_date`` is the deployment's UTC
creation date, the partition the landing loader uses for every table. No
message, title, or body of a pull request is kept beyond its number and
title, which are public on GitHub and shown on the panel.
"""

import json
import logging
import time
from collections.abc import Sequence
from datetime import UTC, date, datetime
from typing import Any

from pydantic import BaseModel

from tracemail_pipeline.ingest.deployments import deployment_partition_prefix
from tracemail_pipeline.ingest.raw_store import RawStore
from tracemail_pipeline.load.run_records import RunVolume
from tracemail_pipeline.parse.parsed_store import ParsedStore

logger = logging.getLogger(__name__)

DEPLOYMENTS = "github_deployments"
PARSER_NAME = "github_deployments"
PARSER_VERSION = "1"


class GithubDeployment(BaseModel):
    """One production deployment and the change it shipped."""

    source_key: str
    received_date: date
    parser_name: str
    parser_version: str
    deployment_id: int
    commit_sha: str
    created_at: datetime
    # The latest status: success, failure, or error.
    state: str
    finished_at: datetime
    # The Actions run that deployed, from the status's log URL.
    workflow_run_id: int | None
    pull_request_number: int | None
    pull_request_title: str | None
    merged_at: datetime | None
    # The change's first commit, where its lead time starts (ADR-0045).
    first_commit_at: datetime | None


class DeploymentParseResult(BaseModel):
    """Volume and timings for one run (ADR-0017)."""

    days: int = 0
    records: int = 0
    files_written: int = 0
    bytes_written: int = 0
    gcs_reads: int = 0
    gcs_lists: int = 0
    seconds_total: float = 0.0

    def volume(self) -> RunVolume:
        """Common volume fields for the run record."""
        return RunVolume(
            records_in=self.records,
            records_out=self.records,
            bytes_out=self.bytes_written,
        )


def _time(value: Any) -> datetime | None:
    return None if value is None else datetime.fromisoformat(str(value)).astimezone(UTC)


def _run_id(log_url: Any) -> int | None:
    """The workflow run id in ``.../actions/runs/<id>/job/<id>``."""
    parts = str(log_url or "").split("/runs/")
    if len(parts) != 2:
        return None
    run = parts[1].split("/")[0]
    return int(run) if run.isdigit() else None


def parse_deployment(key: str, day: date, raw: bytes) -> GithubDeployment:
    """One raw deployment record as a row."""
    record = json.loads(raw)
    deployment, latest = record["deployment"], record["statuses"][0]
    pull = record["pull_request"]
    commits = record["pull_request_commits"]
    first = min((c["commit"]["author"]["date"] for c in commits), default=None)
    return GithubDeployment(
        source_key=key,
        received_date=day,
        parser_name=PARSER_NAME,
        parser_version=PARSER_VERSION,
        deployment_id=deployment["id"],
        commit_sha=deployment["sha"],
        created_at=deployment["created_at"],
        state=latest["state"],
        finished_at=latest["created_at"],
        workflow_run_id=_run_id(latest.get("log_url")),
        pull_request_number=pull["number"] if pull else None,
        pull_request_title=pull["title"] if pull else None,
        merged_at=_time(pull.get("merged_at")) if pull else None,
        first_commit_at=_time(first),
    )


def parse_deployments(
    raw: RawStore, parsed: ParsedStore, days: Sequence[date]
) -> DeploymentParseResult:
    """Rewrite each day's parsed file from that day's raw records."""
    started = time.perf_counter()
    result = DeploymentParseResult(days=len(days))
    for day in days:
        keys = sorted(raw.existing_keys(deployment_partition_prefix(day)))
        result.gcs_lists += 1
        rows = [parse_deployment(key, day, raw.read(key)) for key in keys]
        result.gcs_reads += len(keys)
        result.records += len(rows)
        write = parsed.write_partition(DEPLOYMENTS, day, rows)
        result.files_written += int(write.written)
        result.bytes_written += write.bytes_written
    result.seconds_total = time.perf_counter() - started
    logger.info("Deployment parse finished: %s", result.model_dump())
    return result
