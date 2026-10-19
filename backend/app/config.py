from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ResponseFormatMode = Literal["json_schema", "json_object", "none"]
Provider = Literal["gemini", "openai"]

_DEFAULT_BASE_URLS: dict[str, str] = {
    "gemini": "https://generativelanguage.googleapis.com/v1beta",
    "openai": "https://generativelanguage.googleapis.com/v1beta/openai/",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    llm_api_key: SecretStr = Field(
        default=SecretStr(""),
        validation_alias=AliasChoices("LLM_API_KEY", "GEMINI_API_KEY"),
    )
    # "gemini": native Gemini API (works with the "AQ." auth keys that AI Studio issues by
    # default). "openai": any OpenAI-compatible Chat Completions API.
    llm_provider: Provider = "gemini"
    llm_base_url: str = ""
    llm_model: str = "gemini-3.8-flash"
    llm_reasoning_effort: str = "low"
    llm_response_format: ResponseFormatMode = "json_schema"
    llm_timeout_seconds: float = 40.0

    allowed_origins: str = "http://localhost:5173"
    max_file_mb: int = 10
    max_pages: int = 500
    rate_limit_requests: int = 10
    rate_limit_window_seconds: int = 600
    max_concurrent_analyses: int = 3

    chunk_chars: int = 60_000
    max_chunks: int = 4
    ocr_enabled: bool = True
    ocr_max_pages: int = 4
    ocr_min_chars: int = 20

    @property
    def base_url(self) -> str:
        url = (self.llm_base_url or _DEFAULT_BASE_URLS[self.llm_provider]).rstrip("/")
        if self.llm_provider == "gemini" and url.endswith("/openai"):
            # An older .env may still point at the OpenAI-compatible path.
            url = url.removesuffix("/openai")
        return url

    @property
    def origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def max_file_bytes(self) -> int:
        return self.max_file_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
