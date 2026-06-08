"""사업·경영 분석 수집·캐시 서비스."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from .business_analyzer import fetch_and_analyze

CACHE_TTL_DAYS = 7


def _is_cache_valid(stock: models.Stock) -> bool:
    if not stock.business_insight or not stock.financials_collected_at:
        return False
    collected = stock.financials_collected_at
    if collected.tzinfo is None:
        collected = collected.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - collected < timedelta(days=CACHE_TTL_DAYS)


async def get_or_fetch_business_insight(
    db: AsyncSession,
    ticker: str,
    *,
    force_refresh: bool = False,
) -> Dict[str, Any]:
    result = await db.execute(
        select(models.Stock).where(models.Stock.ticker == ticker)
    )
    stock = result.scalars().first()
    if not stock:
        return {"status": "not_found", "message": "종목을 찾을 수 없습니다."}

    if not force_refresh and _is_cache_valid(stock):
        return stock.business_insight

    insight = await asyncio.to_thread(fetch_and_analyze, ticker)
    stock.business_insight = insight
    stock.financials_collected_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(stock)
    return insight


async def collect_business_insight_for_stock(
    db: AsyncSession,
    stock: models.Stock,
) -> Optional[Dict[str, Any]]:
    if _is_cache_valid(stock):
        return stock.business_insight

    insight = await asyncio.to_thread(fetch_and_analyze, stock.ticker)
    stock.business_insight = insight
    stock.financials_collected_at = datetime.now(timezone.utc)
    return insight
