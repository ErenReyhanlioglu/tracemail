"""In-process cache for mart query results.

Mart tables change only when dbt rebuilds them, so a list is re-read only
when its key changes: the source table's last-modified time (a metadata
call, not billed) and, for date-dependent values, the owner's local date.
No Redis (CLAUDE.md, API).
"""

from collections.abc import Awaitable, Callable, Hashable


class MartCache[T]:
    """The last rows read, and the key they were read at."""

    def __init__(self) -> None:
        self._key: Hashable | None = None
        self._rows: list[T] = []

    async def rows(
        self, key: Hashable, load: Callable[[], Awaitable[list[T]]]
    ) -> list[T]:
        """The cached rows, or freshly loaded ones if the key changed."""
        if key != self._key:
            self._rows = await load()
            self._key = key
        return self._rows
