import pytest
from pydantic import ValidationError

from app.schemas import AnalysisMeta, AnalysisResult, DocumentInfo, LlmAnalysis
from tests.helpers import VALID_ANALYSIS, analysis


def test_valid_analysis_is_accepted() -> None:
    result = LlmAnalysis.model_validate(VALID_ANALYSIS)

    assert result.document.type == "umowa"
    assert result.amounts[0].value == 12500.0
    assert result.dates[0].date == "2026-10-01"


def test_normalizes_language_type_currency_and_blank_values() -> None:
    result = LlmAnalysis.model_validate(
        analysis(
            document={"language": "PL-pl", "type": "Contract", "title": "  ", "date": ""},
            amounts=[
                {"value": 10, "currency": "zł", "context": "opłata"},
                {"value": 2150, "currency": "€", "context": " "},
                {"value": 5, "currency": None, "context": None},
            ],
        )
    )

    assert result.document.language == "pl"
    assert result.document.type == "umowa"
    assert result.document.title is None
    assert result.document.date is None
    assert [a.currency for a in result.amounts] == ["PLN", "EUR", None]
    assert result.amounts[1].context is None


@pytest.mark.parametrize(
    "overrides",
    [
        {"document": {"language": "pl", "type": "memo", "title": None, "date": None}},
        {"document": {"language": "polish", "type": "umowa", "title": None, "date": None}},
        {"document": {"language": "pl", "type": "umowa", "title": None, "date": "01.09.2026"}},
        {"dates": [{"date": "2026-02-30", "context": "nie istnieje"}]},
        {"dates": [{"date": "2026-10", "context": "niepełna data"}]},
        {"amounts": [{"value": 1, "currency": "PLNN", "context": None}]},
        {"amounts": [{"value": "184 500,00", "currency": "PLN", "context": None}]},
        {"amounts": [{"value": float("nan"), "currency": "PLN", "context": None}]},
        {"keyPoints": ["tylko", "dwa"]},
        {"keyPoints": [f"punkt {i}" for i in range(8)]},
        {"summary": "Za krótko."},
    ],
)
def test_rejects_values_that_break_the_schema(overrides: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        LlmAnalysis.model_validate(analysis(**overrides))


def test_missing_lists_default_to_empty() -> None:
    result = LlmAnalysis.model_validate(
        {
            "document": {"language": "en", "type": "inne", "title": None, "date": None},
            "summary": "A short note without any amounts or dates in it.",
            "keyPoints": ["One", "Two", "Three"],
        }
    )

    assert result.entities.organizations == []
    assert result.entities.people == []
    assert result.amounts == []
    assert result.dates == []
    assert result.keywords == []


def test_entities_and_keywords_are_deduplicated() -> None:
    result = LlmAnalysis.model_validate(
        analysis(
            entities={"organizations": ["ACME  S.A.", "acme s.a.", ""], "people": []},
            keywords=["SLA", "sla", "serwis"],
        )
    )

    assert result.entities.organizations == ["ACME S.A."]
    assert result.keywords == ["SLA", "serwis"]


def test_result_serializes_with_camel_case_keys() -> None:
    parsed = LlmAnalysis.model_validate(VALID_ANALYSIS)
    result = AnalysisResult(
        document=DocumentInfo(
            file_name="umowa.pdf",
            pages=4,
            language=parsed.document.language,
            type=parsed.document.type,
            title=parsed.document.title,
            date=parsed.document.date,
        ),
        summary=parsed.summary,
        key_points=parsed.key_points,
        entities=parsed.entities,
        amounts=parsed.amounts,
        dates=parsed.dates,
        keywords=parsed.keywords,
        meta=AnalysisMeta(
            model="m", chunks=1, ocr_pages=[], truncated=False, warnings=[], processing_ms=1
        ),
    )

    dumped = result.model_dump()

    assert list(dumped) == [
        "document",
        "summary",
        "keyPoints",
        "entities",
        "amounts",
        "dates",
        "keywords",
        "meta",
    ]
    assert dumped["document"]["fileName"] == "umowa.pdf"
    assert "ocrPages" in dumped["meta"]
