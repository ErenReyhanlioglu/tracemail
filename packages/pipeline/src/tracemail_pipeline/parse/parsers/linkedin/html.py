"""Visible text and job links of a LinkedIn mail's HTML part.

Application updates (an employer viewed or rejected an application) carry
their content only in the HTML part; the plain-text part holds just the
footer. This reader turns the HTML into its visible text lines, in document
order, and the job ids of its job links, in order of first appearance.
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


class _Collector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.lines: list[str] = []
        self.job_ids: list[str] = []
        self._hidden_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in HIDDEN_TAGS:
            self._hidden_depth += 1
        elif tag == "a":
            match = JOB_LINK.search(unquote(dict(attrs).get("href") or ""))
            if match is not None and match["job_id"] not in self.job_ids:
                self.job_ids.append(match["job_id"])

    def handle_endtag(self, tag: str) -> None:
        if tag in HIDDEN_TAGS and self._hidden_depth > 0:
            self._hidden_depth -= 1

    def handle_data(self, data: str) -> None:
        line = " ".join(data.translate(INVISIBLE).split())
        if line and self._hidden_depth == 0:
            self.lines.append(line)


def read_html(html: str) -> HtmlDocument:
    """Return the visible text lines and job ids of an HTML part."""
    collector = _Collector()
    collector.feed(html)
    collector.close()
    return HtmlDocument(lines=collector.lines, job_ids=collector.job_ids)
