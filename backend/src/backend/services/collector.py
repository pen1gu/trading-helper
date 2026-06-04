import yfinance as yf
from pykrx import stock as krx
from datetime import datetime, timedelta
import pandas as pd
import feedparser
import requests
from bs4 import BeautifulSoup
from typing import Dict, Any, List

class DataCollector:
    @staticmethod
    def get_us_stock_data(ticker: str) -> Dict[str, Any]:
        """
        yfinance를 사용하여 해외 주식 데이터를 가져옵니다.
        """
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            
            return {
                "ticker": ticker,
                "name": info.get("longName"),
                "market": "NASDAQ/NYSE",
                "price": info.get("currentPrice"),
                "change_rate": info.get("regularMarketChangePercent"),
                "market_cap": info.get("marketCap"),
                "per": info.get("forwardPE"),
                "pbr": info.get("priceToBook"),
                "roe": info.get("returnOnEquity"),
                "dividend_yield": info.get("dividendYield", 0) * 100 if info.get("dividendYield") else 0,
            }
        except Exception as e:
            print(f"Error collecting US stock data for {ticker}: {e}")
            return {}

    @staticmethod
    def get_kr_stock_data(ticker: str) -> Dict[str, Any]:
        """
        pykrx를 사용하여 국내 주식 데이터를 가져옵니다.
        """
        try:
            today = datetime.now().strftime("%Y%m%d")
            # 기본적인 시세 정보
            df = krx.get_market_ohlcv_by_date(today, today, ticker)
            if df.empty:
                last_business_day = (datetime.now() - timedelta(days=3)).strftime("%Y%m%d")
                df = krx.get_market_ohlcv_by_date(last_business_day, today, ticker)
            
            fundamental = krx.get_market_fundamental(today, today, ticker)
            if fundamental.empty:
                 last_business_day = (datetime.now() - timedelta(days=3)).strftime("%Y%m%d")
                 fundamental = krx.get_market_fundamental(last_business_day, today, ticker)

            name = krx.get_market_ticker_name(ticker)
            
            return {
                "ticker": ticker,
                "name": name,
                "market": "KOSPI/KOSDAQ",
                "price": float(df['종가'].iloc[-1]) if not df.empty else None,
                "change_rate": float(df['등락률'].iloc[-1]) if not df.empty else None,
                "per": float(fundamental['PER'].iloc[-1]) if not fundamental.empty else None,
                "pbr": float(fundamental['PBR'].iloc[-1]) if not fundamental.empty else None,
                "dividend_yield": float(fundamental['배당수익률'].iloc[-1]) if not fundamental.empty else None,
            }
        except Exception as e:
            print(f"Error collecting KR stock data for {ticker}: {e}")
            return {}

    @staticmethod
    def get_stock_news(ticker: str, name: str) -> List[Dict[str, Any]]:
        """
        주식 관련 뉴스를 구글 뉴스 RSS 등을 통해 수집합니다.
        """
        news_list = []
        # 구글 뉴스 RSS 사용 (종목명으로 검색)
        rss_url = f"https://news.google.com/rss/search?q={name}&hl=ko&gl=KR&ceid=KR:ko"
        
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
        except Exception as e:
            print(f"Error collecting news for {ticker}: {e}")
            
        return news_list

    @staticmethod
    def get_market_indices() -> List[Dict[str, Any]]:
        """
        주요 시장 지수 수집
        """
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
