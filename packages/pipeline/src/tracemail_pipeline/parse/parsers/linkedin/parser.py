"""LinkedIn job-mail parser: detect the template, read cards, interpret them.

Card templates use the plain-text part. Their HTML part carries one extra
field (work mode: remote / hybrid / on-site) that the owner chose not to
track; it stays in the raw zone and can be added later by replaying from raw.
Application updates exist only in the HTML part (``updates``). Some templates
are recognized and deliberately produce no records (``IGNORED_TEMPLATES``).
"""

import re
from email.utils import parseaddr
from urllib.parse import unquote

from tracemail_pipeline.parse.base import (
    ParsedMessage,
    ParseError,
    RecordOrigin,
    SourceMessage,
)
from tracemail_pipeline.parse.parsers.linkedin.cards import read_cards
from tracemail_pipeline.parse.parsers.linkedin.templates import (
    IGNORED_TEMPLATES,
    TEMPLATES,
)
from tracemail_pipeline.parse.parsers.linkedin.updates import (
    UPDATE_TEMPLATES,
    interpret_update,
)

PARSER_NAME = "linkedin"
PARSER_VERSION = "3"
SENDER_DOMAIN = "linkedin.com"
PAGE_ID = re.compile(r"urn:li:page:(?P<page>[a-z0-9_]+)")


class LinkedInParser:
    """Parses every LinkedIn template listed in ``templates.TEMPLATES``."""

    name = PARSER_NAME
    version = PARSER_VERSION

    def claims(self, message: SourceMessage) -> bool:
        """Claim every message sent from a linkedin.com address."""
        address = parseaddr(message.from_header)[1].lower()
        return address.endswith(f"@{SENDER_DOMAIN}")

    def parse(self, message: SourceMessage) -> ParsedMessage:
        """Extract sightings, actions, and application updates; raise
        ``ParseError`` if the message does not have the structure its template
        requires."""
        if message.plain_text is None:
            raise ParseError("Message has no plain-text part")
        template = detect_template(message.plain_text)
        origin = RecordOrigin(
            source_key=message.source_key,
            received_date=message.received_date,
            parser_name=self.name,
            parser_version=self.version,
            template=template,
        )
        if template in IGNORED_TEMPLATES:
            return ParsedMessage(template=template)
        update = UPDATE_TEMPLATES.get(template)
        if update is not None:
            record = interpret_update(origin, message.html, update)
            return ParsedMessage(template=template, updates=[record])
        spec = TEMPLATES.get(template)
        if spec is None:
            raise ParseError(f"Unknown LinkedIn template: {template}")
        cards = read_cards(message.plain_text, spec.headers)
        sightings, actions = spec.interpret(origin, cards)
        return ParsedMessage(template=template, sightings=sightings, actions=actions)


def detect_template(plain_text: str) -> str:
    """Return the single LinkedIn page id used throughout the message."""
    pages = {match["page"] for match in PAGE_ID.finditer(unquote(plain_text))}
    if len(pages) != 1:
        raise ParseError(f"Expected one LinkedIn template id, found {len(pages)}")
    return pages.pop()
