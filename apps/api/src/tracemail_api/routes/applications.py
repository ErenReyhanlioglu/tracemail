"""Private read endpoints for applications.

The application list is small and changes only when dbt rebuilds the marts,
so it is cached in process and re-read only when the applications table's
last-modified time or the owner's local date changes (waiting times depend
on the date). Checking the table's modified time is a metadata call and is
not billed; a cache miss runs one query.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from tracemail_api.auth.sessions import require_private_access
from tracemail_api.cache import MartCache
from tracemail_api.routes.deps import (
    MAX_PAGE_SIZE,
    get_application_cache,
    get_marts,
    local_today,
)
from tracemail_api.warehouse import APPLICATIONS_TABLE, ApplicationRow, MartsReader

DEFAULT_PAGE_SIZE = 50

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


@router.get("")
async def list_applications(
    marts: Annotated[MartsReader, Depends(get_marts)],
    cache: Annotated[MartCache[ApplicationRow], Depends(get_application_cache)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
) -> ApplicationPage:
    """Applications, most recent activity first, one page at a time."""
    key = (await marts.modified(APPLICATIONS_TABLE), local_today())
    rows = await cache.rows(key, marts.applications)
    start = (page - 1) * page_size
    return ApplicationPage(
        items=rows[start : start + page_size],
        page=page,
        page_size=page_size,
        total=len(rows),
    )
