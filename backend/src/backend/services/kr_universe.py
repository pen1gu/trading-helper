"""KR/US 유니버스 티커 목록 — pykrx/DART/SEC 캐시 fallback."""

from __future__ import annotations

import io
import json
import os
import time
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, List, Tuple

from ..data.ticker_utils import is_kr_ticker
from ..logging_config import task_logger
from .watchlist import PRICE_UNIVERSE_TICKERS

CACHE_DIR = Path(__file__).resolve().parents[3] / ".cache"
KR_UNIVERSE_CACHE = CACHE_DIR / "kr_universe.json"
SEC_TICKERS_CACHE = CACHE_DIR / "sec_company_tickers.json"
DART_CORP_CACHE = CACHE_DIR / "dart_corp_codes.xml"
CACHE_TTL_SEC = 7 * 86400


def universe_kr_limit() -> int:
    try:
        value = int(os.getenv("UNIVERSE_KR_LIMIT", "3000"))
    except ValueError:
        value = 3000
    return max(1000, value)


def universe_us_limit() -> int:
    try:
        value = int(os.getenv("UNIVERSE_US_LIMIT", "3000"))
    except ValueError:
        value = 3000
    return max(100, value)


def save_kr_universe_cache(tickers: List[str]) -> None:
    CACHE_DIR.mkdir(exist_ok=True)
    payload = {
        "saved_at": time.time(),
        "tickers": tickers,
        "source": "pykrx",
    }
    KR_UNIVERSE_CACHE.write_text(
        json.dumps(payload, ensure_ascii=False),
        encoding="utf-8",
    )


def _load_kr_universe_cache() -> List[str] | None:
    if not KR_UNIVERSE_CACHE.exists():
        return None
    try:
        payload = json.loads(KR_UNIVERSE_CACHE.read_text(encoding="utf-8"))
        saved_at = float(payload.get("saved_at", 0))
        if time.time() - saved_at > CACHE_TTL_SEC:
            return None
        tickers = payload.get("tickers") or []
        return [str(t).strip() for t in tickers if str(t).strip()]
    except Exception:
        return None


def _load_dart_listed_tickers() -> List[str]:
    if not DART_CORP_CACHE.exists():
        return []
    try:
        root = ET.fromstring(DART_CORP_CACHE.read_bytes())
        tickers: List[str] = []
        for item in root.findall("list"):
            stock_code = (item.findtext("stock_code") or "").strip()
            if stock_code and stock_code.isdigit():
                tickers.append(stock_code.zfill(6))
        return sorted(set(tickers))
    except Exception:
        return []


def _load_price_universe_kr() -> List[str]:
    return [t for t in PRICE_UNIVERSE_TICKERS if is_kr_ticker(t)]


def fetch_kr_tickers_fallback(limit: int) -> Tuple[List[str], str]:
    """KRX 미로그인 시 DART/캐시/정적 리스트로 KR 유니버스 구성."""
    for source, loader in (
        ("cache", _load_kr_universe_cache),
        ("dart", _load_dart_listed_tickers),
        ("static", _load_price_universe_kr),
    ):
        tickers = loader()
        if tickers:
            result = tickers[:limit]
            task_logger.info(
                "kr_universe.fallback source=%s count=%d limit=%d",
                source,
                len(result),
                limit,
            )
            return result, source
    return [], "none"


def fetch_us_tickers(limit: int) -> Tuple[List[str], str]:
    """SEC company_tickers 캐시에서 US 티커 목록."""
    if not SEC_TICKERS_CACHE.exists():
        return [], "none"
    try:
        data = json.loads(SEC_TICKERS_CACHE.read_text(encoding="utf-8"))
        items = data.values() if isinstance(data, dict) else data
        tickers: List[str] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            ticker = str(item.get("ticker", "")).strip().upper()
            if ticker and not is_kr_ticker(ticker):
                tickers.append(ticker)
        unique = sorted(set(tickers))
        result = unique[:limit]
        task_logger.info(
            "us_universe source=sec count=%d limit=%d",
            len(result),
            limit,
        )
        return result, "sec"
    except Exception:
        return [], "none"


def parse_sec_tickers(data: Any) -> List[str]:
    """SEC JSON에서 티커 리스트 추출."""
    items = data.values() if isinstance(data, dict) else data
    tickers: List[str] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        ticker = str(item.get("ticker", "")).strip().upper()
        if ticker:
            tickers.append(ticker)
    return sorted(set(tickers))
