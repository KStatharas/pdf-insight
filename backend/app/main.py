import asyncio
import logging
import math
import re
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Annotated

import httpx
from fastapi import FastAPI, File, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from app.analyzer import Analyzer
from app.config import Settings, get_settings
from app.errors import AppError
from app.llm import ChatModel, OpenAICompatibleChat
from app.rate_limit import RateLimiter
from app.schemas import AnalysisResult, ErrorResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("app")

_MULTIPART_OVERHEAD_BYTES = 64 * 1024
_UNSAFE_FILENAME_CHARS = re.compile(r"[\x00-\x1f\x7f]")
_ERROR_RESPONSES: dict[int | str, dict[str, object]] = {
    status: {"model": ErrorResponse} for status in (400, 411, 413, 415, 422, 429, 500, 502, 503)
}


def create_app(settings: Settings | None = None, chat: ChatModel | None = None) -> FastAPI:
    settings = settings or get_settings()
    limiter = RateLimiter(settings.rate_limit_requests, settings.rate_limit_window_seconds)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
            model = chat
            if model is None and settings.llm_api_key.get_secret_value():
                model = OpenAICompatibleChat(settings, client)
            if model is None:
                logger.warning("LLM_API_KEY is not set; /api/analyze will return 503")
            app.state.analyzer = Analyzer(model, settings) if model else None
            app.state.busy = asyncio.Semaphore(settings.max_concurrent_analyses)
            yield

    app = FastAPI(title="PDF Insight API", version="1.0.0", lifespan=lifespan)

    @app.middleware("http")
    async def reject_large_uploads(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if request.method == "POST" and request.url.path == "/api/analyze":
            length = request.headers.get("content-length")
            if length is None:
                return _error_response(
                    AppError("LENGTH_REQUIRED", "Brak nagłówka Content-Length.", 411)
                )
            if not length.isdigit() or int(length) > (
                settings.max_file_bytes + _MULTIPART_OVERHEAD_BYTES
            ):
                return _error_response(_file_too_large(settings))
        return await call_next(request)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
        max_age=600,
    )

    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return _error_response(exc)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, __: RequestValidationError) -> JSONResponse:
        return _error_response(
            AppError("BAD_REQUEST", "Nie przesłano pliku PDF w polu formularza „file”.", 400)
        )

    @app.get("/")
    async def root() -> dict[str, str]:
        return {"name": "PDF Insight API", "docs": "/docs", "health": "/api/health"}

    @app.get("/api/health")
    async def health(request: Request) -> dict[str, object]:
        return {"status": "ok", "aiConfigured": request.app.state.analyzer is not None}

    @app.post("/api/analyze", responses=_ERROR_RESPONSES)
    async def analyze(
        request: Request,
        file: Annotated[UploadFile, File(description="Plik PDF (maks. 10 MB)")],
    ) -> AnalysisResult:
        retry_after = limiter.hit(request.client.host if request.client else "unknown")
        if retry_after is not None:
            raise AppError(
                "RATE_LIMITED",
                "Wykonano zbyt wiele analiz w krótkim czasie. "
                f"Spróbuj ponownie za {math.ceil(retry_after / 60)} min.",
                429,
                headers={"Retry-After": str(retry_after)},
            )

        analyzer: Analyzer | None = request.app.state.analyzer
        if analyzer is None:
            raise AppError(
                "AI_NOT_CONFIGURED", "Usługa AI nie jest skonfigurowana na serwerze.", 503
            )

        data = await file.read(settings.max_file_bytes + 1)
        if len(data) > settings.max_file_bytes:
            raise _file_too_large(settings)
        if not data:
            raise AppError("EMPTY_FILE", "Przesłany plik jest pusty.", 400)

        busy: asyncio.Semaphore = request.app.state.busy
        if busy.locked():
            raise AppError(
                "SERVER_BUSY",
                "Serwer analizuje teraz inne dokumenty. Spróbuj ponownie za chwilę.",
                503,
            )
        async with busy:
            try:
                return await analyzer.analyze(data, _safe_file_name(file.filename))
            except AppError:
                raise
            except Exception as exc:
                # Unhandled errors would bypass the CORS middleware and look like network errors.
                logger.exception("Unexpected error during analysis")
                raise AppError(
                    "INTERNAL_ERROR", "Wystąpił nieoczekiwany błąd serwera. Spróbuj ponownie.", 500
                ) from exc

    return app


def _error_response(error: AppError) -> JSONResponse:
    body = ErrorResponse.model_validate({"error": {"code": error.code, "message": error.message}})
    return JSONResponse(body.model_dump(), status_code=error.status_code, headers=error.headers)


def _file_too_large(settings: Settings) -> AppError:
    return AppError(
        "FILE_TOO_LARGE",
        f"Plik jest za duży. Maksymalny rozmiar to {settings.max_file_mb} MB.",
        413,
    )


def _safe_file_name(name: str | None) -> str:
    base = re.split(r"[\\/]", name or "")[-1]
    cleaned = _UNSAFE_FILENAME_CHARS.sub("", base).strip()[:200]
    return cleaned or "dokument.pdf"


app = create_app()
