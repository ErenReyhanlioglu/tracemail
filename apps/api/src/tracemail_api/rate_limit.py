"""In-process rate limiting for the public endpoints (CLAUDE.md, API).

A fixed one-minute window per client. The client is the visitor's address
as Cloudflare reports it in ``CF-Connecting-IP``, which Cloudflare sets on
every request through the tunnel; the web server forwards it when it calls
the API on a visitor's behalf. Requests without it (inside the Compose
network) share the peer address. One process, so no Redis.
"""

from fastapi import Request

WINDOW_SECONDS = 60
CLIENT_IP_HEADER = "cf-connecting-ip"
UNKNOWN_CLIENT = "unknown"


class RateLimiter:
    """Counts requests per client in the current window."""

    def __init__(self, limit: int) -> None:
        self._limit = limit
        self._window = -1
        self._counts: dict[str, int] = {}

    def allow(self, client: str, now: float) -> bool:
        """Count one request; False once the client is over the limit."""
        window = int(now // WINDOW_SECONDS)
        if window != self._window:
            self._window = window
            self._counts.clear()
        count = self._counts.get(client, 0) + 1
        self._counts[client] = count
        return count <= self._limit


def client_key(request: Request) -> str:
    """The visitor's address, or the peer's without Cloudflare's header."""
    forwarded = request.headers.get(CLIENT_IP_HEADER)
    if forwarded:
        return forwarded
    return request.client.host if request.client else UNKNOWN_CLIENT
