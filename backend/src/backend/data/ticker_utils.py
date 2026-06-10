"""티커 시장(KR/US) 판별 유틸."""

from __future__ import annotations

import re

_KR_ALNUM_PATTERN = re.compile(r"^[0-9][0-9A-Z]{5}$")


def is_kr_ticker(ticker: str) -> bool:
    """국내 종목 여부 (순수 6자리 숫자 또는 KRX 영숫자 6자리)."""
    if not ticker:
        return False
    normalized = ticker.strip().upper()
    if normalized.isdigit():
        return True
    return bool(_KR_ALNUM_PATTERN.fullmatch(normalized))
