"""Private read endpoint for incoming postings (step 1.10).

About a thousand postings, so filtering and paging happen here and the web
app fetches one page. Each posting has one status: applied if the owner
applied, saved if saved without applying, otherwise new. Counts per status
cover the selected period, for the filter chips. The list is cached like the
application list, keyed to the postings table's last-modified time.
"""

from datetime import timedelta
from enum import StrEnum
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from tracemail_api.auth.sessions import require_private_access
from tracemail_api.cache import MartCache
from tracemail_api.routes.deps import (
    MAX_PAGE_SIZE,
    get_marts,
    get_posting_cache,
    local_today,
)
from tracemail_api.search import MAX_QUERY_LENGTH, matches
from tracemail_api.warehouse import POSTINGS_TABLE, MartsReader, PostingRow

DEFAULT_PAGE_SIZE = 20
MAX_PERIOD_DAYS = 3660

router = APIRouter(
    prefix="/api/v1/postings",
    tags=["postings"],
    dependencies=[Depends(require_private_access)],
)


class PostingStatus(StrEnum):
    """What the owner did with a posting, most advanced first."""

    APPLIED = "applied"
    SAVED = "saved"
    NEW = "new"


class StatusFilter(StrEnum):
    """Status filter of the list; ``all`` keeps every status."""

    ALL = "all"
    APPLIED = "applied"
    SAVED = "saved"
    NEW = "new"


class SortKey(StrEnum):
    """The date column the list is ordered by (ADR-0042)."""

    FIRST_SEEN = "first_seen"
    LAST_SEEN = "last_seen"


class SortOrder(StrEnum):
    """Newest first (default) or oldest first."""

    DESC = "desc"
    ASC = "asc"


class Posting(PostingRow):
    """A posting with its derived status."""

    status: PostingStatus


class PostingCounts(BaseModel):
    """Postings per status within the selected period."""

    all: int
    applied: int
    saved: int
    new: int


class PostingPage(BaseModel):
    """One page of the posting list."""

    items: list[Posting]
    page: int
    page_size: int
    total: int
    counts: PostingCounts


def status_of(row: PostingRow) -> PostingStatus:
    """Applied beats saved; anything untouched is new."""
    if row.has_application:
        return PostingStatus.APPLIED
    if row.is_saved:
        return PostingStatus.SAVED
    return PostingStatus.NEW


def counts_of(postings: list[Posting]) -> PostingCounts:
    """How many postings have each status."""
    statuses = [posting.status for posting in postings]
    return PostingCounts(
        all=len(statuses),
        applied=statuses.count(PostingStatus.APPLIED),
        saved=statuses.count(PostingStatus.SAVED),
        new=statuses.count(PostingStatus.NEW),
    )


def sorted_postings(
    postings: list[Posting], sort: SortKey, order: SortOrder
) -> list[Posting]:
    """Postings by the chosen date; the stable sort keeps the warehouse order
    (newest first, then by key) among equal dates."""
    if sort is SortKey.FIRST_SEEN:
        return sorted(
            postings,
            key=lambda posting: posting.first_seen_date,
            reverse=order is SortOrder.DESC,
        )
    return sorted(
        postings,
        key=lambda posting: posting.last_seen_date,
        reverse=order is SortOrder.DESC,
    )


@router.get("")
async def list_postings(
    marts: Annotated[MartsReader, Depends(get_marts)],
    cache: Annotated[MartCache[PostingRow], Depends(get_posting_cache)],
    status: StatusFilter = StatusFilter.ALL,
    days: Annotated[int | None, Query(ge=1, le=MAX_PERIOD_DAYS)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
    q: Annotated[str | None, Query(max_length=MAX_QUERY_LENGTH)] = None,
    sort: SortKey = SortKey.FIRST_SEEN,
    order: SortOrder = SortOrder.DESC,
) -> PostingPage:
    """Postings first seen in the last ``days`` days (all if omitted) whose
    title or company matches ``q``, filtered by status, ordered by ``sort``
    and ``order``, one page at a time. Counts cover the period and the
    search."""
    rows = await cache.rows(await marts.modified(POSTINGS_TABLE), marts.postings)
    since = None if days is None else local_today() - timedelta(days=days - 1)
    in_period = [
        Posting(**row.model_dump(), status=status_of(row))
        for row in rows
        if (since is None or row.first_seen_date >= since)
        and matches(q, row.title, row.company)
    ]
    matching = sorted_postings(
        [
            posting
            for posting in in_period
            if status is StatusFilter.ALL or posting.status.value == status.value
        ],
        sort,
        order,
    )
    start = (page - 1) * page_size
    return PostingPage(
        items=matching[start : start + page_size],
        page=page,
        page_size=page_size,
        total=len(matching),
        counts=counts_of(in_period),
    )
