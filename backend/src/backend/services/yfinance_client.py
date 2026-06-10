"""yfinance 호출 래퍼 — crumb/auth 재시도·동시성 제한."""

from __future__ import annotations

import contextlib
import logging
import threading
import time
from pathlib import Path
from typing import Any, Callable, TypeVar

import pandas as pd
import platformdirs
import yfinance as yf
from yfinance.data import YfData

from ..logging_config import task_logger

T = TypeVar("T")

_lock = threading.Lock()
_concurrency = threading.Semaphore(3)

HISTORY_PERIODS = ("5y", "3y", "1y")

_AUTH_MARKERS = ("401", "Unauthorized", "Invalid Crumb", "Invalid Cookie")


def _is_auth_error(exc: BaseException) -> bool:
    msg = str(exc)
    return any(marker in msg for marker in _AUTH_MARKERS)


def invalidate_yf_session() -> None:
    """Yahoo cookie/crumb 세션과 로컬 캐시를 초기화합니다."""
    try:
        data = YfData()
        with data._cookie_lock:
            data._crumb = None
            data._cookie = None
            if data._session is not None:
                try:
                    data._session.cookies.clear()
                except Exception:
                    pass
    except Exception:
        pass

    try:
        from yfinance.cache import get_cookie_cache

        cache = get_cookie_cache()
        for strategy in ("basic", "csrf", "curlCffi"):
            cache.store(strategy, None)
    except Exception:
        pass

    cache_dir = Path(platformdirs.user_cache_dir()) / "py-yfinance"
    for name in ("cookies.db", "cookies.db-wal", "cookies.db-shm"):
        path = cache_dir / name
        if path.exists():
            try:
                path.unlink()
            except Exception:
                pass


def call_with_retry(fn: Callable[[], T], *, max_attempts: int = 3) -> T:
    """yfinance 호출을 semaphore 하에서 실행하고 auth 실패 시 재시도합니다."""
    last_exc: Exception | None = None
    for attempt in range(max_attempts):
        try:
            with _concurrency:
                return fn()
        except Exception as exc:
            last_exc = exc
            if _is_auth_error(exc) and attempt < max_attempts - 1:
                task_logger.debug(
                    "yfinance auth retry attempt=%d err=%s", attempt + 1, exc
                )
                with _lock:
                    invalidate_yf_session()
                time.sleep(2**attempt)
                continue
            raise
    if last_exc:
        raise last_exc
    raise RuntimeError("yfinance call_with_retry failed without exception")


def fetch_history(
    symbol: str, period: Optional[str], *, start_date: Optional[str] = None, auto_adjust: bool = True
) -> pd.DataFrame:
    def _call() -> pd.DataFrame:
        # period와 start_date를 동시에 쓰면 yfinance에서 오류가 날 수 있으므로 조건부 전달
        if start_date:
            hist = yf.Ticker(symbol).history(start=start_date, auto_adjust=auto_adjust)
        else:
            hist = yf.Ticker(symbol).history(period=period, auto_adjust=auto_adjust)
        return hist if hist is not None else pd.DataFrame()

    return call_with_retry(_call)


def fetch_history_with_fallback(symbol: str, start_date: Optional[str] = None) -> tuple[pd.DataFrame, str]:
    """start_date가 있으면 해당 날짜부터, 없으면 5y → 3y → 1y 순으로 시도합니다."""
    if start_date:
        try:
            hist = fetch_history(symbol, None, start_date=start_date)
            if hist is not None and not hist.empty:
                return hist, f"from:{start_date}"
        except Exception as exc:
            task_logger.debug("yfinance history failed symbol=%s start=%s err=%s", symbol, start_date, exc)
            # fallback to periods if start_date fails
    
    for period in HISTORY_PERIODS:
        try:
            hist = fetch_history(symbol, period)
            if hist is not None and not hist.empty:
                return hist, period
        except Exception as exc:
            task_logger.debug(
                "yfinance history failed symbol=%s period=%s err=%s",
                symbol,
                period,
                exc,
            )
    return pd.DataFrame(), ""


def fetch_info(symbol: str) -> dict[str, Any]:
    def _call() -> dict[str, Any]:
        info = yf.Ticker(symbol).info
        return info if info else {}

    try:
        return call_with_retry(_call)
    except Exception as exc:
        task_logger.debug("yfinance info failed symbol=%s err=%s", symbol, exc)
        return {}


def fetch_financial_statements(
    symbol: str,
) -> tuple[pd.DataFrame | None, pd.DataFrame | None, pd.DataFrame | None]:
    """financials, cashflow, balance_sheet를 재시도하며 조회합니다."""

    def _call() -> tuple[pd.DataFrame | None, pd.DataFrame | None, pd.DataFrame | None]:
        stock = yf.Ticker(symbol)
        return stock.financials, stock.cashflow, stock.balance_sheet

    try:
        return call_with_retry(_call)
    except Exception as exc:
        task_logger.debug(
            "yfinance financials failed symbol=%s err=%s", symbol, exc
        )
        return None, None, None


@contextlib.contextmanager
def suppress_yfinance_errors():
    """yfinance 라이브러리 ERROR 로그를 일시 억제합니다."""
    yf_logger = logging.getLogger("yfinance")
    old_level = yf_logger.level
    yf_logger.setLevel(logging.CRITICAL)
    try:
        yield
    finally:
        yf_logger.setLevel(old_level)
