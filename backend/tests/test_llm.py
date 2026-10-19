import asyncio
import json

import httpx
import pytest

from app.errors import AppError
from app.llm import GeminiChat, OpenAICompatibleChat, create_chat, parse_json_object
from tests.helpers import make_settings

SCHEMA = {"type": "object", "properties": {}}


def _chat(handler: httpx.MockTransport, **settings: object) -> OpenAICompatibleChat:
    client = httpx.AsyncClient(transport=handler)
    values: dict[str, object] = {"llm_provider": "openai", **settings}
    return OpenAICompatibleChat(make_settings(LLM_API_KEY="test-key", **values), client)


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


# --- Native Gemini API -------------------------------------------------------------------------


def _gemini(handler: httpx.MockTransport, **settings: object) -> GeminiChat:
    client = httpx.AsyncClient(transport=handler)
    values: dict[str, object] = {"llm_fallback_models": "", **settings}
    return GeminiChat(make_settings(LLM_API_KEY="AQ.test-key", **values), client)


def _gemini_reply(*texts: str, thought: str | None = None) -> httpx.Response:
    parts: list[dict[str, object]] = []
    if thought:
        parts.append({"text": thought, "thought": True})
    parts.extend({"text": t} for t in texts)
    return httpx.Response(
        200, json={"candidates": [{"content": {"parts": parts}, "finishReason": "STOP"}]}
    )


def test_gemini_is_the_default_provider() -> None:
    settings = make_settings(LLM_API_KEY="k")
    chat = create_chat(settings, httpx.AsyncClient())
    assert isinstance(chat, GeminiChat)
    assert settings.base_url == "https://generativelanguage.googleapis.com/v1beta"


def test_old_openai_base_url_is_corrected_for_gemini() -> None:
    settings = make_settings(
        llm_base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )
    assert settings.base_url == "https://generativelanguage.googleapis.com/v1beta"


def test_sends_native_gemini_request() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return _gemini_reply('{"ok":', " true}", thought="thinking...")

    chat = _gemini(httpx.MockTransport(handler))
    messages = [
        {"role": "system", "content": "rules"},
        {"role": "user", "content": "<document>x</document>"},
        {"role": "assistant", "content": "bad"},
        {"role": "user", "content": "fix it"},
    ]

    text = asyncio.run(chat.complete(messages, schema=SCHEMA))

    assert text == '{"ok": true}'  # thought parts are dropped
    request = requests[0]
    assert str(request.url).endswith("/v1beta/models/gemini-3.8-flash:generateContent")
    assert request.headers["x-goog-api-key"] == "AQ.test-key"
    assert "authorization" not in request.headers
    payload = json.loads(request.content)
    assert payload["systemInstruction"] == {"parts": [{"text": "rules"}]}
    assert [c["role"] for c in payload["contents"]] == ["user", "model", "user"]
    config = payload["generationConfig"]
    assert config["responseMimeType"] == "application/json"
    assert config["responseJsonSchema"] == SCHEMA
    assert config["thinkingConfig"] == {"thinkingLevel": "low"}


def test_sends_images_as_inline_data() -> None:
    payloads: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        payloads.append(json.loads(request.content))
        return _gemini_reply("Aneks nr 1")

    chat = _gemini(httpx.MockTransport(handler))
    message = {
        "role": "user",
        "content": [
            {"type": "text", "text": "Transcribe page 11."},
            {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,QUJD"}},
        ],
    }

    assert asyncio.run(chat.complete([message])) == "Aneks nr 1"
    assert payloads[0]["contents"] == [
        {
            "role": "user",
            "parts": [
                {"text": "Transcribe page 11."},
                {"inlineData": {"mimeType": "image/jpeg", "data": "QUJD"}},
            ],
        }
    ]
    assert "responseMimeType" not in payloads[0]["generationConfig"]  # type: ignore[operator]


def test_gemini_drops_unsupported_options_one_at_a_time() -> None:
    configs: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        config = json.loads(request.content)["generationConfig"]
        configs.append(config)
        if "responseJsonSchema" in config or "thinkingConfig" in config:
            return httpx.Response(400, json={"error": {"message": "Unknown name"}})
        return _gemini_reply("{}")

    chat = _gemini(httpx.MockTransport(handler))
    asyncio.run(chat.complete([{"role": "user", "content": "a"}], schema=SCHEMA))
    asyncio.run(chat.complete([{"role": "user", "content": "b"}], schema=SCHEMA))

    assert len(configs) == 4
    assert configs[-1] == {"temperature": 0.2, "responseMimeType": "application/json"}


def test_gemini_invalid_key_is_reported_as_configuration_error() -> None:
    calls: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(1)
        return httpx.Response(
            400,
            json={
                "error": {"status": "INVALID_ARGUMENT", "details": [{"reason": "API_KEY_INVALID"}]}
            },
        )

    chat = _gemini(httpx.MockTransport(handler))
    with pytest.raises(AppError) as error:
        asyncio.run(chat.complete([{"role": "user", "content": "a"}], schema=SCHEMA))

    assert error.value.code == "AI_NOT_CONFIGURED"
    assert len(calls) == 1


def test_gemini_blocked_prompt_is_reported() -> None:
    reply = httpx.Response(200, json={"promptFeedback": {"blockReason": "SAFETY"}})
    chat = _gemini(httpx.MockTransport(lambda _: reply))
    with pytest.raises(AppError) as error:
        asyncio.run(chat.complete([{"role": "user", "content": "a"}]))
    assert error.value.code == "AI_REFUSED"


def test_gemini_falls_back_to_the_next_model_and_keeps_using_it() -> None:
    urls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        urls.append(request.url.path)
        if "gemini-3.8-flash" in request.url.path:
            return httpx.Response(503, json={"error": {"status": "UNAVAILABLE"}})
        if "model-b" in request.url.path:
            return httpx.Response(429, json={"error": {"status": "RESOURCE_EXHAUSTED"}})
        return _gemini_reply("{}")

    chat = _gemini(httpx.MockTransport(handler), llm_fallback_models="model-b, model-c")
    asyncio.run(chat.complete([{"role": "user", "content": "a"}]))
    asyncio.run(chat.complete([{"role": "user", "content": "b"}]))

    models = [path.split("/")[-1].split(":")[0] for path in urls]
    assert models == ["gemini-3.8-flash", "model-b", "model-c", "model-c"]
    assert chat.name == "model-c"


def test_gemini_reports_the_error_when_every_model_fails() -> None:
    reply = httpx.Response(503, json={"error": {"status": "UNAVAILABLE"}})
    chat = _gemini(httpx.MockTransport(lambda _: reply), llm_fallback_models="model-b")
    with pytest.raises(AppError) as error:
        asyncio.run(chat.complete([{"role": "user", "content": "a"}]))
    assert error.value.code == "AI_UNAVAILABLE"
