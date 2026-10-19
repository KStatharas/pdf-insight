class AppError(Exception):
    """Error that is safe to show to the end user (messages are in Polish)."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.headers = headers


def ai_invalid_response() -> AppError:
    return AppError(
        "AI_INVALID_RESPONSE",
        "Model AI zwrócił niepoprawną odpowiedź. Spróbuj ponownie za chwilę.",
        502,
    )
