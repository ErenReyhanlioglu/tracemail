"""Signed session cookies for owner and guest sessions (ADR-0032).

The session is Starlette's signed cookie (``request.session``): readable by
the browser, not modifiable. It holds the role and an absolute expiry set at
login, so the lifetime is fixed when the session starts and never slides.
Private endpoints depend on ``require_private_access``.
"""

from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any

from fastapi import HTTPException, Request, status

ROLE_KEY = "role"
EXPIRES_KEY = "expires_at"


class Role(StrEnum):
    """Roles that hold a session; visitors hold none (ADR-0005)."""

    OWNER = "owner"


def start_session(
    session: dict[str, Any], role: Role, now: datetime, lifetime: timedelta
) -> None:
    """Replace whatever the session held with a new one for ``role``."""
    session.clear()
    session[ROLE_KEY] = role.value
    session[EXPIRES_KEY] = int((now + lifetime).timestamp())


def end_session(session: dict[str, Any]) -> None:
    """Remove everything from the session; the cookie is then deleted."""
    session.clear()


def current_role(session: dict[str, Any], now: datetime) -> Role | None:
    """The session's role, or None if there is none or it has expired."""
    role = session.get(ROLE_KEY)
    expires_at = session.get(EXPIRES_KEY)
    if role not in set(Role) or not isinstance(expires_at, int):
        return None
    if now >= datetime.fromtimestamp(expires_at, UTC):
        end_session(session)
        return None
    return Role(role)


def require_private_access(request: Request) -> Role:
    """Dependency for private endpoints: a valid session, or 401."""
    role = current_role(request.session, datetime.now(UTC))
    if role is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    return role
