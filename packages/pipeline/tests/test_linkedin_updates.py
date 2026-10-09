"""Tests for LinkedIn application updates, ignored templates, template variants,
and the HTML reader.

Fixtures are modeled on real mails and contain no personal data: the owner's
applications are "Example Role E/F" with job ids 1000000005/6, other postings
use ids 44000000xx, and people are "Example Person".
"""

from datetime import date
from pathlib import Path

import pytest

from tracemail_pipeline.parse.base import (
    ActionType,
    Outcome,
    ParsedMessage,
    SightingContext,
    SourceMessage,
    UpdateType,
)
from tracemail_pipeline.parse.parse_mail import source_message
from tracemail_pipeline.parse.parsers.linkedin.html import read_html
from tracemail_pipeline.parse.registry import parse_message

FIXTURES = Path(__file__).parent / "fixtures" / "linkedin"
RECEIVED = date(2026, 10, 1)


def message(name: str, received: date = RECEIVED) -> SourceMessage:
    raw = (FIXTURES / f"{name}.eml").read_bytes()
    return source_message("raw/mail/test.eml", received, raw)


def parse(source: SourceMessage) -> ParsedMessage:
    outcome, parsed = parse_message(source)
    assert outcome.outcome == Outcome.PARSED, outcome.reason
    assert parsed is not None
    return parsed


def test_rejection_yields_one_update_for_the_applied_job() -> None:
    parsed = parse(message("linkedin_application_rejected"))
    [update] = parsed.updates
    assert update.update_type == UpdateType.REJECTION
    assert (update.job_id, update.title, update.company, update.location) == (
        "1000000005",
        "Example Role E",
        "Example Company E",
        "Sarıyer, İstanbul, Türkiye",
    )
    assert update.applied_on == date(2026, 9, 2)
    assert (parsed.sightings, parsed.actions) == ([], [])


def test_application_viewed_takes_the_first_job_link_not_similar_postings() -> None:
    [update] = parse(message("linkedin_application_viewed")).updates
    assert update.update_type == UpdateType.APPLICATION_VIEWED
    assert (update.job_id, update.company, update.location) == (
        "1000000006",
        "Example Company F",
        "Türkiye",
    )
    assert update.applied_on == date(2026, 9, 19)


def test_applied_date_after_the_mail_month_belongs_to_the_previous_year() -> None:
    source = message("linkedin_application_rejected", received=date(2027, 1, 5))
    [update] = parse(source).updates
    assert update.applied_on == date(2026, 9, 2)


def test_update_outcome_counts_the_update() -> None:
    outcome, _ = parse_message(message("linkedin_application_rejected"))
    assert (outcome.sightings, outcome.actions, outcome.updates) == (0, 0, 1)


@pytest.mark.parametrize(
    ("old", "new", "reason"),
    [
        ("tarihinde başvuruldu", "tarihinde gönderildi", "Applied-on line not found"),
        ("2 Eyl tarihinde", "2 Sep tarihinde", "Unknown month abbreviation: Sep"),
        ("/comm/jobs/view/", "/comm/jobs/show/", "Application card is incomplete"),
    ],
)
def test_changed_update_template_fails_instead_of_producing_data(
    old: str, new: str, reason: str
) -> None:
    source = message("linkedin_application_rejected")
    assert source.html is not None and old in source.html
    changed = source.model_copy(update={"html": source.html.replace(old, new)})
    outcome, parsed = parse_message(changed)
    assert (outcome.outcome, outcome.reason, parsed) == (Outcome.FAILED, reason, None)


def test_update_without_html_part_fails() -> None:
    source = message("linkedin_application_rejected").model_copy(update={"html": None})
    outcome, _ = parse_message(source)
    assert (outcome.outcome, outcome.reason) == (
        Outcome.FAILED,
        "Message has no HTML part",
    )


def test_alert_created_confirmation_is_recognized_and_records_nothing() -> None:
    parsed = parse(message("linkedin_job_alert_confirmation"))
    assert parsed.template == "email_email_job_alert_confirmation_01"
    assert (parsed.sightings, parsed.actions, parsed.updates) == ([], [], [])


def test_facet_suggestions_featured_posting_before_any_facet_has_no_facet() -> None:
    parsed = parse(message("linkedin_facet_suggestions_featured"))
    assert [(s.job_id, s.context_value) for s in parsed.sightings] == [
        ("4400000004", None),
        ("4400000005", "Uzaktan"),
    ]
    assert {s.context for s in parsed.sightings} == {SightingContext.SUGGESTED}


def test_alert_cards_from_other_alerts_have_no_query_and_correct_fields() -> None:
    parsed = parse(message("linkedin_job_alert_other_alerts"))
    first, other = parsed.sightings
    assert first.context_value == "Example Query - İstanbul"
    assert other.context_value is None
    assert (other.title, other.company, other.location) == (
        "Example Role K",
        "Example Company K",
        "İstanbul",
    )
    assert other.unrecognized_lines == []


def test_saved_reminder_contacts_are_not_card_content() -> None:
    parsed = parse(message("linkedin_saved_job_reminder_contacts"))
    other = parsed.sightings[1]
    assert (other.title, other.company, other.location) == (
        "Example Role M",
        "Example Company M",
        "İstanbul, Türkiye",
    )
    assert other.unrecognized_lines == []
    assert [(a.job_id, a.action) for a in parsed.actions] == [
        ("1000000007", ActionType.SAVED),
        ("1000000008", ActionType.SAVED),
    ]


def test_html_reader_skips_hidden_text_and_invisible_padding() -> None:
    html = (
        "<html><head><style>p { color: red; }</style></head><body>"
        "<div>͏ ͏ </div><script>var x = 1;</script>"
        "<p>  Visible   line </p></body></html>"
    )
    assert read_html(html).lines == ["Visible line"]


def test_html_reader_lists_job_ids_once_in_document_order() -> None:
    html = (
        '<a href="https://www.linkedin.com/comm/jobs/view/2/?x=1">a</a>'
        '<a href="https://www.linkedin.com/comm/jobs/view/1/">b</a>'
        '<a href="https://www.linkedin.com/comm/jobs/view/2/">c</a>'
        '<a href="https://www.linkedin.com/redacted">d</a><a>e</a>'
    )
    assert read_html(html).job_ids == ["2", "1"]
