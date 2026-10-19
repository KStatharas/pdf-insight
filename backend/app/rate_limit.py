import math
import threading
import time
from collections import deque
from collections.abc import Callable

_MAX_TRACKED_CLIENTS = 10_000


class RateLimiter:
    """In-memory sliding-window limiter (per process; enough for a single-instance demo)."""

    def __init__(
        self,
        max_requests: int,
        window_seconds: float,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._max_requests = max_requests
        self._window = window_seconds
        self._clock = clock
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str) -> int | None:
        """Record a request. Returns None if allowed, otherwise seconds until a retry is allowed."""
        now = self._clock()
        with self._lock:
            if len(self._hits) > _MAX_TRACKED_CLIENTS:
                self._forget_idle(now)
            hits = self._hits.setdefault(key, deque())
            while hits and hits[0] <= now - self._window:
                hits.popleft()
            if len(hits) >= self._max_requests:
                return max(1, math.ceil(hits[0] + self._window - now))
            hits.append(now)
            return None

    def _forget_idle(self, now: float) -> None:
        self._hits = {
            key: hits for key, hits in self._hits.items() if hits and hits[-1] > now - self._window
        }
