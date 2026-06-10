"""뉴스 증분 크롤링 — 당일 중복 RSS 방지."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from enum import Enum
from typing import Dict, List, Optional, Set

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models

KST = timezone(timedelta(hours=9))


class NewsCrawlMode(str, Enum):
    SKIP = "skip"
    FETCH = "fetch"


@dataclass
class NewsCrawlContext:
    mode: NewsCrawlMode
    known_urls: Set[str] = field(default_factory=set)
    exclude_publish_dates: Set[date] = field(default_factory=set)


def today_kst() -> date:
    return datetime.now(KST).date()


def _to_kst_date(dt: datetime) -> date:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(KST).date()


def resolve_crawl_mode(news_collected_at: Optional[datetime]) -> NewsCrawlMode:
    if news_collected_at is None:
        return NewsCrawlMode.FETCH
    if _to_kst_date(news_collected_at) == today_kst():
        return NewsCrawlMode.SKIP
    return NewsCrawlMode.FETCH


def build_crawl_context(
    news_collected_at: Optional[datetime],
    known_urls: Optional[Set[str]] = None,
) -> NewsCrawlContext:
    mode = resolve_crawl_mode(news_collected_at)
    exclude_dates: Set[date] = set()
    if (
        mode == NewsCrawlMode.FETCH
        and news_collected_at is not None
        and _to_kst_date(news_collected_at) == today_kst()
    ):
        exclude_dates.add(today_kst())
    return NewsCrawlContext(
        mode=mode,
        known_urls=known_urls or set(),
        exclude_publish_dates=exclude_dates,
    )


async def load_news_crawl_contexts(
    db: AsyncSession,
    tickers: List[str],
) -> Dict[str, NewsCrawlContext]:
    """유니버스 종목별 뉴스 크롤 모드·기존 URL preload."""
    if not tickers:
        return {}

    stock_result = await db.execute(
        select(models.Stock).where(models.Stock.ticker.in_(tickers))
    )
    stocks_by_ticker = {s.ticker: s for s in stock_result.scalars().all()}

    stock_ids = [s.id for s in stocks_by_ticker.values()]
    urls_by_stock_id: Dict[int, Set[str]] = {sid: set() for sid in stock_ids}

    if stock_ids:
        news_result = await db.execute(
            select(models.News.stock_id, models.News.url).where(
                models.News.stock_id.in_(stock_ids),
                models.News.url.isnot(None),
            )
        )
        for stock_id, url in news_result.all():
            if stock_id and url:
                urls_by_stock_id.setdefault(stock_id, set()).add(url)

    contexts: Dict[str, NewsCrawlContext] = {}
    for ticker in tickers:
        stock = stocks_by_ticker.get(ticker)
        if stock is None:
            contexts[ticker] = build_crawl_context(None)
            continue
        known_urls = urls_by_stock_id.get(stock.id, set())
        contexts[ticker] = build_crawl_context(stock.news_collected_at, known_urls)

    return contexts


def mark_news_collected(stock: models.Stock, collected_at: datetime) -> None:
    stock.news_collected_at = collected_at


def count_skip_tickers(contexts: Dict[str, NewsCrawlContext]) -> int:
    return sum(1 for ctx in contexts.values() if ctx.mode == NewsCrawlMode.SKIP)
