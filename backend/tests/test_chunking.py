from app.chunking import build_chunks
from app.pdf_extract import PageText


def _pages(*texts: str) -> list[PageText]:
    return [PageText(i, text) for i, text in enumerate(texts, start=1)]


def test_short_document_is_a_single_chunk_with_page_markers() -> None:
    chunks = build_chunks(_pages("first", "", "third"), chunk_chars=1000, max_chunks=4)

    assert chunks.texts == ["[page 1]\nfirst\n\n[page 3]\nthird"]
    assert not chunks.truncated


def test_pages_are_grouped_into_chunks_up_to_the_limit() -> None:
    chunks = build_chunks(_pages("a" * 40, "b" * 40, "c" * 40), chunk_chars=110, max_chunks=4)

    assert len(chunks.texts) == 2
    assert all(len(text) <= 110 for text in chunks.texts)
    assert "[page 3]" in chunks.texts[1]


def test_extra_chunks_are_dropped_and_reported() -> None:
    chunks = build_chunks(_pages("a" * 90, "b" * 90, "c" * 90), chunk_chars=100, max_chunks=2)

    assert len(chunks.texts) == 2
    assert chunks.truncated
    assert chunks.used_chars < chunks.total_chars


def test_very_long_page_is_split_at_whitespace() -> None:
    page = " ".join(["słowo"] * 100)

    chunks = build_chunks(_pages(page), chunk_chars=120, max_chunks=10)

    assert len(chunks.texts) > 1
    assert all(len(text) <= 120 for text in chunks.texts)
    assert all(not text.endswith("słow") for text in chunks.texts)
