import asyncio
import json

import httpx
import pytest

from app.errors import AppError
from app.llm import OpenAICompatibleChat, parse_json_object
from tests.helpers import make_settings

SCHEMA = {"type": "object", "properties": {}}


def _chat(handler: httpx.MockTransport, **settings: object) -> OpenAICompatibleChat:
    client = httpx.AsyncClient(transport=handler)
    return OpenAICompatibleChat(make_settings(LLM_API_KEY="test-key", **settings), client)


def _reply(content: str) -> httpx.Response:
    return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})


def test_sends_openai_compatible_request() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return _reply('{"ok": true}')

    chat = _chat(httpx.MockTransport(handler))

    text = asyncio.run(chat.complete([{"role": "user", "content": "hi"}], schema=SCHEMA))

    assert text == '{"ok": true}'
    request = requests[0]
    assert str(request.url).endswith("/v1beta/openai/chat/completions")
    assert request.headers["authorization"] == "Bearer test-key"
    payload = json.loads(request.content)
    assert payload["model"] == "gemini-3.8-flash"
    assert payload["reasoning_effort"] == "low"
    assert payload["response_format"]["type"] == "json_schema"
    assert payload["response_format"]["json_schema"]["schema"] == SCHEMA


def test_falls_back_to_plain_prompting_when_response_format_is_rejected() -> None:
    payloads: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        payloads.append(payload)
        if "response_format" in payload:
            return httpx.Response(400, json={"error": {"message": "unsupported"}})
        return _reply("{}")

    chat = _chat(httpx.MockTransport(handler))

    asyncio.run(chat.complete([{"role": "user", "content": "a"}], schema=SCHEMA))
    asyncio.run(chat.complete([{"role": "user", "content": "b"}], schema=SCHEMA))

    assert ["response_format" in p for p in payloads] == [True, False, False]


@pytest.mark.parametrize(
    ("status", "code"),
    [(429, "AI_RATE_LIMITED"), (401, "AI_NOT_CONFIGURED"), (500, "AI_UNAVAILABLE")],
)
def test_maps_provider_errors(status: int, code: str) -> None:
    chat = _chat(httpx.MockTransport(lambda _: httpx.Response(status, json={})))

    with pytest.raises(AppError) as error:
        asyncio.run(chat.complete([{"role": "user", "content": "hi"}]))

    assert error.value.code == code


def test_maps_timeouts() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    chat = _chat(httpx.MockTransport(handler))

    with pytest.raises(AppError) as error:
        asyncio.run(chat.complete([{"role": "user", "content": "hi"}]))

    assert error.value.code == "AI_TIMEOUT"


def test_parse_json_object_tolerates_markdown_fences() -> None:
    assert parse_json_object('```json\n{"a": 1}\n```') == {"a": 1}


@pytest.mark.parametrize("text", ["", "no json here", "[1, 2]", '{"a": '])
def test_parse_json_object_rejects_non_objects(text: str) -> None:
    with pytest.raises(ValueError):
        parse_json_object(text)
