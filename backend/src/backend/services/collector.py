from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[3] / ".env")

import contextlib
import io
import logging
from datetime import datetime, timedelta

import pandas as pd
from pykrx import stock as krx
from typing import Callable, Dict, Any, List, Optional, Tuple

from ..data.ticker_utils import is_kr_ticker
from .watchlist import TICKER_NAME_OVERRIDES
from .yfinance_client import (
    fetch_history,
    fetch_history_with_fallback,
    fetch_info,
    suppress_yfinance_errors,
)

HISTORY_YEARS = (5, 3, 1)


class DataCollector:
    @staticmethod
    def _safe_float(value: Any) -> float | None:
        try:
            if value is None:
                return None
            if hasattr(value, "item"):
                value = value.item()
            if value != value:
                return None
            return float(value)
        except Exception:
            return None

    @staticmethod
    def _normalize_percent(value: float | None) -> float | None:
        """0~1 비율과 0~100 퍼센트 표기를 DB용 퍼센트(0~100)로 통일합니다."""
        if value is None:
            return None
        if abs(value) <= 1.5:
            return value * 100
        return value

    @staticmethod
    def _series_value(
        row: Any,
        *names: str,
        fallback_index: Optional[int] = None,
    ) -> float | None:
        if row is None:
            return None
        for name in names:
            if name in row.index:
                return DataCollector._safe_float(row.get(name))
        for col in row.index:
            col_name = str(col)
            for name in names:
                if name in col_name:
                    return DataCollector._safe_float(row.get(col))
        if fallback_index is not None and len(row) > fallback_index:
            return DataCollector._safe_float(row.iloc[fallback_index])
        return None

    @staticmethod
    @contextlib.contextmanager
    def _suppress_pykrx_noise():
        """pykrx KeyError 처리 시 발생하는 print/logging 노이즈를 억제합니다."""
        root = logging.getLogger()
        old_level = root.level
        root.setLevel(logging.ERROR)
        buffer = io.StringIO()
        try:
            with contextlib.redirect_stdout(buffer):
                yield
        finally:
            root.setLevel(old_level)

    @staticmethod
    def _krx_fetch_recent(
        fetch_fn: Callable[[str, str], pd.DataFrame],
        ticker: str,
        *,
        max_days: int = 8,
    ) -> pd.DataFrame:
        empty = pd.DataFrame()
        for days_back in range(max_days):
            day = (datetime.now() - timedelta(days=days_back)).strftime("%Y%m%d")
            try:
                with DataCollector._suppress_pykrx_noise():
                    df = fetch_fn(day, ticker)
                if df is not None and not df.empty:
                    return df
            except Exception:
                continue
        return empty

    @staticmethod
    def _fetch_kr_fundamental(ticker: str) -> pd.DataFrame:
        return DataCollector._krx_fetch_recent(
            lambda day, t: krx.get_market_fundamental(day, day, t),
            ticker,
        )

    @staticmethod
    def _fetch_kr_market_cap(ticker: str) -> float | None:
        df = DataCollector._krx_fetch_recent(
            lambda day, t: krx.get_market_cap(day, day, t),
            ticker,
        )
        if df.empty:
            return None
        return DataCollector._series_value(
            df.iloc[-1],
            "시가총액",
            "MKTCAP",
            fallback_index=0,
        )

    @staticmethod
    def _fetch_kr_foreign_ownership(ticker: str) -> float | None:
        df = DataCollector._krx_fetch_recent(
            lambda day, t: krx.get_exhaustion_rates_of_foreign_investment(day, day, t),
            ticker,
        )
        if df.empty:
            return None
        return DataCollector._series_value(
            df.iloc[-1],
            "지분율",
            "FORN_SHR_RT",
            fallback_index=2,
        )

    @staticmethod
    def _fetch_yf_info(ticker: str) -> Dict[str, Any]:
        with suppress_yfinance_errors():
            for suffix in (".KS", ".KQ"):
                info = fetch_info(f"{ticker}{suffix}")
                if info and info.get("marketCap"):
                    return info
        return {}

    @staticmethod
    def _safe_int(value: Any) -> int | None:
        try:
            if value is None:
                return None
            if hasattr(value, "item"):
                value = value.item()
            if value != value:
                return None
            return int(value)
        except Exception:
            return None

    @staticmethod
    def _history_to_bars(hist, source: str) -> List[Dict[str, Any]]:
        if hist is None or hist.empty:
            return []

        bars: List[Dict[str, Any]] = []
        prev_close: float | None = None
        for idx, row in hist.sort_index().iterrows():
            close = DataCollector._safe_float(row.get("Close"))
            change_amount = (
                close - prev_close
                if close is not None and prev_close not in (None, 0)
                else None
            )
            change_rate = (
                change_amount / prev_close * 100
                if change_amount is not None and prev_close
                else None
            )
            bars.append(
                {
                    "trade_date": idx.date() if hasattr(idx, "date") else idx,
                    "open_price": DataCollector._safe_float(row.get("Open")),
                    "high_price": DataCollector._safe_float(row.get("High")),
                    "low_price": DataCollector._safe_float(row.get("Low")),
                    "close_price": close,
                    "volume": DataCollector._safe_int(row.get("Volume")),
                    "change_rate": change_rate,
                    "change_amount": change_amount,
                    "quote_source": source,
                }
            )
            if close is not None:
                prev_close = close
        return bars

    @staticmethod
    def _pykrx_df_to_bars(df: pd.DataFrame, source: str) -> List[Dict[str, Any]]:
        bars: List[Dict[str, Any]] = []
        prev_close: float | None = None
        for idx, row in df.sort_index().iterrows():
            open_price = DataCollector._safe_float(row.iloc[0]) if len(row) > 0 else None
            high_price = DataCollector._safe_float(row.iloc[1]) if len(row) > 1 else None
            low_price = DataCollector._safe_float(row.iloc[2]) if len(row) > 2 else None
            close = DataCollector._safe_float(row.iloc[3]) if len(row) > 3 else None
            volume = DataCollector._safe_int(row.iloc[4]) if len(row) > 4 else None
            row_change_rate = DataCollector._safe_float(row.iloc[5]) if len(row) > 5 else None
            change_amount = (
                close - prev_close
                if close is not None and prev_close not in (None, 0)
                else None
            )
            change_rate = row_change_rate
            if change_rate is None and change_amount is not None and prev_close:
                change_rate = change_amount / prev_close * 100
            bars.append(
                {
                    "trade_date": idx.date() if hasattr(idx, "date") else idx,
                    "open_price": open_price,
                    "high_price": high_price,
                    "low_price": low_price,
                    "close_price": close,
                    "volume": volume,
                    "change_rate": change_rate,
                    "change_amount": change_amount,
                    "quote_source": source,
                }
            )
            if close is not None:
                prev_close = close
        return bars

    @staticmethod
    def _fetch_kr_daily_bars(ticker: str, start_date: Optional[str] = None) -> Tuple[List[Dict[str, Any]], str]:
        """pykrx 5y→3y→1y 후 yfinance .KS/.KQ fallback. start_date가 있으면 해당 날짜부터 시도."""
        today = datetime.now().strftime("%Y%m%d")

        if start_date:
            formatted_start = start_date.replace("-", "")
            try:
                with DataCollector._suppress_pykrx_noise():
                    df = krx.get_market_ohlcv_by_date(formatted_start, today, ticker)
                if df is not None and not df.empty:
                    source = "pykrx:inc"
                    return DataCollector._pykrx_df_to_bars(df, source), source
            except Exception:
                pass

        for years in HISTORY_YEARS:
            start = (datetime.now() - timedelta(days=365 * years)).strftime("%Y%m%d")
            try:
                with DataCollector._suppress_pykrx_noise():
                    df = krx.get_market_ohlcv_by_date(start, today, ticker)
                if df is not None and not df.empty:
                    source = f"pykrx:{years}y"
                    return DataCollector._pykrx_df_to_bars(df, source), source
            except Exception:
                continue

        with suppress_yfinance_errors():
            for suffix in (".KS", ".KQ"):
                hist, period = fetch_history_with_fallback(f"{ticker}{suffix}", start_date=start_date)
                if not hist.empty:
                    source = f"yfinance:{period}"
                    return DataCollector._history_to_bars(hist, source), source
        return [], ""

    @staticmethod
    def fetch_stock_data(ticker: str, start_date: Optional[str] = None) -> Dict[str, Any]:
        if is_kr_ticker(ticker):
            return DataCollector.get_kr_stock_data(ticker, start_date=start_date)
        return DataCollector.get_us_stock_data(ticker, start_date=start_date)

    @staticmethod
    def get_us_stock_data(ticker: str, start_date: Optional[str] = None) -> Dict[str, Any]:
        """yfinance 일봉과 scalar feature를 수집합니다."""
        try:
            with suppress_yfinance_errors():
                hist, period = fetch_history_with_fallback(ticker, start_date=start_date)
            source = f"yfinance:{period}" if period else "yfinance"
            bars = DataCollector._history_to_bars(hist, source)

            info: Dict[str, Any] = {}
            with suppress_yfinance_errors():
                info = fetch_info(ticker)

            return {
                "ticker": ticker,
                "name": info.get("longName") or info.get("shortName") or ticker,
                "market": "NASDAQ/NYSE",
                "quote_source": source,
                "daily_bars": bars,
                "market_cap": DataCollector._safe_float(info.get("marketCap")),
                "per": DataCollector._safe_float(info.get("forwardPE")),
                "pbr": DataCollector._safe_float(info.get("priceToBook")),
                "roe": DataCollector._normalize_percent(
                    DataCollector._safe_float(info.get("returnOnEquity"))
                ),
                "dividend_yield": DataCollector._normalize_percent(
                    DataCollector._safe_float(info.get("dividendYield"))
                ),
                "eps": DataCollector._safe_float(info.get("trailingEps")),
                "beta": DataCollector._safe_float(info.get("beta")),
                "fifty_two_week_high": DataCollector._safe_float(info.get("fiftyTwoWeekHigh")),
                "fifty_two_week_low": DataCollector._safe_float(info.get("fiftyTwoWeekLow")),
                "avg_volume_10d": DataCollector._safe_float(info.get("averageVolume10days")),
            }
        except Exception:
            return {}

    @staticmethod
    def get_kr_stock_data(ticker: str, start_date: Optional[str] = None) -> Dict[str, Any]:
        """pykrx 우선, 실패 시 yfinance fallback으로 국내 주식 데이터를 수집합니다."""
        try:
            bars, quote_source = DataCollector._fetch_kr_daily_bars(ticker, start_date=start_date)
            if not bars:
                return {}


            fundamental = DataCollector._fetch_kr_fundamental(ticker)
            fund_row = fundamental.iloc[-1] if not fundamental.empty else None

            name = TICKER_NAME_OVERRIDES.get(ticker) or krx.get_market_ticker_name(ticker)

            market_cap = DataCollector._fetch_kr_market_cap(ticker)
            foreign_ownership = DataCollector._fetch_kr_foreign_ownership(ticker)

            yf_info = DataCollector._fetch_yf_info(ticker)
            if market_cap is None:
                market_cap = DataCollector._safe_float(yf_info.get("marketCap"))
            if foreign_ownership is None and yf_info.get("heldPercentInstitutions") is not None:
                foreign_ownership = DataCollector._normalize_percent(
                    DataCollector._safe_float(yf_info.get("heldPercentInstitutions"))
                )

            per = DataCollector._series_value(fund_row, "PER")
            pbr = DataCollector._series_value(fund_row, "PBR")
            eps = DataCollector._series_value(fund_row, "EPS")
            bps = DataCollector._series_value(fund_row, "BPS")
            dividend_yield = DataCollector._series_value(
                fund_row, "DIV", "DVD_YLD", "배당수익률"
            )

            if per is None:
                per = DataCollector._safe_float(yf_info.get("forwardPE"))
            if pbr is None:
                pbr = DataCollector._safe_float(yf_info.get("priceToBook"))
            if dividend_yield is None and yf_info.get("dividendYield") is not None:
                dividend_yield = DataCollector._normalize_percent(
                    DataCollector._safe_float(yf_info.get("dividendYield"))
                )

            roe = None
            if eps is not None and bps not in (None, 0):
                roe = eps / bps * 100
            elif yf_info.get("returnOnEquity") is not None:
                roe = DataCollector._normalize_percent(
                    DataCollector._safe_float(yf_info.get("returnOnEquity"))
                )

            return {
                "ticker": ticker,
                "name": name,
                "market": "KOSPI/KOSDAQ",
                "quote_source": quote_source,
                "daily_bars": bars,
                "market_cap": market_cap,
                "per": per,
                "pbr": pbr,
                "roe": roe,
                "dividend_yield": dividend_yield,
                "foreign_ownership": foreign_ownership,
            }
        except Exception:
            return {}

    @staticmethod
    def get_stock_news(
        ticker: str,
        name: str,
        *,
        known_urls: set[str] | None = None,
        exclude_publish_dates: set | None = None,
    ) -> List[Dict[str, Any]]:
        """종목 키워드·경쟁사 기반 뉴스 수집 (news_crawler 위임)."""
        from .news_crawler import fetch_stock_news

        return fetch_stock_news(
            ticker,
            name,
            known_urls=known_urls,
            exclude_publish_dates=exclude_publish_dates,
        )

    @staticmethod
    def get_market_indices() -> List[Dict[str, Any]]:
        """주요 시장 지수 수집"""
        indices = ["^KS11", "^KQ11", "^GSPC", "USDKRW=X"]
        results = []
        with suppress_yfinance_errors():
            for idx in indices:
                try:
                    info = fetch_history(idx, "1d")
                    if not info.empty:
                        results.append({
                            "name": idx,
                            "price": info["Close"].iloc[-1],
                            "change": (
                                (info["Close"].iloc[-1] - info["Open"].iloc[-1])
                                / info["Open"].iloc[-1]
                                * 100
                            ),
                        })
                except Exception:
                    continue
        return results

    @staticmethod
    def get_top_tickers(market: str, limit: int = 1000) -> List[str]:
        """시가총액 상위 종목 티커를 동적으로 가져옵니다."""
        try:
            if market == "KR":
                today = datetime.now().strftime("%Y%m%d")
                df = krx.get_market_cap(today)
                if df.empty:
                    df = krx.get_market_cap(
                        (datetime.now() - timedelta(days=3)).strftime("%Y%m%d")
                    )
                return df.index[:limit].tolist()
            elif market == "US":
                return []
        except Exception:
            return []

