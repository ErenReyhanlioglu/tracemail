"""Dependencies shared by the read endpoints: the marts reader, the caches
and the rate limiter created at startup, and the owner's local date."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import Request

from tracemail_api.cache import MartCache
from tracemail_api.panel import HealthPanel
from tracemail_api.rate_limit import RateLimiter
from tracemail_api.warehouse import (
    DISPLAY_TIMEZONE_NAME,
    ApplicationRow,
    MartsReader,
    PostingRow,
)

# Day counts follow the owner's local calendar (dbt display_timezone).
DISPLAY_TIMEZONE = ZoneInfo(DISPLAY_TIMEZONE_NAME)
MAX_PAGE_SIZE = 100


def local_today() -> date:
    """Today in the owner's time zone."""
    return datetime.now(DISPLAY_TIMEZONE).date()


def get_marts(request: Request) -> MartsReader:
    """The marts reader created at startup."""
    marts: MartsReader = request.app.state.marts
    return marts


def get_application_cache(request: Request) -> MartCache[ApplicationRow]:
    """The application-list cache created at startup."""
    cache: MartCache[ApplicationRow] = request.app.state.application_cache
    return cache


def get_posting_cache(request: Request) -> MartCache[PostingRow]:
    """The posting-list cache created at startup."""
    cache: MartCache[PostingRow] = request.app.state.posting_cache
    return cache


def get_panel_cache(request: Request) -> MartCache[HealthPanel]:
    """The health-panel cache created at startup."""
    cache: MartCache[HealthPanel] = request.app.state.panel_cache
    return cache


def get_rate_limiter(request: Request) -> RateLimiter:
    """The public endpoints' rate limiter created at startup."""
    limiter: RateLimiter = request.app.state.rate_limiter
    return limiter
