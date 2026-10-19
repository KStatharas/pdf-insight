import pytest

from app.errors import AppError
from app.pdf_extract import ExtractedPdf, extract_pdf
from tests.helpers import make_scanned_pdf, make_text_pdf


def _extract(data: bytes, max_pages: int = 50, max_ocr_pages: int = 4) -> ExtractedPdf:
    return extract_pdf(data, max_pages=max_pages, min_text_chars=20, max_ocr_pages=max_ocr_pages)


def test_extracts_text_per_page() -> None:
    result = _extract(make_text_pdf(["Page one has some text.\nSecond line.", "Page two text."]))

    assert result.page_count == 2
    assert result.pages[0].text == "Page one has some text.\nSecond line."
    assert result.pages[1].number == 2
    assert result.scanned_pages == []
    assert result.images == []


def test_blank_page_is_not_treated_as_a_scan() -> None:
    result = _extract(make_text_pdf(["Enough text on the first page.", ""]))

    assert result.pages[1].text == ""
    assert result.scanned_pages == []


def test_image_only_page_is_rendered_for_ocr() -> None:
    result = _extract(make_scanned_pdf())

    assert result.scanned_pages == [1]
    assert result.images[0].number == 1
    assert result.images[0].jpeg.startswith(b"\xff\xd8")


def test_scans_are_not_rendered_when_ocr_is_disabled() -> None:
    result = _extract(make_scanned_pdf(), max_ocr_pages=0)

    assert result.scanned_pages == [1]
    assert result.images == []


@pytest.mark.parametrize(
    ("data", "code"),
    [
        (b"PK\x03\x04 this is a zip file", "NOT_A_PDF"),
        (b"%PDF-1.7\nthis is not really a pdf", "PDF_UNREADABLE"),
    ],
)
def test_rejects_invalid_files(data: bytes, code: str) -> None:
    with pytest.raises(AppError) as error:
        _extract(data)

    assert error.value.code == code


def test_rejects_documents_over_the_page_limit() -> None:
    with pytest.raises(AppError) as error:
        _extract(make_text_pdf(["one", "two", "three"]), max_pages=2)

    assert error.value.code == "TOO_MANY_PAGES"
