"""Visible text and job links of a LinkedIn mail's HTML part.

Application updates (an employer viewed or rejected an application) carry
their content only in the HTML part; the plain-text part holds just the
footer. This reader turns the HTML into its visible text lines, in document
order, the job ids of its job links, in order of first appearance, and the
visible text of each job link. Card templates use that link text to tell a
title the plain-text part wrapped over several lines from the lines below it.
"""

import re
from html.parser import HTMLParser
from urllib.parse import unquote

from pydantic import BaseModel

JOB_LINK = re.compile(r"/comm/jobs/view/(?P<job_id>\d+)")
# Elements whose text is never visible.
HIDDEN_TAGS = frozenset({"head", "script", "style"})
# Invisible padding LinkedIn puts in preheaders (not whitespace to ``split``).
INVISIBLE = str.maketrans("", "", "͏​‌­")


class HtmlDocument(BaseModel):
    """What a parser needs from an HTML part."""

    lines: list[str]
    job_ids: list[str]
    link_texts: dict[str, list[str]]


class _Collector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.lines: list[str] = []
        self.job_ids: list[str] = []
        self.link_texts: dict[str, list[str]] = {}
        self._hidden_depth = 0
        # Open links, innermost last: (job id or None, collected text parts).
        self._links: list[tuple[str | None, list[str]]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in HIDDEN_TAGS:
            self._hidden_depth += 1
        elif tag == "a":
            match = JOB_LINK.search(unquote(dict(attrs).get("href") or ""))
            job_id = None if match is None else match["job_id"]
            if job_id is not None and job_id not in self.job_ids:
                self.job_ids.append(job_id)
            self._links.append((job_id, []))

    def handle_endtag(self, tag: str) -> None:
        if tag in HIDDEN_TAGS and self._hidden_depth > 0:
            self._hidden_depth -= 1
        elif tag == "a" and self._links:
            job_id, parts = self._links.pop()
            if job_id is not None and parts:
                self.link_texts.setdefault(job_id, []).append(" ".join(parts))

    def handle_data(self, data: str) -> None:
        line = " ".join(data.translate(INVISIBLE).split())
        if line and self._hidden_depth == 0:
            self.lines.append(line)
            if self._links:
                self._links[-1][1].append(line)


def read_html(html: str) -> HtmlDocument:
    """Return the visible text lines, job ids, and job link texts of an HTML
    part."""
    collector = _Collector()
    collector.feed(html)
    collector.close()
    return HtmlDocument(
        lines=collector.lines,
        job_ids=collector.job_ids,
        link_texts=collector.link_texts,
    )
