"""FastAPI application, lifespan, and middleware.

Run with the factory, so settings are read at startup and never at import:
``uvicorn tracemail_api.main:create_app --factory``.
"""

import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from datetime import timedelta
from typing import Literal

from fastapi import FastAPI, Request, Response
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.sessions import SessionMiddleware

from tracemail_api.auth.google import google_client
from tracemail_api.config import ApiSettings
from tracemail_api.routes import applications, auth, health
from tracemail_api.routes.applications import ApplicationCache
from tracemail_api.warehouse import MartsReader, marts_reader

SESSION_COOKIE = "tracemail_session"
SAME_SITE: Literal["lax"] = "lax"
REFERRER_POLICY = "no-referrer"
ACCESS_LOGGER = "uvicorn.access"
# Position of the request path in uvicorn's access-log record arguments.
ACCESS_PATH_ARG = 2


class _DropQueryString(logging.Filter):
    """Removes query strings from access-log lines: the OAuth callback's
    carries the authorization code and state, which must never be logged."""

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        if isinstance(args, tuple) and len(args) > ACCESS_PATH_ARG:
            path = str(args[ACCESS_PATH_ARG]).split("?", 1)[0]
            record.args = (*args[:ACCESS_PATH_ARG], path, *args[ACCESS_PATH_ARG + 1 :])
        return True


def create_app(
    settings: ApiSettings | None = None, marts: MartsReader | None = None
) -> FastAPI:
    """Build the application; settings come from the environment and the marts
    reader from the settings unless given (tests pass fakes)."""
    resolved = settings or ApiSettings()  # type: ignore[call-arg]  # values from env
    access_log = logging.getLogger(ACCESS_LOGGER)
    if not any(isinstance(f, _DropQueryString) for f in access_log.filters):
        access_log.addFilter(_DropQueryString())

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.settings = resolved
        app.state.google = google_client(resolved)
        app.state.marts = marts or marts_reader(resolved)
        app.state.application_cache = ApplicationCache()
        try:
            yield
        finally:
            app.state.marts.close()

    app = FastAPI(title="TraceMail API", lifespan=lifespan)
    # Secure and SameSite=Lax always: no setting can turn them off (ADR-0032).
    app.add_middleware(
        SessionMiddleware,
        secret_key=resolved.session_secret.get_secret_value(),
        session_cookie=SESSION_COOKIE,
        max_age=int(timedelta(days=resolved.session_days).total_seconds()),
        same_site=SAME_SITE,
        https_only=True,
    )
    app.add_middleware(GZipMiddleware)
    app.middleware("http")(_no_referrer)
    app.include_router(auth.router)
    app.include_router(health.router)
    app.include_router(applications.router)
    return app


async def _no_referrer(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    response = await call_next(request)
    response.headers["Referrer-Policy"] = REFERRER_POLICY
    return response
