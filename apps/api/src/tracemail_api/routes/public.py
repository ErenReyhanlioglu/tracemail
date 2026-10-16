"""Public health-panel endpoints with whitelisted schemas (ADR-0044).

Open to everyone, so they return only system-level values and are rate
limited per client. The panel comes in three parts, one per query, so each
loads and fails on its own (ADR-0050): run records, BigQuery storage, and
delivery. A part that cannot be read answers 503, and its cache keeps no
value, so the next request reads it again. The panel's views depend on the
current time, so each cache is keyed to a half-hour window starting a few
minutes past each hour and half hour, when the hourly run has written its
records: BigQuery is read at most twice an hour per part however many people
look (each read is billed the 10 MiB minimum, ADR-0044).
"""

import logging
import time
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from google.api_core.exceptions import GoogleAPIError
from google.auth.exceptions import GoogleAuthError

from tracemail_api.cache import MartCache
from tracemail_api.panel import DeliveryPanel, RunsPanel, StoragePanel
from tracemail_api.rate_limit import RateLimiter, client_key
from tracemail_api.routes.deps import (
    PanelCaches,
    get_marts,
    get_panel_caches,
    get_rate_limiter,
)
from tracemail_api.warehouse import MartsReader

logger = logging.getLogger(__name__)

REFRESH_SECONDS = 30 * 60
# The hourly run starts on the hour and records its steps within minutes.
REFRESH_OFFSET_SECONDS = 5 * 60
UNAVAILABLE: dict[int | str, dict[str, Any]] = {
    status.HTTP_503_SERVICE_UNAVAILABLE: {"description": "Part unavailable"}
}


def rate_limited(
    request: Request, limiter: Annotated[RateLimiter, Depends(get_rate_limiter)]
) -> None:
    """429 once the client is over its requests per minute."""
    if not limiter.allow(client_key(request), time.monotonic()):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS)


router = APIRouter(
    prefix="/api/v1/public/health-panel",
    tags=["public"],
    dependencies=[Depends(rate_limited)],
)


def refresh_window(now: datetime) -> int:
    """The cache key: which half-hour refresh window ``now`` falls in."""
    return int((now.timestamp() - REFRESH_OFFSET_SECONDS) // REFRESH_SECONDS)


async def read_part[T](
    name: str, cache: MartCache[T], load: Callable[[], Awaitable[list[T]]]
) -> T:
    """One part of the panel for the current window, or 503 if BigQuery
    cannot answer; the log names the part and the error type only."""
    try:
        rows = await cache.rows(refresh_window(datetime.now(UTC)), load)
    except (GoogleAPIError, GoogleAuthError) as e:
        logger.warning("Health panel part %s unavailable (%s)", name, type(e).__name__)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE) from e
    return rows[0]


@router.get("/runs", responses=UNAVAILABLE)
async def runs(
    marts: Annotated[MartsReader, Depends(get_marts)],
    caches: Annotated[PanelCaches, Depends(get_panel_caches)],
) -> RunsPanel:
    """The status line, stages, history strips, and per-run allowances."""
    return await read_part("runs", caches.runs, marts.runs_panel)


@router.get("/storage", responses=UNAVAILABLE)
async def storage(
    marts: Annotated[MartsReader, Depends(get_marts)],
    caches: Annotated[PanelCaches, Depends(get_panel_caches)],
) -> StoragePanel:
    """BigQuery storage against its free allowance."""
    return await read_part("storage", caches.storage, marts.storage_panel)


@router.get("/delivery", responses=UNAVAILABLE)
async def delivery(
    marts: Annotated[MartsReader, Depends(get_marts)],
    caches: Annotated[PanelCaches, Depends(get_panel_caches)],
) -> DeliveryPanel:
    """The delivery metrics, their daily strip, and the latest deployments."""
    return await read_part("delivery", caches.delivery, marts.delivery_panel)
