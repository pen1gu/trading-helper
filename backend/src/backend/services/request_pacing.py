"""외부 API/크롤 요청 간격 제어 — random jitter sleep 및 IP 벤 대응."""

from __future__ import annotations

import os
import random
import threading
import time
from typing import Dict, Tuple

from ..logging_config import task_logger

DEFAULT_PACE_CONFIG: Dict[str, Tuple[float, float]] = {
    "pykrx": (0.5, 1.5),
    "yfinance": (0.3, 0.8),
    "dart": (0.15, 0.35),
    "news": (0.8, 2.0),
    "gemini": (0.5, 1.0),
}

_ENV_OVERRIDES = {
    "pykrx": ("PACE_PYKRX_MIN", "PACE_PYKRX_MAX"),
    "yfinance": ("PACE_YFINANCE_MIN", "PACE_YFINANCE_MAX"),
    "dart": ("PACE_DART_MIN", "PACE_DART_MAX"),
    "news": ("PACE_NEWS_MIN", "PACE_NEWS_MAX"),
    "gemini": ("PACE_GEMINI_MIN", "PACE_GEMINI_MAX"),
}

_locks: Dict[str, threading.Lock] = {}
_last_request_at: Dict[str, float] = {}


def _get_lock(source: str) -> threading.Lock:
    if source not in _locks:
        _locks[source] = threading.Lock()
    return _locks[source]


def _pace_bounds(source: str) -> Tuple[float, float]:
    default_min, default_max = DEFAULT_PACE_CONFIG.get(source, (0.2, 0.5))
    env_min, env_max = _ENV_OVERRIDES.get(source, (None, None))
    min_delay = float(os.getenv(env_min, default_min)) if env_min else default_min
    max_delay = float(os.getenv(env_max, default_max)) if env_max else default_max
    if min_delay > max_delay:
        min_delay, max_delay = max_delay, min_delay
    return min_delay, max_delay


def pace(source: str) -> None:
    """마지막 요청 이후 소스별 random sleep."""
    min_delay, max_delay = _pace_bounds(source)
    delay = random.uniform(min_delay, max_delay)

    lock = _get_lock(source)
    with lock:
        elapsed = time.time() - _last_request_at.get(source, 0.0)
        wait = max(0.0, delay - elapsed)
        if wait > 0:
            time.sleep(wait)
        _last_request_at[source] = time.time()


def pace_on_ban(source: str, attempt: int, *, base: float = 2.0, cap: float = 60.0) -> None:
    """403/429 등 rate limit 감지 시 exponential backoff + jitter."""
    backoff = min(cap, base * (2**attempt))
    jitter = random.uniform(0.0, backoff * 0.3)
    sleep_for = backoff + jitter
    task_logger.warning(
        "rate_limit_backoff source=%s attempt=%d sleep=%.2fs",
        source,
        attempt + 1,
        sleep_for,
    )
    time.sleep(sleep_for)


def is_rate_limited(exc: BaseException) -> bool:
    """HTTP 403/429, KRX LOGOUT, JSON 파싱 실패 등 벤/차단 신호."""
    msg = str(exc).upper()
    markers = (
        "429",
        "403",
        "TOO MANY REQUESTS",
        "RATE LIMIT",
        "LOGOUT",
        "FORBIDDEN",
        "JSONDECODEERROR",
        "EXPECTING VALUE",
    )
    return any(marker in msg for marker in markers)


def collect_concurrency() -> int:
    """report_pipeline 티커 병렬 수집 동시성 (최대 8)."""
    try:
        value = int(os.getenv("COLLECT_CONCURRENCY", "8"))
    except ValueError:
        value = 8
    return max(1, min(value, 8))
