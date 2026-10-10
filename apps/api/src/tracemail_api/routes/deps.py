"""Dependencies shared by the read endpoints: the marts reader, the caches
created at startup, and the owner's local date."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import Request

from tracemail_api.cache import MartCache
from tracemail_api.warehouse import ApplicationRow, MartsReader, PostingRow

# Day counts follow the owner's local calendar (dbt display_timezone).
DISPLAY_TIMEZONE = ZoneInfo("Europe/Istanbul")
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
