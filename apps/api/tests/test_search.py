"""Tests for free-text matching: case, Turkish letters, and every word."""

import pytest

from tracemail_api.search import fold, matches


@pytest.mark.parametrize(
    ("text", "folded"),
    [
        ("Başvuru", "basvuru"),
        ("İSTANBUL", "istanbul"),
        ("ışık", "isik"),
        ("Göç Üçgeni", "goc ucgeni"),
        ("Lead AI Engineer", "lead ai engineer"),
    ],
)
def test_fold_ignores_case_accents_and_dotted_or_dotless_i(
    text: str, folded: str
) -> None:
    assert fold(text) == folded


def test_matches_needs_every_word_in_any_field() -> None:
    assert matches("lead epam", "Lead AI Engineer", "EPAM Systems")
    assert not matches("lead akbank", "Lead AI Engineer", "EPAM Systems")


def test_matches_turkish_text_typed_without_turkish_letters() -> None:
    assert matches("yapay zeka takim", "Yapay Zeka Takım Lideri", None)


@pytest.mark.parametrize("query", [None, "", "   "])
def test_empty_query_matches_everything(query: str | None) -> None:
    assert matches(query, "Any Title", None)
