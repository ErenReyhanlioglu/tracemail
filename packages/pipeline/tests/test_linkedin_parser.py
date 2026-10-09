"""Tests for the LinkedIn parser against redacted real samples.

Fixtures are real LinkedIn mails with personal data removed and the owner's
own applied/saved/viewed jobs replaced by neutral values ("Example Role A",
job id 1000000001, ...). Only the plain-text part is kept.
"""

from datetime import date
from pathlib import Path

import pytest

from tracemail_pipeline.parse.base import (
    ActionType,
    MessageParseOutcome,
    Outcome,
    ParsedMessage,
    SightingContext,
    SourceMessage,
)
from tracemail_pipeline.parse.parse_mail import source_message
from tracemail_pipeline.parse.registry import parse_message

FIXTURES = Path(__file__).parent / "fixtures" / "linkedin"
RECEIVED = date(2026, 10, 1)
ALERT_PAGE = "email_email_job_alert_digest_01"


def fixture_bytes(name: str) -> bytes:
    return (FIXTURES / f"{name}.eml").read_bytes()


def parse_bytes(raw: bytes) -> tuple[MessageParseOutcome, ParsedMessage | None]:
    return parse_message(source_message("raw/mail/test.eml", RECEIVED, raw))


def alert_message() -> SourceMessage:
    return source_message(
        "raw/mail/test.eml", RECEIVED, fixture_bytes("linkedin_job_alert")
    )


def parse_fixture(name: str) -> ParsedMessage:
    outcome, parsed = parse_bytes(fixture_bytes(name))
    assert outcome.outcome == Outcome.PARSED, outcome.reason
    assert parsed is not None
    return parsed


def test_job_alert_yields_one_sighting_per_card_with_the_alert_query() -> None:
    parsed = parse_fixture("linkedin_job_alert")
    assert parsed.template == ALERT_PAGE
    assert len(parsed.sightings) == 4
    assert parsed.actions == []
    first = parsed.sightings[0]
    assert (first.job_id, first.title, first.company, first.location) == (
        "4471256693",
        "AI Process Forward Deployed Engineer",
        "Jobgether",
        "Türkiye",
    )
    assert first.context == SightingContext.ALERT
    assert first.context_value == "Generative AI Engineer - Türkiye"
    assert first.flags == ["easy_apply"]


def test_job_alert_reads_actively_hiring_flag_after_a_blank_line() -> None:
    third = parse_fixture("linkedin_job_alert").sightings[2]
    assert third.location == "Maltepe"
    assert third.flags == ["actively_hiring", "easy_apply"]


def test_confirmation_yields_one_application_and_keeps_similar_jobs_as_sightings() -> (
    None
):
    parsed = parse_fixture("linkedin_application_confirmation")
    [applied] = parsed.actions
    assert applied.action == ActionType.APPLIED
    assert (applied.job_id, applied.action_date) == ("1000000001", date(2026, 10, 1))
    contexts = [s.context for s in parsed.sightings]
    assert contexts[0] == SightingContext.APPLIED
    assert contexts[1:] == [SightingContext.SIMILAR_TO_APPLIED] * (len(contexts) - 1)
    assert all(s.related_job_id == "1000000001" for s in parsed.sightings[1:])


def test_confirmation_normalizes_repeated_spaces_in_card_lines() -> None:
    similar = parse_fixture("linkedin_application_confirmation").sightings[1]
    assert similar.title == "Smart Start Digital Image Processing Engineer"
    assert similar.company == "Bosch Africa"


def test_viewed_reminder_records_the_viewed_job_and_similar_sightings() -> None:
    parsed = parse_fixture("linkedin_viewed_job_reminder")
    [viewed] = parsed.actions
    assert (viewed.action, viewed.job_id, viewed.title) == (
        ActionType.VIEWED,
        "1000000005",
        "Example Role E",
    )
    assert len(parsed.sightings) == 9
    assert {s.context for s in parsed.sightings} == {SightingContext.SIMILAR_TO_VIEWED}


def test_saved_reminder_records_every_card_as_saved_with_social_counts() -> None:
    parsed = parse_fixture("linkedin_saved_job_reminder")
    assert [a.job_id for a in parsed.actions] == [
        "1000000002",
        "1000000003",
        "1000000004",
        "1000000001",
    ]
    assert {a.action for a in parsed.actions} == {ActionType.SAVED}
    assert (parsed.sightings[1].connections, parsed.sightings[2].alumni) == (1, 21)


def test_facet_suggestions_carry_each_facet_to_the_cards_below_it() -> None:
    parsed = parse_fixture("linkedin_facet_suggestions")
    assert [s.context_value for s in parsed.sightings] == [
        "Uzaktan",
        "Uzaktan",
        "AI/ML",
        "AI/ML",
    ]
    assert parsed.sightings[0].flags == ["top_applicant", "easy_apply"]
    assert parsed.sightings[1].flags == ["fast_growing"]


def test_every_record_carries_parser_provenance() -> None:
    parsed = parse_fixture("linkedin_saved_job_reminder")
    records = [*parsed.sightings, *parsed.actions]
    assert {(r.parser_name, r.parser_version) for r in records} == {("linkedin", "3")}


@pytest.mark.parametrize(
    "intro",
    [
        "Tercihlerinizle eşleşen yeni iş ilanları var.",
        "Tercihlerinizle eşleşen yeni bir iş ilanı var.",
        "Tercihlerinizle eşleşen 11 yeni iş ilanı var.",
    ],
)
def test_alert_intro_variants_are_headers_not_card_titles(intro: str) -> None:
    message = alert_message()
    assert message.plain_text is not None
    text = message.plain_text.replace(
        "Tercihlerinizle eşleşen yeni iş ilanları var.", intro
    )
    outcome, parsed = parse_message(message.model_copy(update={"plain_text": text}))
    assert parsed is not None, outcome.reason
    first = parsed.sightings[0]
    assert (first.title, first.company, first.location) == (
        "AI Process Forward Deployed Engineer",
        "Jobgether",
        "Türkiye",
    )
    assert first.unrecognized_lines == []


def test_changed_template_version_fails_instead_of_producing_data() -> None:
    message = alert_message()
    assert message.plain_text is not None
    assert ALERT_PAGE in message.plain_text
    text = message.plain_text.replace(ALERT_PAGE, ALERT_PAGE.replace("_01", "_02"))
    outcome, parsed = parse_message(message.model_copy(update={"plain_text": text}))
    assert outcome.outcome == Outcome.FAILED
    assert outcome.reason is not None and "Unknown LinkedIn template" in outcome.reason
    assert parsed is None


def test_missing_section_header_fails_instead_of_producing_data() -> None:
    message = alert_message()
    assert message.plain_text is not None
    text = message.plain_text.replace("iş ilanı uyarınız", "iş ilanı bildirimi")
    outcome, _ = parse_message(message.model_copy(update={"plain_text": text}))
    assert outcome.outcome == Outcome.FAILED


def test_unknown_card_line_is_kept_without_shifting_core_fields() -> None:
    message = alert_message()
    assert message.plain_text is not None
    text = message.plain_text.replace(
        "Jobgether\nTürkiye\n", "Jobgether\nTürkiye\nYepyeni bir etiket\n", 1
    )
    outcome, parsed = parse_message(message.model_copy(update={"plain_text": text}))
    assert parsed is not None, outcome.reason
    first = parsed.sightings[0]
    assert (first.company, first.location) == ("Jobgether", "Türkiye")
    assert first.unrecognized_lines == ["Yepyeni bir etiket"]


def test_card_with_too_few_lines_fails() -> None:
    message = alert_message()
    assert message.plain_text is not None
    text = message.plain_text.replace("Jobgether\nTürkiye\n", "", 1)
    outcome, _ = parse_message(message.model_copy(update={"plain_text": text}))
    assert outcome.outcome == Outcome.FAILED


def test_message_without_plain_text_fails() -> None:
    outcome, _ = parse_message(alert_message().model_copy(update={"plain_text": None}))
    assert (outcome.outcome, outcome.reason) == (
        Outcome.FAILED,
        "Message has no plain-text part",
    )


@pytest.mark.parametrize(
    "sender", ["Recruiter <hr@company.example>", "LinkedIn <x@linkedin.com.evil.test>"]
)
def test_non_linkedin_sender_is_unclaimed(sender: str) -> None:
    message = alert_message().model_copy(update={"from_header": sender})
    outcome, parsed = parse_message(message)
    assert (outcome.outcome, parsed) == (Outcome.UNCLAIMED, None)
