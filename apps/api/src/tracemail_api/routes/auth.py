"""Owner login and logout routes (ADR-0015, ADR-0032, ADR-0040).

Any Google account can complete Google's side of the login; only the owner's
``sub`` gets a session. Everyone else, and any login that fails, is sent back
to the web app's login page with a reason code, which the page explains in
Turkish; no account identifier is shown or put in the address.
"""

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel

from tracemail_api.auth.google import (
    GoogleClient,
    LoginError,
    callback_url,
    signed_in_sub,
)
from tracemail_api.auth.sessions import (
    Role,
    end_session,
    require_private_access,
    start_session,
)
from tracemail_api.config import ApiSettings

AFTER_LOGIN_PATH = "/"
# The web app's login page and the reasons it explains (ADR-0040).
LOGIN_PAGE_PATH = "/login"
NOT_AUTHORIZED = "not_authorized"
LOGIN_FAILED = "failed"

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class Me(BaseModel):
    """The role of the current session."""

    role: Role


def back_to_login(reason: str) -> RedirectResponse:
    """Send the browser to the login page with the reason it was refused."""
    return RedirectResponse(
        f"{LOGIN_PAGE_PATH}?error={reason}", status.HTTP_303_SEE_OTHER
    )


def get_settings(request: Request) -> ApiSettings:
    """The settings loaded at startup."""
    settings: ApiSettings = request.app.state.settings
    return settings


def get_google(request: Request) -> GoogleClient:
    """The Google client created at startup."""
    client: GoogleClient = request.app.state.google
    return client


Settings = Annotated[ApiSettings, Depends(get_settings)]
Google = Annotated[GoogleClient, Depends(get_google)]


@router.get("/google/login")
async def google_login(
    request: Request, settings: Settings, google: Google
) -> Response:
    """Send the browser to Google's sign-in page."""
    return await google.authorize_redirect(request, callback_url(settings))


@router.get("/google/callback")
async def google_callback(
    request: Request, settings: Settings, google: Google
) -> Response:
    """Finish the login: a session for the owner, the login page for others."""
    try:
        sub = await signed_in_sub(google, request)
    except LoginError:
        end_session(request.session)
        return back_to_login(LOGIN_FAILED)
    if sub != settings.owner_sub:
        end_session(request.session)
        return back_to_login(NOT_AUTHORIZED)
    lifetime = timedelta(days=settings.session_days)
    start_session(request.session, Role.OWNER, datetime.now(UTC), lifetime)
    return RedirectResponse(AFTER_LOGIN_PATH, status.HTTP_303_SEE_OTHER)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request) -> None:
    """End the current session, if any."""
    end_session(request.session)


@router.get("/me")
async def me(role: Annotated[Role, Depends(require_private_access)]) -> Me:
    """The current session's role; 401 without a valid session."""
    return Me(role=role)
