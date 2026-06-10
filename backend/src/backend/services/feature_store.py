from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models

KST = timezone(timedelta(hours=9))


STOCK_SCALAR_FIELDS = [
    "ticker",
    "name",
    "market",
    "trade_date",
    "current_price",
    "day_open",
    "day_high",
    "day_low",
    "day_close",
    "prev_close",
    "change_rate",
    "change_amount",
    "volume",
    "volume_change_rate",
    "day_range_pct",
    "quote_source",
    "market_cap",
    "per",
    "pbr",
    "roe",
    "dividend_yield",
    "foreign_ownership",
    "eps",
    "beta",
    "fifty_two_week_high",
    "fifty_two_week_low",
    "avg_volume_10d",
    "close_max_5d",
    "close_min_5d",
    "close_avg_5d",
    "high_max_5d",
    "low_min_5d",
    "volume_avg_5d",
    "close_max_20d",
    "close_min_20d",
    "close_avg_20d",
    "high_max_20d",
    "low_min_20d",
    "volume_avg_20d",
    "close_max_60d",
    "close_min_60d",
    "close_avg_60d",
    "high_max_60d",
    "low_min_60d",
    "volume_avg_60d",
    "vs_avg_20d_pct",
    "vs_60d_high_pct",
    "vs_60d_low_pct",
    "ai_score",
    "ai_recommendation",
]


def _avg(values: Iterable[float | int | None]) -> Optional[float]:
    nums = [float(v) for v in values if v is not None]
    if not nums:
        return None
    return sum(nums) / len(nums)


def _max(values: Iterable[float | int | None]) -> Optional[float]:
    nums = [float(v) for v in values if v is not None]
    return max(nums) if nums else None


def _min(values: Iterable[float | int | None]) -> Optional[float]:
    nums = [float(v) for v in values if v is not None]
    return min(nums) if nums else None


def _pct(current: Optional[float], base: Optional[float]) -> Optional[float]:
    if current is None or not base:
        return None
    return (current - base) / base * 100


def _as_date(value: Any) -> date:
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    return datetime.fromisoformat(str(value)).date()


async def get_or_create_stock(db: AsyncSession, data: Dict[str, Any]) -> models.Stock:
    result = await db.execute(
        select(models.Stock).where(models.Stock.ticker == data["ticker"])
    )
    stock = result.scalars().first()
    if stock is None:
        stock = models.Stock(ticker=data["ticker"])
        db.add(stock)
        await db.flush()

    for field in (
        "name",
        "market",
        "quote_source",
        "market_cap",
        "per",
        "pbr",
        "roe",
        "dividend_yield",
        "foreign_ownership",
        "eps",
        "beta",
        "fifty_two_week_high",
        "fifty_two_week_low",
        "avg_volume_10d",
    ):
        if field in data and data.get(field) is not None:
            setattr(stock, field, data.get(field))
    return stock


async def upsert_daily_bars(
    db: AsyncSession, stock: models.Stock, bars: List[Dict[str, Any]]
) -> None:
    for item in bars:
        trade_date = _as_date(item["trade_date"])
        result = await db.execute(
            select(models.StockDailyBar).where(
                models.StockDailyBar.stock_id == stock.id,
                models.StockDailyBar.trade_date == trade_date,
            )
        )
        bar = result.scalars().first()
        if bar is None:
            bar = models.StockDailyBar(stock_id=stock.id, trade_date=trade_date)
            db.add(bar)

        for field in (
            "open_price",
            "high_price",
            "low_price",
            "close_price",
            "volume",
            "change_rate",
            "change_amount",
            "quote_source",
        ):
            setattr(bar, field, item.get(field))
        bar.collected_at = datetime.now(KST)
    await db.flush()


async def recompute_stock_features(
    db: AsyncSession, stock: models.Stock, collected_at: Optional[datetime] = None
) -> None:
    result = await db.execute(
        select(models.StockDailyBar)
        .where(models.StockDailyBar.stock_id == stock.id)
        .order_by(models.StockDailyBar.trade_date)
    )
    bars = list(result.scalars().all())
    if not bars:
        return

    latest = bars[-1]
    previous = bars[-2] if len(bars) >= 2 else None
    previous_volume = previous.volume if previous else None

    stock.trade_date = latest.trade_date
    stock.current_price = latest.close_price
    stock.day_open = latest.open_price
    stock.day_high = latest.high_price
    stock.day_low = latest.low_price
    stock.day_close = latest.close_price
    stock.prev_close = previous.close_price if previous else None
    stock.change_rate = latest.change_rate
    stock.change_amount = latest.change_amount
    stock.volume = latest.volume
    stock.volume_change_rate = _pct(
        float(latest.volume) if latest.volume is not None else None,
        float(previous_volume) if previous_volume else None,
    )
    stock.day_range_pct = _pct(
        latest.high_price - latest.low_price
        if latest.high_price is not None and latest.low_price is not None
        else None,
        latest.open_price,
    )
    stock.quote_source = latest.quote_source or stock.quote_source
    stock.data_collected_at = collected_at or datetime.now(KST)

    historical = bars[:-1]
    for window in (5, 20, 60):
        subset = historical[-window:]
        setattr(stock, f"close_max_{window}d", _max(b.close_price for b in subset))
        setattr(stock, f"close_min_{window}d", _min(b.close_price for b in subset))
        setattr(stock, f"close_avg_{window}d", _avg(b.close_price for b in subset))
        setattr(stock, f"high_max_{window}d", _max(b.high_price for b in subset))
        setattr(stock, f"low_min_{window}d", _min(b.low_price for b in subset))
        setattr(stock, f"volume_avg_{window}d", _avg(b.volume for b in subset))

    stock.vs_avg_20d_pct = _pct(stock.current_price, stock.close_avg_20d)
    stock.vs_60d_high_pct = _pct(stock.current_price, stock.close_max_60d)
    stock.vs_60d_low_pct = _pct(stock.current_price, stock.close_min_60d)
    await db.flush()


async def collect_stock_features(
    db: AsyncSession, data: Dict[str, Any], collected_at: Optional[datetime] = None
) -> Optional[models.Stock]:
    bars = data.get("daily_bars") or []
    if not bars:
        return None

    stock = await get_or_create_stock(db, data)
    await upsert_daily_bars(db, stock, bars)
    await recompute_stock_features(db, stock, collected_at=collected_at)
    return stock


def stock_to_feature_dict(stock: models.Stock) -> Dict[str, Any]:
    payload: Dict[str, Any] = {}
    for field in STOCK_SCALAR_FIELDS:
        value = getattr(stock, field, None)
        if isinstance(value, (date, datetime)):
            value = value.isoformat()
        payload[field] = value
    return payload


async def build_analysis_context(
    db: AsyncSession, stock: models.Stock, news_limit: int = 5
) -> Dict[str, Any]:
    bars_result = await db.execute(
        select(models.StockDailyBar)
        .where(models.StockDailyBar.stock_id == stock.id)
        .order_by(models.StockDailyBar.trade_date.desc())
        .limit(10)
    )
    bars = []
    for bar in reversed(list(bars_result.scalars().all())):
        bars.append(
            {
                "trade_date": bar.trade_date.isoformat(),
                "open_price": bar.open_price,
                "high_price": bar.high_price,
                "low_price": bar.low_price,
                "close_price": bar.close_price,
                "volume": bar.volume,
                "change_rate": bar.change_rate,
                "change_amount": bar.change_amount,
            }
        )

    news_result = await db.execute(
        select(models.News)
        .where(models.News.stock_id == stock.id)
        .order_by(models.News.published_at.desc().nullslast(), models.News.created_at.desc())
        .limit(news_limit)
    )
    news = []
    for item in news_result.scalars().all():
        news.append(
            {
                "title": item.title,
                "url": item.url,
                "source": item.source,
                "published_at": item.published_at.isoformat()
                if item.published_at
                else None,
                "content": item.content,
            }
        )

    return {
        "stock": stock_to_feature_dict(stock),
        "recent_daily_bars": bars,
        "news": news,
    }
