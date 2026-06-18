"""일봉 OHLCV 기반 기술 지표 계산."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence


@dataclass
class BarInput:
    trade_date: Any
    open_price: Optional[float]
    high_price: Optional[float]
    low_price: Optional[float]
    close_price: Optional[float]
    volume: Optional[int]


def _sma(values: List[Optional[float]], period: int) -> List[Optional[float]]:
    result: List[Optional[float]] = []
    for i in range(len(values)):
        if i + 1 < period:
            result.append(None)
            continue
        window = values[i + 1 - period : i + 1]
        if any(v is None for v in window):
            result.append(None)
            continue
        result.append(sum(window) / period)
    return result


def _ema(values: List[float], period: int) -> List[Optional[float]]:
    if not values:
        return []
    k = 2 / (period + 1)
    ema_vals: List[Optional[float]] = [None] * len(values)
    if len(values) < period:
        return ema_vals
    seed = sum(values[:period]) / period
    ema_vals[period - 1] = seed
    prev = seed
    for i in range(period, len(values)):
        prev = values[i] * k + prev * (1 - k)
        ema_vals[i] = prev
    return ema_vals


def _rsi(closes: List[Optional[float]], period: int = 14) -> List[Optional[float]]:
    result: List[Optional[float]] = [None] * len(closes)
    gains: List[float] = []
    losses: List[float] = []
    for i in range(1, len(closes)):
        if closes[i] is None or closes[i - 1] is None:
            gains.append(0.0)
            losses.append(0.0)
            continue
        diff = closes[i] - closes[i - 1]
        gains.append(max(diff, 0.0))
        losses.append(max(-diff, 0.0))

    if len(gains) < period:
        return result

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    def _calc_rsi(ag: float, al: float) -> float:
        if al == 0:
            return 100.0
        rs = ag / al
        return 100 - (100 / (1 + rs))

    result[period] = _calc_rsi(avg_gain, avg_loss)
    for i in range(period + 1, len(closes)):
        avg_gain = (avg_gain * (period - 1) + gains[i - 1]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i - 1]) / period
        result[i] = _calc_rsi(avg_gain, avg_loss)
    return result


def _macd(
    closes: List[Optional[float]], fast: int = 12, slow: int = 26, signal: int = 9
) -> tuple[List[Optional[float]], List[Optional[float]], List[Optional[float]]]:
    numeric = [c if c is not None else 0.0 for c in closes]
    ema_fast = _ema(numeric, fast)
    ema_slow = _ema(numeric, slow)
    macd_line: List[Optional[float]] = []
    for f, s in zip(ema_fast, ema_slow):
        if f is None or s is None:
            macd_line.append(None)
        else:
            macd_line.append(f - s)
    signal_line = _ema([v if v is not None else 0.0 for v in macd_line], signal)
    histogram: List[Optional[float]] = []
    for m, sig in zip(macd_line, signal_line):
        if m is None or sig is None:
            histogram.append(None)
        else:
            histogram.append(m - sig)
    return macd_line, signal_line, histogram


class TechnicalAnalyzer:
    @staticmethod
    def compute_series(bars: Sequence[BarInput]) -> Dict[str, Any]:
        if not bars:
            return {"bars": [], "snapshot": {}}

        closes = [b.close_price for b in bars]
        ma5 = _sma(closes, 5)
        ma20 = _sma(closes, 20)
        ma60 = _sma(closes, 60)
        rsi = _rsi(closes, 14)
        macd_line, macd_signal, macd_hist = _macd(closes)

        volumes = [b.volume for b in bars]
        vol_avg20: List[Optional[float]] = []
        for i in range(len(volumes)):
            if i + 1 < 20:
                vol_avg20.append(None)
                continue
            window = volumes[i + 1 - 20 : i + 1]
            if any(v is None for v in window):
                vol_avg20.append(None)
            else:
                vol_avg20.append(sum(window) / 20)

        series: List[Dict[str, Any]] = []
        for i, bar in enumerate(bars):
            td = bar.trade_date
            if hasattr(td, "isoformat"):
                td = td.isoformat()
            series.append(
                {
                    "trade_date": td,
                    "open_price": bar.open_price,
                    "high_price": bar.high_price,
                    "low_price": bar.low_price,
                    "close_price": bar.close_price,
                    "volume": bar.volume,
                    "ma5": ma5[i],
                    "ma20": ma20[i],
                    "ma60": ma60[i],
                    "rsi14": rsi[i],
                    "macd": macd_line[i],
                    "macd_signal": macd_signal[i],
                    "macd_histogram": macd_hist[i],
                }
            )

        last = bars[-1]
        snapshot = TechnicalAnalyzer._build_snapshot(
            close=last.close_price,
            ma5=ma5[-1] if ma5 else None,
            ma20=ma20[-1] if ma20 else None,
            ma60=ma60[-1] if ma60 else None,
            rsi=rsi[-1] if rsi else None,
            volume=last.volume,
            vol_avg20=vol_avg20[-1] if vol_avg20 else None,
        )
        return {"bars": series, "snapshot": snapshot}

    @staticmethod
    def _build_snapshot(
        *,
        close: Optional[float],
        ma5: Optional[float],
        ma20: Optional[float],
        ma60: Optional[float],
        rsi: Optional[float],
        volume: Optional[int],
        vol_avg20: Optional[float],
    ) -> Dict[str, Any]:
        def _pct(cur: Optional[float], base: Optional[float]) -> Optional[float]:
            if cur is None or not base:
                return None
            return (cur - base) / base * 100

        ma_alignment = "neutral"
        if ma5 is not None and ma20 is not None and ma60 is not None:
            if ma5 > ma20 > ma60:
                ma_alignment = "bullish"
            elif ma5 < ma20 < ma60:
                ma_alignment = "bearish"

        vol_ratio = None
        if volume is not None and vol_avg20 and vol_avg20 > 0:
            vol_ratio = volume / vol_avg20

        return {
            "close": close,
            "ma5": ma5,
            "ma20": ma20,
            "ma60": ma60,
            "rsi14": rsi,
            "vs_ma20_pct": _pct(close, ma20),
            "vs_ma60_pct": _pct(close, ma60),
            "ma_alignment": ma_alignment,
            "volume": volume,
            "volume_avg_20d": vol_avg20,
            "volume_ratio_vs_20d": vol_ratio,
        }
