"""Application updates: an employer viewed or rejected one of the owner's
applications (ADR-0024).

Both templates show the application as one card in the HTML part: the title,
"company · location", and "<day> <month> tarihinde başvuruldu". The card's
job link is the first job link in the mail (verified on every sample in the
90-day raw zone); the similar postings below it are not recorded. The applied
date has no year: it is the latest such date not after the mail's date.
"""

import re
from datetime import date

from tracemail_pipeline.parse.base import (
    ApplicationUpdate,
    ParseError,
    RecordOrigin,
    UpdateType,
)
from tracemail_pipeline.parse.parsers.linkedin import phrases
from tracemail_pipeline.parse.parsers.linkedin.html import read_html

UPDATE_TEMPLATES: dict[str, UpdateType] = {
    "email_email_jobs_job_application_viewed_01": UpdateType.APPLICATION_VIEWED,
    "email_email_jobs_application_rejected_01": UpdateType.REJECTION,
}
COMPANY_SEPARATOR = " · "
# The applied-on line is preceded by the title and the company line.
CARD_LINES_BEFORE_DATE = 2


def interpret_update(
    origin: RecordOrigin, html: str | None, update: UpdateType
) -> ApplicationUpdate:
    """Read the one application card of an update mail."""
    if html is None:
        raise ParseError("Message has no HTML part")
    document = read_html(html)
    index, applied = _applied_on_line(document.lines)
    if index < CARD_LINES_BEFORE_DATE or not document.job_ids:
        raise ParseError("Application card is incomplete")
    title, company_line = document.lines[index - CARD_LINES_BEFORE_DATE : index]
    company, _, location = company_line.partition(COMPANY_SEPARATOR)
    return ApplicationUpdate(
        **origin.model_dump(),
        job_id=document.job_ids[0],
        update_type=update,
        applied_on=_applied_on(applied, origin.received_date),
        title=title,
        company=company,
        location=location or None,
    )


def _applied_on_line(lines: list[str]) -> tuple[int, re.Match[str]]:
    for index, line in enumerate(lines):
        match = phrases.APPLIED_ON_SHORT.match(line)
        if match is not None:
            return index, match
    raise ParseError("Applied-on line not found")


def _applied_on(match: re.Match[str], received: date) -> date:
    month = phrases.MONTH_ABBREVIATIONS.get(match["month"])
    if month is None:
        raise ParseError(f"Unknown month abbreviation: {match['month']}")
    year = received.year if month <= received.month else received.year - 1
    return date(year, month, int(match["day"]))
