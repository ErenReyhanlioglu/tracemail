"""FastAPI application, lifespan, and middleware.

Run with the factory, so settings are read at startup and never at import:
``uvicorn tracemail_api.main:create_app --factory``.
"""

from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from datetime import timedelta
from typing import Literal

from fastapi import FastAPI, Request, Response
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.sessions import SessionMiddleware

from tracemail_api.auth.google import google_client
from tracemail_api.config import ApiSettings
from tracemail_api.routes import auth

SESSION_COOKIE = "tracemail_session"
SAME_SITE: Literal["lax"] = "lax"
REFERRER_POLICY = "no-referrer"


def create_app(settings: ApiSettings | None = None) -> FastAPI:
    """Build the application; settings come from the environment by default."""
    resolved = settings or ApiSettings()  # type: ignore[call-arg]  # values from env

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.settings = resolved
        app.state.google = google_client(resolved)
        yield

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
    return app


async def _no_referrer(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    response = await call_next(request)
    response.headers["Referrer-Policy"] = REFERRER_POLICY
    return response
