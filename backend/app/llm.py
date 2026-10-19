import json
import logging
import re
from typing import Any, Protocol

import httpx

from app.config import ResponseFormatMode, Settings
from app.errors import AppError

logger = logging.getLogger(__name__)

JsonObject = dict[str, object]
Message = dict[str, object]


class ChatModel(Protocol):
    name: str

    async def complete(self, messages: list[Message], *, schema: JsonObject | None = None) -> str:
        """Return the text of the model's reply. With `schema`, ask for JSON matching it."""
        ...


class OpenAICompatibleChat:
    """Chat Completions client for any OpenAI-compatible API (Google Gemini by default)."""

    def __init__(self, settings: Settings, client: httpx.AsyncClient) -> None:
        self.name = settings.llm_model
        self._client = client
        self._url = settings.base_url + "/chat/completions"
        self._headers = {"Authorization": f"Bearer {settings.llm_api_key.get_secret_value()}"}
        self._reasoning_effort = settings.llm_reasoning_effort
        self._format_mode: ResponseFormatMode = settings.llm_response_format

    async def complete(self, messages: list[Message], *, schema: JsonObject | None = None) -> str:
        payload: JsonObject = {"model": self.name, "messages": messages, "temperature": 0.2}
        if self._reasoning_effort:
            payload["reasoning_effort"] = self._reasoning_effort
        response_format = self._response_format(schema)
        if response_format is not None:
            payload["response_format"] = response_format

        response = await self._post(payload)
        if response.status_code == httpx.codes.BAD_REQUEST and response_format is not None:
            logger.warning(
                "Provider rejected response_format, retrying without it: %s",
                _error_snippet(response),
            )
            self._format_mode = "none"
            del payload["response_format"]
            response = await self._post(payload)

        _raise_for_status(response)
        return _message_text(response.json())

    def _response_format(self, schema: JsonObject | None) -> JsonObject | None:
        if schema is None or self._format_mode == "none":
            return None
        if self._format_mode == "json_object":
            return {"type": "json_object"}
        return {"type": "json_schema", "json_schema": {"name": "pdf_insight", "schema": schema}}

    async def _post(self, payload: JsonObject) -> httpx.Response:
        return await _post(self._client, self._url, payload, self._headers)


_DATA_URL = re.compile(r"^data:(?P<mime>[\w.+-]+/[\w.+-]+);base64,(?P<data>.+)$", re.DOTALL)


class GeminiChat:
    """Client for the native Gemini `generateContent` API.

    The native API accepts both key types issued by Google AI Studio (legacy "AIza..." keys and
    the "AQ..." auth keys issued by default since 2026), while the OpenAI-compatible endpoint
    rejects some "AQ..." keys with 401.
    """

    def __init__(self, settings: Settings, client: httpx.AsyncClient) -> None:
        self.name = settings.llm_model
        self._client = client
        self._url = f"{settings.base_url}/models/{settings.llm_model}:generateContent"
        self._headers = {"x-goog-api-key": settings.llm_api_key.get_secret_value()}
        self._thinking_level = settings.llm_reasoning_effort
        self._format_mode: ResponseFormatMode = settings.llm_response_format

    async def complete(self, messages: list[Message], *, schema: JsonObject | None = None) -> str:
        response = await _post(
            self._client, self._url, self._payload(messages, schema), self._headers
        )
        # Optional features (JSON Schema, thinking level) differ between model generations. If the
        # provider rejects the request, drop them one at a time and remember that for later calls.
        while (
            response.status_code == httpx.codes.BAD_REQUEST
            and not _is_key_error(response)
            and self._degrade(schema)
        ):
            logger.warning(
                "Gemini rejected the request, retrying simpler: %s", _error_snippet(response)
            )
            response = await _post(
                self._client, self._url, self._payload(messages, schema), self._headers
            )

        _raise_for_status(response)
        return _gemini_text(response.json())

    def _degrade(self, schema: JsonObject | None) -> bool:
        if schema is not None and self._format_mode == "json_schema":
            self._format_mode = "json_object"
            return True
        if self._thinking_level:
            self._thinking_level = ""
            return True
        return False

    def _payload(self, messages: list[Message], schema: JsonObject | None) -> JsonObject:
        system = "\n\n".join(str(m["content"]) for m in messages if m["role"] == "system")
        contents = [
            {
                "role": "model" if m["role"] == "assistant" else "user",
                "parts": _gemini_parts(m["content"]),
            }
            for m in messages
            if m["role"] != "system"
        ]
        config: JsonObject = {"temperature": 0.2}
        if schema is not None and self._format_mode != "none":
            config["responseMimeType"] = "application/json"
            if self._format_mode == "json_schema":
                config["responseJsonSchema"] = schema
        if self._thinking_level:
            config["thinkingConfig"] = {"thinkingLevel": self._thinking_level}

        payload: JsonObject = {"contents": contents, "generationConfig": config}
        if system:
            payload["systemInstruction"] = {"parts": [{"text": system}]}
        return payload


def _gemini_parts(content: object) -> list[JsonObject]:
    if isinstance(content, str):
        return [{"text": content}]
    parts: list[JsonObject] = []
    if isinstance(content, list):
        for item in content:
            if not isinstance(item, dict):
                continue
            if item.get("type") == "text":
                parts.append({"text": str(item.get("text", ""))})
            elif item.get("type") == "image_url":
                image = item.get("image_url")
                url = image.get("url", "") if isinstance(image, dict) else ""
                match = _DATA_URL.match(str(url))
                if match:
                    parts.append({"inlineData": {"mimeType": match["mime"], "data": match["data"]}})
    return parts


def _gemini_text(data: Any) -> str:
    try:
        candidate = data["candidates"][0]
    except (KeyError, IndexError, TypeError):
        candidate = None
    if not isinstance(candidate, dict):
        block_reason = (
            data.get("promptFeedback", {}).get("blockReason") if isinstance(data, dict) else None
        )
        if block_reason:
            logger.warning("Gemini blocked the prompt: %s", block_reason)
            raise AppError(
                "AI_REFUSED",
                "Usługa AI odmówiła analizy tego dokumentu (filtr bezpieczeństwa dostawcy).",
                422,
            )
        return ""
    parts = candidate.get("content", {}).get("parts", [])
    if candidate.get("finishReason") not in (None, "STOP"):
        logger.warning("Gemini finished with %s", candidate.get("finishReason"))
    return "".join(
        str(p.get("text", "")) for p in parts if isinstance(p, dict) and not p.get("thought")
    )


def create_chat(settings: Settings, client: httpx.AsyncClient) -> ChatModel:
    if settings.llm_provider == "openai":
        return OpenAICompatibleChat(settings, client)
    return GeminiChat(settings, client)


async def _post(
    client: httpx.AsyncClient, url: str, payload: JsonObject, headers: dict[str, str]
) -> httpx.Response:
    try:
        return await client.post(url, json=payload, headers=headers)
    except httpx.TimeoutException as exc:
        raise AppError(
            "AI_TIMEOUT", "Usługa AI nie odpowiedziała na czas. Spróbuj ponownie.", 504
        ) from exc
    except httpx.HTTPError as exc:
        raise AppError(
            "AI_UNAVAILABLE", "Nie udało się połączyć z usługą AI. Spróbuj ponownie.", 502
        ) from exc


def parse_json_object(text: str) -> JsonObject:
    """Parse the first JSON object in a model reply (tolerates markdown fences around it)."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end < start:
        raise ValueError("the reply does not contain a JSON object")
    value = json.loads(text[start : end + 1])
    if not isinstance(value, dict):
        raise ValueError("the reply is not a JSON object")
    return value


def _raise_for_status(response: httpx.Response) -> None:
    if response.is_success:
        return
    logger.error("LLM API error %s: %s", response.status_code, _error_snippet(response))
    if response.status_code == httpx.codes.TOO_MANY_REQUESTS:
        raise AppError(
            "AI_RATE_LIMITED",
            "Wyczerpano chwilowy limit zapytań do usługi AI. Spróbuj ponownie za minutę.",
            503,
        )
    if response.status_code in (
        httpx.codes.UNAUTHORIZED,
        httpx.codes.FORBIDDEN,
        httpx.codes.NOT_FOUND,
    ) or _is_key_error(response):
        raise AppError(
            "AI_NOT_CONFIGURED",
            "Usługa AI jest nieprawidłowo skonfigurowana po stronie serwera "
            f"(HTTP {response.status_code}).",
            503,
        )
    raise AppError(
        "AI_UNAVAILABLE",
        f"Usługa AI zwróciła błąd (HTTP {response.status_code}). Spróbuj ponownie za chwilę.",
        502,
    )


def _is_key_error(response: httpx.Response) -> bool:
    """Gemini answers 400 (not 401) for an invalid API key."""
    return response.status_code == httpx.codes.BAD_REQUEST and "API_KEY" in response.text


def _message_text(data: Any) -> str:
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(str(p.get("text", "")) for p in content if isinstance(p, dict))
    return ""


def _error_snippet(response: httpx.Response) -> str:
    return response.text[:500]
