"""Free-text search over a list's title and company (ADR-0042).

Matching ignores case and Turkish letters: accents are dropped and dotless
and dotted i are both plain ``i``, so "basvuru" finds "Başvuru", "istanbul"
finds "İstanbul", and "ai" finds "AI". Every word of the query must appear.
The web app applies the same rule to the application list
(``apps/web/src/lib/search.ts``); the two must stay in step.
"""

import unicodedata

MAX_QUERY_LENGTH = 100


def fold(text: str) -> str:
    """Lower-case ``text`` without accents, with every i the same."""
    decomposed = unicodedata.normalize("NFKD", text)
    bare = "".join(char for char in decomposed if not unicodedata.combining(char))
    return bare.lower().replace("ı", "i")


def matches(query: str | None, *fields: str | None) -> bool:
    """Whether every word of ``query`` appears in one of ``fields``."""
    words = fold(query or "").split()
    haystack = fold(" ".join(field for field in fields if field))
    return all(word in haystack for word in words)
