"""Owner login and logout routes (ADR-0015, ADR-0032).

Any Google account can complete Google's side of the login; only the owner's
``sub`` gets a session. Everyone else gets 403 and, so the owner can find
their own id on first setup, the refusal shows the signed-in account its own
``sub`` and nothing else.
"""

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, RedirectResponse, Response
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

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class NotAuthorized(BaseModel):
    """Returned to a Google account that is not the owner."""

    detail: str
    account_id: str


class Me(BaseModel):
    """The role of the current session."""

    role: Role


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


@router.get(
    "/google/callback",
    responses={status.HTTP_403_FORBIDDEN: {"model": NotAuthorized}},
)
async def google_callback(
    request: Request, settings: Settings, google: Google
) -> Response:
    """Finish the login: a session for the owner, 403 for anyone else."""
    try:
        sub = await signed_in_sub(google, request)
    except LoginError as e:
        end_session(request.session)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Login failed") from e
    if sub != settings.owner_sub:
        end_session(request.session)
        refusal = NotAuthorized(detail="This account is not authorized", account_id=sub)
        return JSONResponse(refusal.model_dump(), status.HTTP_403_FORBIDDEN)
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
