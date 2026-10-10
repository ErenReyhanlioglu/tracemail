"""Read access to the BigQuery marts for the API.

Every query runs with the marts dataset as its default dataset, so SQL names
tables without building identifiers from strings, and with the per-query
cost guardrail. Results are read by row iteration through the standard API,
never the Storage Read API (ADR-0011, ADR-0016). The client is synchronous,
so every call runs in a worker thread.
"""

import asyncio
from datetime import date, datetime
from pathlib import Path

from google.cloud import bigquery
from pydantic import BaseModel

from tracemail_api.config import ApiSettings

APPLICATIONS_SQL = Path(__file__).parent / "sql" / "applications.sql"
# The table whose rebuild marks new application data (dbt rebuilds it only
# when landing changed, ADR-0022).
APPLICATIONS_TABLE = "dim_applications"


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


class MartsReader:
    """Queries and metadata calls against the marts dataset."""

    def __init__(self, client: bigquery.Client, settings: ApiSettings) -> None:
        self._client = client
        self._dataset = f"{settings.gcp_project}.{settings.bq_marts_dataset}"
        self._location = settings.bq_location
        self._max_bytes_billed = settings.bq_max_bytes_billed

    def close(self) -> None:
        """Release the client's connections."""
        # google-cloud-bigquery leaves close() unannotated.
        self._client.close()  # type: ignore[no-untyped-call]

    async def check(self) -> None:
        """Reach the marts dataset (a metadata call, not billed)."""
        await asyncio.to_thread(self._client.get_dataset, self._dataset)

    async def applications_modified(self) -> datetime | None:
        """When the applications table was last rebuilt (not billed)."""
        table = f"{self._dataset}.{APPLICATIONS_TABLE}"
        result = await asyncio.to_thread(self._client.get_table, table)
        modified: datetime | None = result.modified
        return modified

    async def applications(self) -> list[ApplicationRow]:
        """Every application, most recent activity first."""
        return await asyncio.to_thread(self._applications)

    def _applications(self) -> list[ApplicationRow]:
        config = bigquery.QueryJobConfig(
            default_dataset=self._dataset,
            maximum_bytes_billed=self._max_bytes_billed,
        )
        job = self._client.query(
            APPLICATIONS_SQL.read_text(encoding="utf-8"),
            job_config=config,
            location=self._location,
        )
        return [
            ApplicationRow.model_validate(dict(row.items())) for row in job.result()
        ]


def marts_reader(settings: ApiSettings) -> MartsReader:
    """A reader with a client for the configured project."""
    return MartsReader(bigquery.Client(project=settings.gcp_project), settings)
