"""Read access to the BigQuery marts for the API.

Every query runs with the marts dataset as its default dataset, so SQL names
tables without building identifiers from strings, and with the per-query
cost guardrail. Results are read by row iteration through the standard API,
never the Storage Read API (ADR-0011, ADR-0016). The client is synchronous,
so every call runs in a worker thread.
"""

import asyncio
from collections.abc import Sequence
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from google.cloud import bigquery
from pydantic import BaseModel

from tracemail_api.config import ApiSettings
from tracemail_api.panel import (
    MEDIAN_DAYS,
    STAGE_HOURS,
    WINDOW_DAYS,
    HealthPanel,
    Resource,
)

SQL_DIR = Path(__file__).parent / "sql"
APPLICATIONS_SQL = SQL_DIR / "applications.sql"
POSTINGS_SQL = SQL_DIR / "postings.sql"
HEALTH_PANEL_SQL = SQL_DIR / "health_panel.sql"
BIGQUERY_STORAGE_SQL = SQL_DIR / "bigquery_storage.sql"
# Local dates on the panel follow the owner's calendar (dbt display_timezone).
DISPLAY_TIMEZONE_NAME = "Europe/Istanbul"
# Tables whose rebuild marks new data (dbt rebuilds them only when landing
# changed, ADR-0022).
APPLICATIONS_TABLE = "dim_applications"
POSTINGS_TABLE = "dim_postings"


class ApplicationRow(BaseModel):
    """One application as the owner's list shows it."""

    application_key: str
    company: str | None
    title: str | None
    location: str | None
    channel: str | None
    posting_url: str | None
    applied_on: date | None
    current_status: str | None
    last_event_date: date
    days_since_last_event: int
    is_silent: bool
    is_closed_without_reply: bool
    event_count: int


class PostingRow(BaseModel):
    """One posting as the incoming-postings list shows it."""

    posting_key: str
    title: str | None
    company: str | None
    location: str | None
    posting_url: str | None
    first_seen_date: date
    last_seen_date: date
    mention_count: int
    is_saved: bool
    has_application: bool
    applied_on: date | None


class MartsReader:
    """Queries and metadata calls against the marts dataset."""

    def __init__(self, client: bigquery.Client, settings: ApiSettings) -> None:
        self._client = client
        self._dataset = f"{settings.gcp_project}.{settings.bq_marts_dataset}"
        self._location = settings.bq_location
        self._max_bytes_billed = settings.bq_max_bytes_billed
        self._freshness_target_hours = settings.freshness_target_hours
        self._freshness_objective_percent = settings.freshness_objective_percent

    def close(self) -> None:
        """Release the client's connections."""
        # google-cloud-bigquery leaves close() unannotated.
        self._client.close()  # type: ignore[no-untyped-call]

    async def check(self) -> None:
        """Reach the marts dataset (a metadata call, not billed)."""
        await asyncio.to_thread(self._client.get_dataset, self._dataset)

    async def modified(self, table: str) -> datetime | None:
        """When a marts table was last rebuilt (not billed)."""
        result = await asyncio.to_thread(
            self._client.get_table, f"{self._dataset}.{table}"
        )
        modified: datetime | None = result.modified
        return modified

    async def applications(self) -> list[ApplicationRow]:
        """Every application, most recent activity first."""
        rows = await asyncio.to_thread(self._query, APPLICATIONS_SQL)
        return [ApplicationRow.model_validate(row) for row in rows]

    async def postings(self) -> list[PostingRow]:
        """Every posting, newest first."""
        rows = await asyncio.to_thread(self._query, POSTINGS_SQL)
        return [PostingRow.model_validate(row) for row in rows]

    async def health_panel(self) -> list[HealthPanel]:
        """The public health panel: one query for run history (billed the
        10 MiB minimum) and one for storage metadata (billed 0, ADR-0044)."""
        params = [
            bigquery.ScalarQueryParameter(
                "display_timezone", "STRING", DISPLAY_TIMEZONE_NAME
            ),
            bigquery.ScalarQueryParameter("window_days", "INT64", WINDOW_DAYS),
            bigquery.ScalarQueryParameter("stage_hours", "INT64", STAGE_HOURS),
            bigquery.ScalarQueryParameter("median_days", "INT64", MEDIAN_DAYS),
        ]
        rows = await asyncio.to_thread(self._query, HEALTH_PANEL_SQL, params)
        storage = await asyncio.to_thread(self._query, BIGQUERY_STORAGE_SQL)
        panel = HealthPanel.model_validate(
            {
                **rows[0],
                "read_at": datetime.now(UTC),
                "freshness_target_hours": self._freshness_target_hours,
                "freshness_objective_percent": self._freshness_objective_percent,
            }
        )
        extra = [
            Resource.model_validate({**row, "projected_month": None}) for row in storage
        ]
        return [panel.model_copy(update={"resources": [*panel.resources, *extra]})]

    def _query(
        self, sql: Path, params: Sequence[bigquery.ScalarQueryParameter] = ()
    ) -> list[dict[str, Any]]:
        config = bigquery.QueryJobConfig(
            default_dataset=self._dataset,
            maximum_bytes_billed=self._max_bytes_billed,
            query_parameters=list(params),
        )
        job = self._client.query(
            sql.read_text(encoding="utf-8"), job_config=config, location=self._location
        )
        return [dict(row.items()) for row in job.result()]


def marts_reader(settings: ApiSettings) -> MartsReader:
    """A reader with a client for the configured project."""
    return MartsReader(bigquery.Client(project=settings.gcp_project), settings)
