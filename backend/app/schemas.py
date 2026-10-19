import datetime as dt
import re
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, BeforeValidator, ConfigDict, Field
from pydantic.alias_generators import to_camel

DocumentType = Literal["faktura", "umowa", "oferta", "raport", "inne"]

_TYPE_SYNONYMS = {
    "invoice": "faktura",
    "contract": "umowa",
    "agreement": "umowa",
    "offer": "oferta",
    "quote": "oferta",
    "quotation": "oferta",
    "proposal": "oferta",
    "report": "raport",
    "other": "inne",
}
_CURRENCY_SYNONYMS = {"ZŁ": "PLN", "ZL": "PLN", "€": "EUR", "$": "USD", "£": "GBP"}
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_CURRENCY = re.compile(r"^[A-Z]{3}$")
_LANGUAGE = re.compile(r"^[a-z]{2}$")


def unique_strings(values: list[str]) -> list[str]:
    """Collapse whitespace and drop empty and case-insensitive duplicate entries."""
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        text = " ".join(value.split())
        key = text.casefold()
        if text and key not in seen:
            seen.add(key)
            result.append(text)
    return result


def _blank_to_none(value: object) -> object:
    if isinstance(value, str):
        return value.strip() or None
    return value


def _check_iso_date(value: str) -> str:
    if not _ISO_DATE.match(value):
        raise ValueError("expected a date in YYYY-MM-DD format")
    dt.date.fromisoformat(value)
    return value


def _normalize_language(value: object) -> object:
    if isinstance(value, str):
        return re.split(r"[-_]", value.strip().lower(), maxsplit=1)[0] or None
    return value


def _check_language(value: str | None) -> str | None:
    if value is not None and not _LANGUAGE.match(value):
        raise ValueError("expected an ISO 639-1 language code, e.g. 'pl'")
    return value


def _normalize_type(value: object) -> object:
    if isinstance(value, str):
        key = value.strip().lower()
        return _TYPE_SYNONYMS.get(key, key)
    return value


def _normalize_currency(value: object) -> object:
    if isinstance(value, str):
        code = value.strip().upper()
        return _CURRENCY_SYNONYMS.get(code, code) or None
    return value


def _check_currency(value: str | None) -> str | None:
    if value is not None and not _CURRENCY.match(value):
        raise ValueError("expected an ISO 4217 currency code, e.g. 'PLN'")
    return value


IsoDate = Annotated[str, AfterValidator(_check_iso_date)]
OptionalIsoDate = Annotated[IsoDate | None, BeforeValidator(_blank_to_none)]
OptionalText = Annotated[str | None, BeforeValidator(_blank_to_none)]
Language = Annotated[
    str | None, BeforeValidator(_normalize_language), AfterValidator(_check_language)
]
DocType = Annotated[DocumentType, BeforeValidator(_normalize_type)]
Currency = Annotated[
    str | None, BeforeValidator(_normalize_currency), AfterValidator(_check_currency)
]
ShortText = Annotated[str, Field(min_length=1, max_length=500)]
NameList = Annotated[list[Annotated[str, Field(max_length=300)]], AfterValidator(unique_strings)]


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        validate_by_name=True,
        validate_by_alias=True,
        serialize_by_alias=True,
        str_strip_whitespace=True,
    )


class LlmDocument(CamelModel):
    language: Language = None
    type: DocType
    title: OptionalText = Field(default=None, max_length=300)
    date: OptionalIsoDate = None


class Entities(CamelModel):
    organizations: NameList = Field(default_factory=list, max_length=50)
    people: NameList = Field(default_factory=list, max_length=50)


class Amount(CamelModel):
    value: float = Field(allow_inf_nan=False)
    currency: Currency = None
    context: OptionalText = Field(default=None, max_length=300)


class DateItem(CamelModel):
    date: IsoDate
    context: OptionalText = Field(default=None, max_length=300)


class LlmOverview(CamelModel):
    """Document-level fields the model writes (also the output of the chunk merge step)."""

    document: LlmDocument
    summary: str = Field(min_length=20, max_length=3000)
    key_points: list[ShortText] = Field(min_length=3, max_length=7)
    keywords: NameList = Field(default_factory=list, max_length=20)


class LlmAnalysis(LlmOverview):
    entities: Entities = Field(default_factory=Entities)
    amounts: list[Amount] = Field(default_factory=list, max_length=100)
    dates: list[DateItem] = Field(default_factory=list, max_length=100)


class DocumentInfo(CamelModel):
    file_name: str
    pages: int = Field(ge=1)
    language: Language = None
    type: DocType
    title: OptionalText = None
    date: OptionalIsoDate = None


NoticeCode = Literal["PROMPT_INJECTION", "UNREAD_PAGES", "TRUNCATED"]
TargetLanguage = Literal["pl", "en"]


class Notice(CamelModel):
    """Machine-readable form of a warning, so the interface can show it in its own language."""

    code: NoticeCode
    pages: list[int] = Field(default_factory=list)
    percent: int | None = None


class AnalysisMeta(CamelModel):
    model: str
    chunks: int
    ocr_pages: list[int]
    truncated: bool
    warnings: list[str]
    notices: list[Notice] = Field(default_factory=list)
    processing_ms: int
    steps_ms: dict[str, int] = Field(default_factory=dict)
    """Duration of each step: extract, ocr, analysis, merge."""


class AnalysisResult(CamelModel):
    document: DocumentInfo
    summary: str
    key_points: list[str]
    entities: Entities
    amounts: list[Amount]
    dates: list[DateItem]
    keywords: list[str]
    meta: AnalysisMeta


class TranslateRequest(CamelModel):
    text: str = Field(min_length=1, max_length=6000)
    target_language: TargetLanguage


class TranslateResponse(CamelModel):
    text: str
    target_language: TargetLanguage


class LlmTranslation(CamelModel):
    text: str = Field(min_length=1, max_length=12000)


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody
