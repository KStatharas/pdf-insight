from collections.abc import Sequence
from dataclasses import dataclass

from app.pdf_extract import PageText


@dataclass(frozen=True)
class Chunks:
    texts: list[str]
    truncated: bool
    total_chars: int
    used_chars: int


def build_chunks(pages: Sequence[PageText], *, chunk_chars: int, max_chunks: int) -> Chunks:
    """Group pages (with page markers) into chunks of at most `chunk_chars` characters."""
    pieces: list[str] = []
    for page in pages:
        if page.text:
            pieces.extend(_split_long(f"[page {page.number}]\n{page.text}", chunk_chars))

    chunks: list[str] = []
    current = ""
    for piece in pieces:
        if current and len(current) + len(piece) + 2 > chunk_chars:
            chunks.append(current)
            current = piece
        else:
            current = f"{current}\n\n{piece}" if current else piece
    if current:
        chunks.append(current)

    used = chunks[:max_chunks]
    return Chunks(
        texts=used,
        truncated=len(chunks) > max_chunks,
        total_chars=sum(len(c) for c in chunks),
        used_chars=sum(len(c) for c in used),
    )


def _split_long(text: str, limit: int) -> list[str]:
    parts: list[str] = []
    while len(text) > limit:
        cut = text.rfind("\n", 0, limit)
        if cut < limit // 2:
            cut = text.rfind(" ", 0, limit)
        if cut <= 0:
            cut = limit
        parts.append(text[:cut].rstrip())
        text = text[cut:].lstrip()
    if text:
        parts.append(text)
    return parts
