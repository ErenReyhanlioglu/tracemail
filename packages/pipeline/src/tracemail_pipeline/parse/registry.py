"""Routes a message to the parser that claims it and records the outcome.

A message no parser claims is ``unclaimed`` (the "other" bucket). A claimed
message that does not parse is ``failed`` with a reason; one bad message never
stops the run (CLAUDE.md, Error Handling).
"""

from collections.abc import Sequence

from tracemail_pipeline.parse.base import (
    MessageParseOutcome,
    Outcome,
    ParsedMessage,
    ParseError,
    Parser,
    SourceMessage,
)
from tracemail_pipeline.parse.parsers.linkedin.parser import LinkedInParser

PARSERS: tuple[Parser, ...] = (LinkedInParser(),)


def parse_message(
    message: SourceMessage, parsers: Sequence[Parser] = PARSERS
) -> tuple[MessageParseOutcome, ParsedMessage | None]:
    """Parse one message with the first parser that claims it."""
    outcome = MessageParseOutcome(
        source_key=message.source_key,
        received_date=message.received_date,
        outcome=Outcome.UNCLAIMED,
    )
    parser = next((p for p in parsers if p.claims(message)), None)
    if parser is None:
        return outcome, None
    outcome.parser_name, outcome.parser_version = parser.name, parser.version
    try:
        parsed = parser.parse(message)
    except ParseError as e:
        outcome.outcome, outcome.reason = Outcome.FAILED, str(e)
        return outcome, None
    outcome.outcome = Outcome.PARSED
    outcome.template = parsed.template
    outcome.sightings, outcome.actions = len(parsed.sightings), len(parsed.actions)
    outcome.updates = len(parsed.updates)
    return outcome, parsed
