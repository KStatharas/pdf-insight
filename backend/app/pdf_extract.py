import io
import re
import threading
from dataclasses import dataclass

import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_c

from app.errors import AppError

# pdfium is not thread-safe and FastAPI runs extraction in a thread pool.
_PDFIUM_LOCK = threading.Lock()

_OCR_DPI = 150
_OCR_MAX_SIDE_PX = 2000
_BLANK_LINES = re.compile(r"\n{3,}")
_INVISIBLE_CHARS = str.maketrans("", "", "\x00\x02\ufffe\ufeff")


@dataclass(frozen=True)
class PageText:
    number: int
    text: str


@dataclass(frozen=True)
class PageImage:
    number: int
    jpeg: bytes


@dataclass(frozen=True)
class ExtractedPdf:
    page_count: int
    pages: list[PageText]
    scanned_pages: list[int]
    """1-based numbers of pages that contain images but no usable text layer."""
    images: list[PageImage]
    """Rendered scanned pages (at most `max_ocr_pages`) for OCR."""


def extract_pdf(
    data: bytes, *, max_pages: int, min_text_chars: int, max_ocr_pages: int
) -> ExtractedPdf:
    if b"%PDF-" not in data[:1024]:
        raise AppError("NOT_A_PDF", "Plik nie jest poprawnym dokumentem PDF.", 415)

    with _PDFIUM_LOCK:
        pdf = _open(data)
        try:
            page_count = len(pdf)
            if page_count == 0:
                raise AppError("PDF_UNREADABLE", "Plik PDF nie zawiera żadnych stron.", 422)
            if page_count > max_pages:
                raise AppError(
                    "TOO_MANY_PAGES",
                    f"Dokument jest zbyt długi (liczba stron: {page_count}, limit: {max_pages}).",
                    422,
                )

            pages: list[PageText] = []
            scanned: list[int] = []
            images: list[PageImage] = []
            for index in range(page_count):
                number = index + 1
                page = pdf[index]
                try:
                    text = _page_text(page)
                    if len(text) < min_text_chars and _has_images(page):
                        scanned.append(number)
                        if len(images) < max_ocr_pages:
                            images.append(PageImage(number, _render_jpeg(page)))
                    pages.append(PageText(number, text))
                finally:
                    page.close()
        finally:
            pdf.close()

    return ExtractedPdf(page_count, pages, scanned, images)


def _open(data: bytes) -> pdfium.PdfDocument:
    try:
        return pdfium.PdfDocument(data)
    except pdfium.PdfiumError as exc:
        if "password" in str(exc).lower():
            raise AppError(
                "PDF_ENCRYPTED",
                "Plik PDF jest zabezpieczony hasłem. Usuń zabezpieczenie i spróbuj ponownie.",
                422,
            ) from exc
        raise AppError(
            "PDF_UNREADABLE", "Nie udało się odczytać pliku PDF. Plik może być uszkodzony.", 422
        ) from exc


def _page_text(page: pdfium.PdfPage) -> str:
    textpage = page.get_textpage()
    try:
        raw: str = textpage.get_text_bounded()
    finally:
        textpage.close()
    text = raw.translate(_INVISIBLE_CHARS).replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.rstrip() for line in text.split("\n")]
    return _BLANK_LINES.sub("\n\n", "\n".join(lines)).strip()


def _has_images(page: pdfium.PdfPage) -> bool:
    images = page.get_objects(filter=[pdfium_c.FPDF_PAGEOBJ_IMAGE], max_depth=2)
    return next(iter(images), None) is not None


def _render_jpeg(page: pdfium.PdfPage) -> bytes:
    width, height = page.get_size()
    scale = min(_OCR_DPI / 72, _OCR_MAX_SIDE_PX / max(width, height, 1))
    bitmap = page.render(scale=scale)
    try:
        buffer = io.BytesIO()
        bitmap.to_pil().convert("RGB").save(buffer, format="JPEG", quality=80)
        return buffer.getvalue()
    finally:
        bitmap.close()
