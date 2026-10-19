import copy
import io
import json
from collections.abc import Callable

from PIL import Image, ImageDraw

from app.config import Settings
from app.llm import JsonObject, Message

VALID_ANALYSIS: JsonObject = {
    "document": {
        "language": "pl",
        "type": "umowa",
        "title": "Umowa serwisowa",
        "date": "2026-09-01",
    },
    "summary": "Umowa określa zasady serwisu. Strony ustaliły wynagrodzenie. "
    "Umowa obowiązuje przez 12 miesięcy.",
    "keyPoints": ["Okres umowy 12 mies.", "Wynagrodzenie 12 500 zł netto", "SLA 99,5%"],
    "entities": {"organizations": ["Przykład sp. z o.o."], "people": ["Jan Kowalski"]},
    "amounts": [{"value": 12500.0, "currency": "PLN", "context": "wynagrodzenie"}],
    "dates": [{"date": "2026-10-01", "context": "termin płatności"}],
    "keywords": ["serwis", "SLA"],
}


def analysis(**overrides: object) -> JsonObject:
    data = copy.deepcopy(VALID_ANALYSIS)
    data.update(overrides)
    return data


def analysis_json(**overrides: object) -> str:
    return json.dumps(analysis(**overrides), ensure_ascii=False)


def make_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "allowed_origins": "https://example.github.io",
        "rate_limit_requests": 100,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


class FakeChat:
    """Stands in for the AI provider: returns queued replies or computes them from messages."""

    name = "fake-model"

    def __init__(self, replies: list[str] | Callable[[list[Message]], str]) -> None:
        self._replies = replies
        self.calls: list[tuple[list[Message], JsonObject | None]] = []

    async def complete(self, messages: list[Message], *, schema: JsonObject | None = None) -> str:
        self.calls.append((messages, schema))
        if callable(self._replies):
            return self._replies(messages)
        return self._replies.pop(0)


def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def make_text_pdf(pages: list[str]) -> bytes:
    """Minimal valid PDF with one Helvetica text page per entry (ASCII text only)."""
    objects: dict[int, bytes] = {
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        3: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    }
    kids: list[str] = []
    for index, text in enumerate(pages):
        page_id, content_id = 4 + 2 * index, 5 + 2 * index
        kids.append(f"{page_id} 0 R")
        operators = " ".join(f"({_escape(line)}) Tj T*" for line in text.split("\n"))
        stream = f"BT /F1 11 Tf 14 TL 50 790 Td {operators} ET".encode("latin-1")
        objects[page_id] = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
            f"/Resources << /Font << /F1 3 0 R >> >> /Contents {content_id} 0 R >>"
        ).encode()
        objects[content_id] = b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream"
    objects[2] = f"<< /Type /Pages /Kids [{' '.join(kids)}] /Count {len(pages)} >>".encode()

    out = bytearray(b"%PDF-1.4\n")
    offsets: dict[int, int] = {}
    for number in sorted(objects):
        offsets[number] = len(out)
        out += b"%d 0 obj\n" % number + objects[number] + b"\nendobj\n"
    xref_offset = len(out)
    size = max(objects) + 1
    out += b"xref\n0 %d\n0000000000 65535 f \n" % size
    for number in range(1, size):
        out += b"%010d 00000 n \n" % offsets[number]
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (size, xref_offset)
    return bytes(out)


def make_scanned_pdf(text: str = "Faktura nr 1/2026") -> bytes:
    """PDF whose only page is an image (no text layer), like a scan."""
    image = Image.new("RGB", (620, 880), "white")
    ImageDraw.Draw(image).text((60, 80), text, fill="black")
    buffer = io.BytesIO()
    image.save(buffer, format="PDF", resolution=72)
    return buffer.getvalue()


SAMPLE_PAGE = (
    "UMOWA SERWISOWA nr 7/2026\n"
    "zawarta w dniu 1 wrzesnia 2026 r. pomiedzy Przyklad sp. z o.o. a Jan Kowalski.\n"
    "Wynagrodzenie wynosi 12 500,00 zl netto miesiecznie.\n"
    "Termin platnosci: 1 pazdziernika 2026 r."
)
