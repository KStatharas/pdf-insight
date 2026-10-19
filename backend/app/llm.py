import json
import logging
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
        self._url = settings.llm_base_url.rstrip("/") + "/chat/completions"
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
        try:
            return await self._client.post(self._url, json=payload, headers=self._headers)
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
    if response.status_code in (httpx.codes.UNAUTHORIZED, httpx.codes.FORBIDDEN):
        raise AppError(
            "AI_NOT_CONFIGURED",
            "Usługa AI jest nieprawidłowo skonfigurowana po stronie serwera.",
            503,
        )
    raise AppError("AI_UNAVAILABLE", "Usługa AI zwróciła błąd. Spróbuj ponownie za chwilę.", 502)


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
