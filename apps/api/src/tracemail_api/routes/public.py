"""Public health-panel endpoint with a whitelisted schema (ADR-0044).

Open to everyone, so it returns only system-level values (``HealthPanel``)
and is rate limited per client. The panel's views depend on the current
time, so the cache is keyed to a half-hour window starting a few minutes
past each hour and half hour, when the hourly run has written its records:
BigQuery is read at most twice an hour however many people look (each read
is billed the 10 MiB minimum, ADR-0044).
"""

import time
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from tracemail_api.cache import MartCache
from tracemail_api.panel import HealthPanel
from tracemail_api.rate_limit import RateLimiter, client_key
from tracemail_api.routes.deps import get_marts, get_panel_cache, get_rate_limiter
from tracemail_api.warehouse import MartsReader

REFRESH_SECONDS = 30 * 60
# The hourly run starts on the hour and records its steps within minutes.
REFRESH_OFFSET_SECONDS = 5 * 60


def rate_limited(
    request: Request, limiter: Annotated[RateLimiter, Depends(get_rate_limiter)]
) -> None:
    """429 once the client is over its requests per minute."""
    if not limiter.allow(client_key(request), time.monotonic()):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS)


router = APIRouter(
    prefix="/api/v1/public",
    tags=["public"],
    dependencies=[Depends(rate_limited)],
)


def refresh_window(now: datetime) -> int:
    """The cache key: which half-hour refresh window ``now`` falls in."""
    return int((now.timestamp() - REFRESH_OFFSET_SECONDS) // REFRESH_SECONDS)


@router.get("/health-panel")
async def health_panel(
    marts: Annotated[MartsReader, Depends(get_marts)],
    cache: Annotated[MartCache[HealthPanel], Depends(get_panel_cache)],
) -> HealthPanel:
    """The health panel's sections, read at most once per refresh window."""
    rows = await cache.rows(refresh_window(datetime.now(UTC)), marts.health_panel)
    return rows[0]
