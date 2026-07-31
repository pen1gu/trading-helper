"""단일 종목 데이터 갱신 — Gemini AI 분석 제외."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..data.ticker_utils import is_kr_ticker
from .business_insight_service import get_or_fetch_business_insight
from .collector import DataCollector
from .feature_store import collect_stock_features
from .investor_flow_crawler import collect_investor_flow_for_stock
from .news_crawl_service import NewsCrawlContext, NewsCrawlMode, mark_news_collected
from .quant_analyzer import calculate_heuristic_fair_price
from .report_pipeline import (
    _fetch_ticker_async,
    _save_disclosures_for_stock,
    _save_news_items,
)

KST = timezone(timedelta(hours=9))


async def refresh_stock_data(
    db: AsyncSession, ticker: str
) -> Tuple[models.Stock, List[str], Dict[str, str]]:
    """Gemini 분석을 제외한 단일 종목 데이터를 갱신합니다. ai_* 필드는 보존합니다."""
    collected_at = datetime.now(KST)
    errors: List[str] = []
    steps: Dict[str, str] = {}

    collector = DataCollector()
    news_ctx = NewsCrawlContext(mode=NewsCrawlMode.FETCH)
    res = await _fetch_ticker_async(db, collector, ticker, news_ctx)

    if "error" in res:
        raise ValueError(res["error"])

    data = res["data"]
    if not data.get("daily_bars"):
        raise ValueError("quote data unavailable")

    stock = await collect_stock_features(db, data, collected_at=collected_at)
    if stock is None:
        raise ValueError("feature collection failed")

    steps["market"] = "ok"

    if res.get("news_skipped"):
        steps["news"] = "skipped"
    else:
        try:
            await _save_news_items(db, stock, res.get("news", []))
            mark_news_collected(stock, collected_at)
            steps["news"] = "ok"
        except Exception as e:
            errors.append(f"news: {e}")
            steps["news"] = "failed"

    if is_kr_ticker(ticker):
        try:
            await collect_investor_flow_for_stock(db, stock, collected_at=collected_at)
            steps["investor_flow"] = "ok"
        except Exception as e:
            errors.append(f"investor_flow: {e}")
            steps["investor_flow"] = "failed"
    else:
        steps["investor_flow"] = "skipped"

    try:
        await get_or_fetch_business_insight(db, ticker, force_refresh=True)
        steps["business_insight"] = "ok"
    except Exception as e:
        errors.append(f"business_insight: {e}")
        steps["business_insight"] = "failed"

    if is_kr_ticker(ticker):
        try:
            await _save_disclosures_for_stock(db, stock, collected_at)
            steps["disclosures"] = "ok"
        except Exception as e:
            errors.append(f"disclosures: {e}")
            steps["disclosures"] = "failed"
    else:
        steps["disclosures"] = "skipped"

    try:
        stock.quant_analysis = calculate_heuristic_fair_price(stock)
        steps["quant_analysis"] = "ok"
    except Exception as e:
        errors.append(f"quant_analysis: {e}")
        steps["quant_analysis"] = "failed"

    await db.commit()
    await db.refresh(stock)
    return stock, errors, steps
