"""최근 뉴스 감성 집계 서비스."""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models

WINDOW_DAYS = 7


async def build_news_summary(
    db: AsyncSession,
    stock: models.Stock,
    *,
    window_days: int = WINDOW_DAYS,
) -> Dict[str, Any]:
    if not stock.id:
        return {
            "status": "unavailable",
            "ticker": stock.ticker,
            "message": "종목 정보가 없습니다.",
            "window_days": window_days,
        }

    cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)
    result = await db.execute(
        select(models.News)
        .where(
            models.News.stock_id == stock.id,
            models.News.published_at.isnot(None),
            models.News.published_at >= cutoff,
        )
        .order_by(models.News.published_at.desc())
    )
    articles = list(result.scalars().all())

    if not articles:
        return {
            "status": "empty",
            "ticker": stock.ticker,
            "avg_sentiment": None,
            "positive_count": 0,
            "negative_count": 0,
            "neutral_count": 0,
            "article_count": 0,
            "top_keywords": [],
            "window_days": window_days,
            "message": f"최근 {window_days}일 뉴스가 없습니다.",
        }

    scored = [a for a in articles if a.sentiment_score is not None]
    avg_sentiment: Optional[float] = None
    positive = negative = neutral = 0

    if scored:
        avg_sentiment = round(
            sum(a.sentiment_score for a in scored) / len(scored), 1
        )
        for a in scored:
            if a.sentiment_score >= 60:
                positive += 1
            elif a.sentiment_score <= 40:
                negative += 1
            else:
                neutral += 1

    keyword_counter: Counter[str] = Counter()
    for a in articles:
        for kw in a.hot_keywords or []:
            if kw:
                keyword_counter[kw] += 1

    top_keywords = [kw for kw, _ in keyword_counter.most_common(5)]

    return {
        "status": "ok",
        "ticker": stock.ticker,
        "avg_sentiment": avg_sentiment,
        "positive_count": positive,
        "negative_count": negative,
        "neutral_count": neutral,
        "article_count": len(articles),
        "top_keywords": top_keywords,
        "window_days": window_days,
    }
