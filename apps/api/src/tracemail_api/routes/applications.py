"""Private read endpoints for applications.

The application list is small and changes only when dbt rebuilds the marts,
so it is cached in process and re-read only when the applications table's
last-modified time or the owner's local date changes (waiting times depend
on the date). Checking the table's modified time is a metadata call and is
not billed; a cache miss runs one query.
"""

from datetime import date, datetime
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel

from tracemail_api.auth.sessions import require_private_access
from tracemail_api.warehouse import ApplicationRow, MartsReader

# Waiting times are counted in the owner's local days (dbt display_timezone).
DISPLAY_TIMEZONE = ZoneInfo("Europe/Istanbul")
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 100

router = APIRouter(
    prefix="/api/v1/applications",
    tags=["applications"],
    dependencies=[Depends(require_private_access)],
)


class ApplicationPage(BaseModel):
    """One page of the application list."""

    items: list[ApplicationRow]
    page: int
    page_size: int
    total: int


CacheKey = tuple[datetime | None, date]


class ApplicationCache:
    """The last application list read, and the state it was read at."""

    def __init__(self) -> None:
        self._key: CacheKey | None = None
        self._rows: list[ApplicationRow] = []

    async def rows(self, marts: MartsReader, today: date) -> list[ApplicationRow]:
        """The cached list, re-read if the table or the date changed."""
        key = (await marts.applications_modified(), today)
        if key != self._key:
            self._rows = await marts.applications()
            self._key = key
        return self._rows


def get_marts(request: Request) -> MartsReader:
    """The marts reader created at startup."""
    marts: MartsReader = request.app.state.marts
    return marts


def get_cache(request: Request) -> ApplicationCache:
    """The application cache created at startup."""
    cache: ApplicationCache = request.app.state.application_cache
    return cache


@router.get("")
async def list_applications(
    marts: Annotated[MartsReader, Depends(get_marts)],
    cache: Annotated[ApplicationCache, Depends(get_cache)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
) -> ApplicationPage:
    """Applications, most recent activity first, one page at a time."""
    rows = await cache.rows(marts, datetime.now(DISPLAY_TIMEZONE).date())
    start = (page - 1) * page_size
    return ApplicationPage(
        items=rows[start : start + page_size],
        page=page,
        page_size=page_size,
        total=len(rows),
    )
