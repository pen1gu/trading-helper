"""투자자 수급 분석."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..data.ticker_utils import is_kr_ticker


def _sum_field(rows: List[models.StockInvestorFlow], field: str, days: int) -> Optional[float]:
    subset = rows[:days]
    values = [getattr(r, field) for r in subset if getattr(r, field) is not None]
    if not values:
        return None
    return float(sum(values))


def _flow_streak(rows: List[models.StockInvestorFlow]) -> int:
    streak = 0
    for row in rows:
        if row.foreign_net is not None and row.foreign_net > 0:
            streak += 1
        else:
            break
    return streak


def _flow_signal(foreign_5d: Optional[float], foreign_20d: Optional[float]) -> str:
    if foreign_5d is None:
        return "neutral"
    if foreign_5d > 0 and foreign_20d is not None and foreign_20d > 0:
        return "strong_buy"
    if foreign_5d > 0:
        return "buy"
    if foreign_5d < 0 and foreign_20d is not None and foreign_20d < 0:
        return "sell"
    return "neutral"


def _vs_individual(rows: List[models.StockInvestorFlow]) -> Optional[str]:
    if len(rows) < 3:
        return None
    recent = rows[:3]
    foreign_buy = all(
        r.foreign_net is not None and r.foreign_net > 0 for r in recent
    )
    inst_buy = all(
        r.institutional_net is not None and r.institutional_net > 0 for r in recent
    )
    ind_sell = all(
        r.individual_net is not None and r.individual_net < 0 for r in recent
    )
    if foreign_buy and inst_buy and ind_sell:
        return "smart_money_buying"
    if foreign_buy and ind_sell:
        return "foreign_vs_retail"
    return None


def _update_rolling_5d(rows: List[models.StockInvestorFlow]) -> None:
    for i, row in enumerate(rows):
        window = rows[i : i + 5]
        foreign_vals = [r.foreign_net for r in window if r.foreign_net is not None]
        if foreign_vals:
            row.foreign_net_5d = float(sum(foreign_vals))


async def analyze_investor_flows(
    db: AsyncSession,
    stock: models.Stock,
    *,
    days: int = 60,
) -> Dict[str, Any]:
    if not is_kr_ticker(stock.ticker):
        return {"status": "unsupported", "message": "국내 종목만 지원합니다."}
    if not stock.id:
        return {"status": "unavailable", "message": "종목 정보가 없습니다."}

    result = await db.execute(
        select(models.StockInvestorFlow)
        .where(models.StockInvestorFlow.stock_id == stock.id)
        .order_by(desc(models.StockInvestorFlow.trade_date))
        .limit(days)
    )
    rows = list(result.scalars().all())
    _update_rolling_5d(rows)

    if not rows:
        return {
            "status": "empty",
            "ticker": stock.ticker,
            "days": days,
            "daily": [],
            "snapshot": None,
            "message": "수급 데이터가 없습니다.",
        }

    foreign_5d = _sum_field(rows, "foreign_net", 5)
    foreign_20d = _sum_field(rows, "foreign_net", 20)
    inst_5d = _sum_field(rows, "institutional_net", 5)
    streak = _flow_streak(rows)

    last_collected = await db.execute(
        select(func.max(models.StockInvestorFlow.collected_at)).where(
            models.StockInvestorFlow.stock_id == stock.id
        )
    )
    last_at = last_collected.scalar()

    daily = [
        {
            "trade_date": r.trade_date,
            "foreign_net": r.foreign_net,
            "institutional_net": r.institutional_net,
            "individual_net": r.individual_net,
        }
        for r in reversed(rows)
    ]

    return {
        "status": "ok",
        "ticker": stock.ticker,
        "days": days,
        "daily": daily,
        "snapshot": {
            "foreign_net_5d": foreign_5d,
            "foreign_net_20d": foreign_20d,
            "institutional_net_5d": inst_5d,
            "flow_streak": streak,
            "flow_signal": _flow_signal(foreign_5d, foreign_20d),
            "vs_individual": _vs_individual(rows),
        },
        "last_collected_at": last_at,
    }


async def build_investor_flow_response(
    db: AsyncSession,
    stock: models.Stock,
    *,
    days: int = 60,
) -> Dict[str, Any]:
    return await analyze_investor_flows(db, stock, days=days)
