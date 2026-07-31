"""pykrx 투자자별 순매수 수집."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..data.ticker_utils import is_kr_ticker
from .collector import DataCollector
from .pykrx_client import get_pykrx_stock, use_pykrx
from .request_pacing import is_rate_limited, pace, pace_on_ban


def _parse_yyyymmdd(value: str) -> date:
    return date(int(value[:4]), int(value[4:6]), int(value[6:8]))


def _safe_int(value) -> Optional[int]:
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


class InvestorFlowCrawler:
    def fetch_flows(
        self,
        ticker: str,
        *,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[dict]:
        if not is_kr_ticker(ticker):
            return []

        if not use_pykrx():
            return []

        end = end_date or date.today()
        start = start_date or (end - timedelta(days=60))
        from_str = start.strftime("%Y%m%d")
        to_str = end.strftime("%Y%m%d")

        try:
            pace("pykrx")
            with DataCollector._suppress_pykrx_noise():
                df = get_pykrx_stock().get_market_trading_value_by_date(
                    from_str, to_str, ticker.zfill(6), on="순매수"
                )
        except Exception as exc:
            if is_rate_limited(exc):
                pace_on_ban("pykrx", 0)
            return []

        if df is None or df.empty:
            return []

        rows: List[dict] = []
        for idx, row in df.iterrows():
            trade_date = idx.date() if hasattr(idx, "date") else _parse_yyyymmdd(str(idx))
            foreign_net = _safe_int(row.get("외국인합계") or row.get("외국인"))
            inst_net = _safe_int(row.get("기관합계"))
            ind_net = _safe_int(row.get("개인"))
            rows.append(
                {
                    "trade_date": trade_date,
                    "foreign_net": foreign_net,
                    "institutional_net": inst_net,
                    "individual_net": ind_net,
                }
            )
        return rows


async def _last_flow_date(db: AsyncSession, stock_id: int) -> Optional[date]:
    result = await db.execute(
        select(models.StockInvestorFlow.trade_date)
        .where(models.StockInvestorFlow.stock_id == stock_id)
        .order_by(models.StockInvestorFlow.trade_date.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def collect_investor_flow_for_stock(
    db: AsyncSession,
    stock: models.Stock,
    *,
    collected_at: Optional[datetime] = None,
) -> int:
    if not stock.id or not is_kr_ticker(stock.ticker):
        return 0

    last_date = await _last_flow_date(db, stock.id)
    start = (last_date + timedelta(days=1)) if last_date else (date.today() - timedelta(days=60))
    if start > date.today():
        return 0

    crawler = InvestorFlowCrawler()
    rows = crawler.fetch_flows(stock.ticker, start_date=start, end_date=date.today())
    if not rows:
        return 0

    now = collected_at or datetime.now(timezone.utc)
    saved = 0
    for row in rows:
        existing = await db.execute(
            select(models.StockInvestorFlow).where(
                models.StockInvestorFlow.stock_id == stock.id,
                models.StockInvestorFlow.trade_date == row["trade_date"],
            )
        )
        if existing.scalars().first():
            continue
        db.add(
            models.StockInvestorFlow(
                stock_id=stock.id,
                trade_date=row["trade_date"],
                foreign_net=row.get("foreign_net"),
                institutional_net=row.get("institutional_net"),
                individual_net=row.get("individual_net"),
                collected_at=now,
            )
        )
        saved += 1
    return saved
