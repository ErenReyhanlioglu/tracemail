"""What each LinkedIn template's cards mean.

Templates are identified by LinkedIn's own page id, found in every tracked link
(``urn:li:page:<page id>``). It is language-independent and carries a version
suffix (``_01``), so a redesigned template arrives with a new id and is
reported as unknown instead of being misread.

Adding a template = one ``TemplateSpec`` here, one redacted fixture, one test.
"""

import re
from collections.abc import Callable
from datetime import date

from pydantic import BaseModel, ConfigDict

from tracemail_pipeline.parse.base import (
    ActionType,
    JobAction,
    JobPostingSighting,
    ParseError,
    RecordOrigin,
    SightingContext,
)
from tracemail_pipeline.parse.parsers.linkedin import phrases
from tracemail_pipeline.parse.parsers.linkedin.cards import Card

Records = tuple[list[JobPostingSighting], list[JobAction]]


class TemplateSpec(BaseModel):
    """Section headers of a template and how to interpret its cards."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    headers: tuple[re.Pattern[str], ...]
    interpret: Callable[[RecordOrigin, list[Card]], Records]


def _sighting(
    origin: RecordOrigin,
    position: int,
    card: Card,
    context: SightingContext,
    context_value: str | None = None,
    related_job_id: str | None = None,
) -> JobPostingSighting:
    return JobPostingSighting(
        **origin.model_dump(),
        **card.model_dump(exclude={"headers"}),
        position=position,
        context=context,
        context_value=context_value,
        related_job_id=related_job_id,
    )


def _action(
    origin: RecordOrigin,
    card: Card,
    action: ActionType,
    action_date: date | None = None,
) -> JobAction:
    return JobAction(
        **origin.model_dump(),
        job_id=card.job_id,
        action=action,
        action_date=action_date,
        title=card.title,
        company=card.company,
        location=card.location,
    )


def _header_match(cards: list[Card], pattern: re.Pattern[str]) -> re.Match[str]:
    for card in cards:
        for header in card.headers:
            match = pattern.match(header)
            if match is not None:
                return match
    raise ParseError(f"Expected header not found: {pattern.pattern}")


def _require_cards(cards: list[Card]) -> None:
    if not cards:
        raise ParseError("No job cards found")


def interpret_alert(origin: RecordOrigin, cards: list[Card]) -> Records:
    """Job alert: every card is a posting matching a saved search. Cards in the
    "from your other alerts" section belong to another search, which the mail
    does not name, so their query is left empty."""
    _require_cards(cards)
    query: str | None = _header_match(cards[:1], phrases.ALERT_HEADER)["query"]
    sightings = []
    for i, card in enumerate(cards):
        if any(phrases.OTHER_ALERTS.match(header) for header in card.headers):
            query = None
        sightings.append(
            _sighting(origin, i, card, SightingContext.ALERT, context_value=query)
        )
    return sightings, []


def interpret_confirmation(origin: RecordOrigin, cards: list[Card]) -> Records:
    """Application confirmation: the first card was applied to; the rest are
    postings suggested as similar to it."""
    _require_cards(cards)
    _header_match(cards[:1], phrases.CONFIRMATION_HEADER)
    applied, similar = cards[0], cards[1:]
    applied_on = _parse_turkish_date(_header_match(cards, phrases.APPLIED_ON))
    sightings = [_sighting(origin, 0, applied, SightingContext.APPLIED)] + [
        _sighting(
            origin,
            i,
            card,
            SightingContext.SIMILAR_TO_APPLIED,
            related_job_id=applied.job_id,
        )
        for i, card in enumerate(similar, start=1)
    ]
    return sightings, [_action(origin, applied, ActionType.APPLIED, applied_on)]


def interpret_viewed_reminder(origin: RecordOrigin, cards: list[Card]) -> Records:
    """Viewed-job reminder: the header names a viewed posting; cards are
    postings similar to it."""
    _require_cards(cards)
    header = _header_match(cards[:1], phrases.VIEWED_HEADER)
    viewed = JobAction(
        **origin.model_dump(),
        job_id=header["job_id"],
        action=ActionType.VIEWED,
        title=header["title"],
    )
    sightings = [
        _sighting(
            origin,
            i,
            card,
            SightingContext.SIMILAR_TO_VIEWED,
            related_job_id=viewed.job_id,
        )
        for i, card in enumerate(cards)
    ]
    return sightings, [viewed]


def interpret_saved_reminder(origin: RecordOrigin, cards: list[Card]) -> Records:
    """Saved-job reminder: every card is a posting the owner saved."""
    _require_cards(cards)
    _header_match(cards[:1], phrases.SAVED_HEADER)
    sightings = [
        _sighting(origin, i, card, SightingContext.SAVED)
        for i, card in enumerate(cards)
    ]
    actions = [_action(origin, card, ActionType.SAVED) for card in cards]
    return sightings, actions


def interpret_facet_suggestions(origin: RecordOrigin, cards: list[Card]) -> Records:
    """Suggestions grouped by facet ("Remote", "AI/ML"); a facet header applies
    to every following card until the next one. Some variants open with a
    featured posting before the first facet; it has no facet."""
    _require_cards(cards)
    sightings = []
    facet: str | None = None
    for i, card in enumerate(cards):
        for header in card.headers:
            match = phrases.FACET_SECTION.match(header)
            facet = match["facet"] if match is not None else facet
        sightings.append(
            _sighting(origin, i, card, SightingContext.SUGGESTED, context_value=facet)
        )
    return sightings, []


def _parse_turkish_date(match: re.Match[str]) -> date:
    month = phrases.MONTHS.get(match["month"])
    if month is None:
        raise ParseError(f"Unknown month name: {match['month']}")
    return date(int(match["year"]), month, int(match["day"]))


TEMPLATES: dict[str, TemplateSpec] = {
    "email_email_job_alert_digest_01": TemplateSpec(
        headers=(
            phrases.ALERT_HEADER,
            phrases.ALERT_INTRO,
            phrases.OTHER_ALERTS,
            phrases.OTHER_ALERT_HIGHLIGHT,
        ),
        interpret=interpret_alert,
    ),
    "email_email_application_confirmation_with_nba_01": TemplateSpec(
        headers=(
            phrases.CONFIRMATION_HEADER,
            phrases.APPLIED_ON,
            phrases.NEXT_STEPS,
            phrases.SIMILAR_TO_APPLIED,
        ),
        interpret=interpret_confirmation,
    ),
    "email_email_jobs_viewed_job_reminder_01": TemplateSpec(
        headers=(phrases.VIEWED_HEADER,),
        interpret=interpret_viewed_reminder,
    ),
    "email_email_jobs_saved_job_reminder_01": TemplateSpec(
        headers=(
            phrases.SAVED_HEADER,
            phrases.APPLY_NOW,
            phrases.OTHER_SAVED,
            phrases.CONTACTS_AT_COMPANY,
            phrases.ASK_ABOUT_JOB,
        ),
        interpret=interpret_saved_reminder,
    ),
    "email_email_jobs_facet_suggestions": TemplateSpec(
        headers=(phrases.FACET_INTRO, phrases.FACET_SECTION),
        interpret=interpret_facet_suggestions,
    ),
}

# Templates that are recognized but carry nothing to record: confirmation that
# a job alert was created, and a "looking for a job?" promotion.
IGNORED_TEMPLATES = frozenset(
    {
        "email_email_job_alert_confirmation_01",
        "email_email_jobs_first_time_job_seeker_01",
    }
)
