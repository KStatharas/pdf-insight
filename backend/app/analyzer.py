import asyncio
import logging
import time
from typing import TypeVar

from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from app.chunking import build_chunks
from app.config import Settings
from app.errors import AppError, ai_invalid_response
from app.injection import INJECTION_WARNING, looks_like_prompt_injection
from app.llm import ChatModel, JsonObject, Message, parse_json_object
from app.pdf_extract import PageImage, PageText, extract_pdf
from app.prompts import (
    ANALYSIS_JSON_SCHEMA,
    OVERVIEW_JSON_SCHEMA,
    TRANSLATE_JSON_SCHEMA,
    analysis_messages,
    describe_error,
    merge_messages,
    repair_messages,
    scanned_page_placeholder,
    translate_messages,
)
from app.schemas import (
    Amount,
    AnalysisMeta,
    AnalysisResult,
    DateItem,
    DocumentInfo,
    Entities,
    LlmAnalysis,
    LlmOverview,
    LlmTranslation,
    Notice,
    TargetLanguage,
    unique_strings,
)

logger = logging.getLogger(__name__)

ModelT = TypeVar("ModelT", bound=BaseModel)

_MIN_DOCUMENT_CHARS = 20
_MAX_ENTITIES = 50
_MAX_LIST_ITEMS = 100


class Analyzer:
    """PDF bytes in, validated `AnalysisResult` out: extraction, OCR, chunking, AI, merging."""

    def __init__(self, chat: ChatModel, settings: Settings) -> None:
        self._chat = chat
        self._settings = settings

    async def analyze(self, data: bytes, file_name: str) -> AnalysisResult:
        started = time.perf_counter()
        settings = self._settings
        extracted = await run_in_threadpool(
            extract_pdf,
            data,
            max_pages=settings.max_pages,
            min_text_chars=settings.ocr_min_chars,
            max_ocr_pages=settings.ocr_max_pages if settings.ocr_enabled else 0,
        )

        steps: dict[str, int] = {"extract": _ms_since(started)}
        # Scanned pages are not transcribed in a separate OCR call: their images go into the
        # analysis request itself, which saves a full model round trip (~10-20 s).
        attached = {image.number: image for image in extracted.images}
        pages = [
            PageText(p.number, scanned_page_placeholder(p.number)) if p.number in attached else p
            for p in extracted.pages
        ]
        text_layer = "\n".join(p.text for p in extracted.pages)
        if len(text_layer.strip()) < _MIN_DOCUMENT_CHARS and not attached:
            raise AppError(
                "PDF_NO_TEXT",
                "Nie udało się odczytać tekstu z pliku PDF. Dokument jest pusty "
                "albo jest nieczytelnym skanem.",
                422,
            )

        warnings: list[str] = []
        notices: list[Notice] = []
        unread = [n for n in extracted.scanned_pages if n not in attached]
        if unread:
            warnings.append(
                f"Nie odczytano tekstu ze stron bez warstwy tekstowej: {_page_list(unread)}."
            )
            notices.append(Notice(code="UNREAD_PAGES", pages=unread))
        if looks_like_prompt_injection(text_layer):
            warnings.append(INJECTION_WARNING)
            notices.append(Notice(code="PROMPT_INJECTION"))

        chunks = build_chunks(
            pages, chunk_chars=settings.chunk_chars, max_chunks=settings.max_chunks
        )
        if chunks.truncated:
            percent = round(100 * chunks.used_chars / chunks.total_chars)
            warnings.append(
                "Dokument jest bardzo długi, dlatego przeanalizowano tylko jego początkową "
                f"część (ok. {percent}% treści)."
            )
            notices.append(Notice(code="TRUNCATED", percent=percent))

        total = len(chunks.texts)
        step_started = time.perf_counter()
        partials = list(
            await asyncio.gather(
                *(
                    self._analyze_chunk(text, _images_in(text, attached), i, total)
                    for i, text in enumerate(chunks.texts, 1)
                )
            )
        )
        steps["analysis"] = _ms_since(step_started)
        overview: LlmOverview = partials[0]
        if total > 1:
            step_started = time.perf_counter()
            overview = await self._complete_validated(
                merge_messages(partials), LlmOverview, OVERVIEW_JSON_SCHEMA
            )
            steps["merge"] = _ms_since(step_started)

        processing_ms = round((time.perf_counter() - started) * 1000)
        logger.info(
            "Analysed %s pages (%s chunks, %s OCR pages) in %s ms %s",
            extracted.page_count,
            total,
            len(attached),
            processing_ms,
            steps,
        )
        return AnalysisResult(
            document=DocumentInfo(
                file_name=file_name,
                pages=extracted.page_count,
                language=overview.document.language,
                type=overview.document.type,
                title=overview.document.title,
                date=overview.document.date,
            ),
            summary=overview.summary,
            key_points=overview.key_points,
            entities=_merge_entities(partials),
            amounts=_unique_amounts(partials),
            dates=_unique_dates(partials),
            keywords=overview.keywords,
            meta=AnalysisMeta(
                model=self._chat.name,
                chunks=total,
                ocr_pages=sorted(attached),
                truncated=chunks.truncated,
                warnings=warnings,
                notices=notices,
                processing_ms=processing_ms,
                steps_ms=steps,
            ),
        )

    async def translate(self, text: str, target_language: TargetLanguage) -> str:
        reply = await self._complete_validated(
            translate_messages(text, target_language), LlmTranslation, TRANSLATE_JSON_SCHEMA
        )
        return reply.text

    async def _analyze_chunk(
        self, text: str, images: list[PageImage], part: int, total: int
    ) -> LlmAnalysis:
        return await self._complete_validated(
            analysis_messages(text, part, total, images), LlmAnalysis, ANALYSIS_JSON_SCHEMA
        )

    async def _complete_validated(
        self, messages: list[Message], model: type[ModelT], schema: JsonObject
    ) -> ModelT:
        """Ask the model for JSON and validate it; on an invalid reply, retry exactly once."""
        reply = await self._chat.complete(messages, schema=schema)
        try:
            return model.model_validate(parse_json_object(reply))
        except ValueError as first_error:
            logger.warning("Invalid AI reply, retrying once:\n%s", describe_error(first_error))
            retry_messages = repair_messages(messages, reply, first_error)

        reply = await self._chat.complete(retry_messages, schema=schema)
        try:
            return model.model_validate(parse_json_object(reply))
        except ValueError as error:
            logger.error("Invalid AI reply after retry:\n%s", describe_error(error))
            raise ai_invalid_response() from error


def _merge_entities(parts: list[LlmAnalysis]) -> Entities:
    organizations = unique_strings([o for p in parts for o in p.entities.organizations])
    people = unique_strings([name for p in parts for name in p.entities.people])
    return Entities(organizations=organizations[:_MAX_ENTITIES], people=people[:_MAX_ENTITIES])


def _unique_amounts(parts: list[LlmAnalysis]) -> list[Amount]:
    seen: set[tuple[float, str | None, str]] = set()
    result: list[Amount] = []
    for amount in (a for p in parts for a in p.amounts):
        key = (round(amount.value, 2), amount.currency, (amount.context or "").casefold())
        if key not in seen:
            seen.add(key)
            result.append(amount)
    return result[:_MAX_LIST_ITEMS]


def _unique_dates(parts: list[LlmAnalysis]) -> list[DateItem]:
    seen: set[tuple[str, str]] = set()
    result: list[DateItem] = []
    for item in (d for p in parts for d in p.dates):
        key = (item.date, (item.context or "").casefold())
        if key not in seen:
            seen.add(key)
            result.append(item)
    return result[:_MAX_LIST_ITEMS]


def _images_in(chunk: str, images: dict[int, PageImage]) -> list[PageImage]:
    return [image for number, image in sorted(images.items()) if f"[page {number}]" in chunk]


def _ms_since(start: float) -> int:
    return round((time.perf_counter() - start) * 1000)


def _page_list(numbers: list[int], limit: int = 10) -> str:
    listed = ", ".join(str(n) for n in numbers[:limit])
    return listed + (", …" if len(numbers) > limit else "")
