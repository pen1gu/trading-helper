from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[3] / ".env")

from datetime import datetime, timedelta
from urllib.parse import quote

import feedparser
import yfinance as yf
from pykrx import stock as krx
from typing import Dict, Any, List

from .watchlist import TICKER_NAME_OVERRIDES

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
    def get_us_stock_data(ticker: str) -> Dict[str, Any]:
        """yfinance에서 60거래일 일봉과 가능한 scalar feature를 수집합니다."""
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="3mo", auto_adjust=True)
            bars = DataCollector._history_to_bars(hist, "yfinance")

            info: Dict[str, Any] = {}
            try:
                info = stock.info or {}
            except Exception:
                pass

            return {
                "ticker": ticker,
                "name": info.get("longName") or info.get("shortName") or ticker,
                "market": "NASDAQ/NYSE",
                "quote_source": "yfinance",
                "daily_bars": bars,
                "market_cap": DataCollector._safe_float(info.get("marketCap")),
                "per": DataCollector._safe_float(info.get("forwardPE")),
                "pbr": DataCollector._safe_float(info.get("priceToBook")),
                "roe": DataCollector._safe_float(info.get("returnOnEquity")),
                "dividend_yield": (
                    DataCollector._safe_float(info.get("dividendYield")) * 100
                    if info.get("dividendYield") is not None
                    else None
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
    def get_kr_stock_data(ticker: str) -> Dict[str, Any]:
        """
        pykrx를 사용하여 국내 주식 데이터를 가져옵니다.
        """
        try:
            today = datetime.now().strftime("%Y%m%d")
            start = (datetime.now() - timedelta(days=120)).strftime("%Y%m%d")
            df = krx.get_market_ohlcv_by_date(start, today, ticker)

            fundamental = krx.get_market_fundamental(today, today, ticker)
            if fundamental.empty:
                for days_back in range(1, 8):
                    day = (datetime.now() - timedelta(days=days_back)).strftime("%Y%m%d")
                    fundamental = krx.get_market_fundamental(day, day, ticker)
                    if not fundamental.empty:
                        break

            name = TICKER_NAME_OVERRIDES.get(ticker) or krx.get_market_ticker_name(ticker)
            bars: List[Dict[str, Any]] = []
            prev_close: float | None = None
            for idx, row in df.sort_index().iterrows():
                # pykrx column labels can be mojibake on Windows consoles, so use
                # the documented OHLCV order: open, high, low, close, volume, change rate.
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
                        "quote_source": "pykrx",
                    }
                )
                if close is not None:
                    prev_close = close
            
            return {
                "ticker": ticker,
                "name": name,
                "market": "KOSPI/KOSDAQ",
                "quote_source": "pykrx",
                "daily_bars": bars,
                "per": DataCollector._safe_float(fundamental.iloc[-1].get("PER")) if not fundamental.empty else None,
                "pbr": DataCollector._safe_float(fundamental.iloc[-1].get("PBR")) if not fundamental.empty else None,
                "dividend_yield": DataCollector._safe_float(fundamental.iloc[-1].get("배당수익률")) if not fundamental.empty else None,
            }
        except Exception:
            return {}

    @staticmethod
    def get_stock_news(ticker: str, name: str) -> List[Dict[str, Any]]:
        """
        주식 관련 뉴스를 구글 뉴스 RSS 등을 통해 수집합니다.
        """
        news_list = []
        query = quote((name or ticker).strip(), safe="")
        rss_url = f"https://news.google.com/rss/search?q={query}&hl=ko&gl=KR&ceid=KR:ko"

        try:
            feed = feedparser.parse(rss_url)
            for entry in feed.entries[:5]: # 최신 뉴스 5개
                news_list.append({
                    "title": entry.title,
                    "url": entry.link,
                    "source": entry.source.get('title', 'Google News') if hasattr(entry, 'source') else 'Google News',
                    "published_at": datetime(*entry.published_parsed[:6]) if hasattr(entry, 'published_parsed') else datetime.now(),
                    "content": entry.summary if hasattr(entry, 'summary') else ""
                })
        except Exception:
            pass

        return news_list

    @staticmethod
    def get_market_indices() -> List[Dict[str, Any]]:
        """주요 시장 지수 수집"""
        indices = ["^KS11", "^KQ11", "^GSPC", "USDKRW=X"] # 코스피, 코스닥, S&P500, 환율
        results = []
        for idx in indices:
            try:
                data = yf.Ticker(idx)
                info = data.history(period="1d")
                if not info.empty:
                    results.append({
                        "name": idx,
                        "price": info['Close'].iloc[-1],
                        "change": (info['Close'].iloc[-1] - info['Open'].iloc[-1]) / info['Open'].iloc[-1] * 100
                    })
            except:
                continue
        return results

    @staticmethod
    def get_top_tickers(market: str, limit: int = 1000) -> List[str]:
        """시가총액 상위 종목 티커를 동적으로 가져옵니다."""
        try:
            if market == "KR":
                # 국내 시가총액 상위 리스트 (KOSPI + KOSDAQ)
                today = datetime.now().strftime("%Y%m%d")
                df = krx.get_market_cap(today)
                if df.empty:
                    df = krx.get_market_cap((datetime.now() - timedelta(days=3)).strftime("%Y%m%d"))
                return df.index[:limit].tolist()
            elif market == "US":
                # 미국은 yfinance에서 직접적으로 상위 리스트를 가져오는 API가 없으므로
                # 많이 알려진 대표 종목 + 기존 리스트 활용 (혹은 별도 라이브러리 연동 필요)
                # 여기서는 일단 기존 확장 리스트를 반환하거나 샘플로 처리
                return [] 
        except Exception:
            return []
