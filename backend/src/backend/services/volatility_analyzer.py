"""시계열 일봉에서 변동·거래량 급증 이벤트를 탐지합니다."""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional, Sequence, Union

from .. import models

BarLike = Union[models.StockDailyBar, Dict[str, Any]]

DEFAULT_BAR_LIMIT = 120
DEFAULT_MIN_CHANGE_PCT = 5.0
DEFAULT_VOLUME_SPIKE_RATIO = 2.0
DEFAULT_MAX_EVENTS = 8


def _bar_date(bar: BarLike) -> Optional[date]:
    if isinstance(bar, dict):
        val = bar.get("trade_date")
    else:
        val = bar.trade_date
    if isinstance(val, date):
        return val
    if val is not None:
        return date.fromisoformat(str(val))
    return None


def _bar_value(bar: BarLike, field: str) -> Optional[float]:
    if isinstance(bar, dict):
        val = bar.get(field)
    else:
        val = getattr(bar, field, None)
    if val is None:
        return None
    return float(val)


def bars_to_series(bars: Sequence[BarLike]) -> List[Dict[str, Any]]:
    """일봉을 AI 전달용 시계열 페이로드로 직렬화합니다."""
    sorted_bars = sorted(bars, key=lambda b: _bar_date(b) or date.min)
    series: List[Dict[str, Any]] = []
    for bar in sorted_bars:
        trade_date = _bar_date(bar)
        if trade_date is None:
            continue
        series.append(
            {
                "trade_date": trade_date.isoformat(),
                "open": _bar_value(bar, "open_price") if isinstance(bar, models.StockDailyBar) else _bar_value(bar, "open"),
                "high": _bar_value(bar, "high_price") if isinstance(bar, models.StockDailyBar) else _bar_value(bar, "high"),
                "low": _bar_value(bar, "low_price") if isinstance(bar, models.StockDailyBar) else _bar_value(bar, "low"),
                "close": _bar_value(bar, "close_price") if isinstance(bar, models.StockDailyBar) else _bar_value(bar, "close"),
                "volume": _bar_value(bar, "volume"),
                "change_rate": _bar_value(bar, "change_rate"),
            }
        )
    return series


def _rolling_volume_avg(bars: Sequence[BarLike], index: int, window: int = 20) -> Optional[float]:
    if index < 1:
        return None
    start = max(0, index - window)
    volumes = [
        _bar_value(bars[i], "volume")
        for i in range(start, index)
        if _bar_value(bars[i], "volume") is not None
    ]
    if not volumes:
        return None
    return sum(volumes) / len(volumes)


def _event_score(change_rate: Optional[float], volume_ratio: Optional[float]) -> float:
    score = abs(change_rate or 0.0)
    if volume_ratio is not None and volume_ratio >= DEFAULT_VOLUME_SPIKE_RATIO:
        score += min(volume_ratio, 5.0) * 2.0
    return score


def detect_volatility_events(
    bars: Sequence[BarLike],
    *,
    min_change_pct: float = DEFAULT_MIN_CHANGE_PCT,
    volume_spike_ratio: float = DEFAULT_VOLUME_SPIKE_RATIO,
    max_events: int = DEFAULT_MAX_EVENTS,
) -> List[Dict[str, Any]]:
    """급등/급락·거래량 급증일을 탐지해 중요도 순으로 반환합니다."""
    sorted_bars = sorted(bars, key=lambda b: _bar_date(b) or date.min)
    candidates: Dict[str, Dict[str, Any]] = {}

    for index, bar in enumerate(sorted_bars):
        trade_date = _bar_date(bar)
        if trade_date is None:
            continue

        change_rate = _bar_value(bar, "change_rate")
        volume = _bar_value(bar, "volume")
        close_price = _bar_value(bar, "close_price") if isinstance(bar, models.StockDailyBar) else _bar_value(bar, "close")
        vol_avg = _rolling_volume_avg(sorted_bars, index)
        volume_ratio = (volume / vol_avg) if volume is not None and vol_avg else None

        event_types: List[str] = []
        if change_rate is not None and abs(change_rate) >= min_change_pct:
            event_types.append("price_spike" if change_rate > 0 else "price_drop")
        if volume_ratio is not None and volume_ratio >= volume_spike_ratio:
            event_types.append("volume_spike")

        if not event_types:
            continue

        key = trade_date.isoformat()
        score = _event_score(change_rate, volume_ratio)
        existing = candidates.get(key)
        if existing and existing["score"] >= score:
            continue

        candidates[key] = {
            "trade_date": key,
            "change_rate": change_rate,
            "close_price": close_price,
            "volume": volume,
            "volume_vs_avg_20d": round(volume_ratio, 2) if volume_ratio is not None else None,
            "event_type": event_types,
            "score": score,
            "news": [],
        }

    events = sorted(candidates.values(), key=lambda x: x["score"], reverse=True)
    for event in events[:max_events]:
        event.pop("score", None)
    return events[:max_events]
