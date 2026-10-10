"""Google Sign-In for the owner (ADR-0015, ADR-0032).

Authlib's Starlette client does the OpenID Connect work: it loads Google's
settings from the discovery document, sends a fresh ``state``, ``nonce``, and
PKCE challenge with every login, and on the callback checks the state and
validates the ID token (signature, issuer, audience, expiry, nonce). This
module only configures it and reads the validated ``sub``.
"""

from typing import Any, Protocol

from authlib.integrations.starlette_client import OAuth, OAuthError
from starlette.requests import Request
from starlette.responses import Response

from tracemail_api.config import ApiSettings

CLIENT_NAME = "google"
DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"
# Only the identity scopes ADR-0015 allows.
SCOPE = "openid email"
PKCE_METHOD = "S256"
CALLBACK_PATH = "/api/v1/auth/google/callback"


class LoginError(Exception):
    """Google did not return a valid identity for this login attempt."""


class GoogleClient(Protocol):
    """The part of Authlib's client the routes use."""

    async def authorize_redirect(
        self, request: Request, redirect_uri: str
    ) -> Response: ...

    async def authorize_access_token(self, request: Request) -> dict[str, Any]: ...


def google_client(settings: ApiSettings) -> GoogleClient:
    """An OpenID Connect client for Google, with PKCE."""
    oauth = OAuth()
    client: GoogleClient = oauth.register(
        name=CLIENT_NAME,
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret.get_secret_value(),
        server_metadata_url=DISCOVERY_URL,
        client_kwargs={"scope": SCOPE, "code_challenge_method": PKCE_METHOD},
    )
    return client


def callback_url(settings: ApiSettings) -> str:
    """The redirect URI registered on the OAuth client."""
    return f"{settings.public_url.rstrip('/')}{CALLBACK_PATH}"


async def signed_in_sub(client: GoogleClient, request: Request) -> str:
    """The ``sub`` of the account that just signed in; ``LoginError`` if the
    callback is not a valid, completed login."""
    try:
        token = await client.authorize_access_token(request)
    except OAuthError as e:
        raise LoginError(e.error) from e
    userinfo = token.get("userinfo") or {}
    sub = userinfo.get("sub")
    if not isinstance(sub, str) or not sub:
        raise LoginError("No validated ID token in the response")
    return sub
