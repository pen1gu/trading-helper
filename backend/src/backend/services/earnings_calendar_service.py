"""실적 캘린더 — 과거 공시 패턴 기반 예상일 산출."""

from __future__ import annotations

from datetime import date, timedelta
from statistics import mean
from typing import Any, Dict, List, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..data.ticker_utils import is_kr_ticker


def _estimate_next_earnings(earnings_dates: List[date]) -> tuple[Optional[date], Optional[int]]:
    if len(earnings_dates) < 2:
        return None, None

    sorted_dates = sorted(earnings_dates)
    gaps = [
        (sorted_dates[i] - sorted_dates[i - 1]).days
        for i in range(1, len(sorted_dates))
        if (sorted_dates[i] - sorted_dates[i - 1]).days > 30
    ]
    if not gaps:
        return None, None

    avg_gap = int(mean(gaps))
    last = sorted_dates[-1]
    estimated = last + timedelta(days=avg_gap)
    uncertainty = max(7, int(mean([abs(g - avg_gap) for g in gaps]) if len(gaps) > 1 else 7))
    return estimated, min(uncertainty, 14)


async def build_earnings_calendar(
    db: AsyncSession,
    stock: models.Stock,
) -> Dict[str, Any]:
    if not is_kr_ticker(stock.ticker):
        return {
            "status": "unsupported",
            "ticker": stock.ticker,
            "message": "국내 종목만 실적 캘린더를 지원합니다.",
        }

    if not stock.id:
        return {
            "status": "unavailable",
            "ticker": stock.ticker,
            "message": "종목 정보가 없습니다.",
        }

    result = await db.execute(
        select(models.Disclosure)
        .where(
            models.Disclosure.stock_id == stock.id,
            models.Disclosure.report_type == "earnings",
        )
        .order_by(desc(models.Disclosure.rcept_dt))
        .limit(12)
    )
    earnings_disclosures = list(result.scalars().all())
    earnings_dates = [d.rcept_dt for d in earnings_disclosures]

    today = date.today()
    last_date = earnings_dates[0] if earnings_dates else None
    days_since = (today - last_date).days if last_date else None

    next_est, uncertainty = _estimate_next_earnings(earnings_dates)
    days_to_next = (next_est - today).days if next_est else None

    if not earnings_dates:
        return {
            "status": "empty",
            "ticker": stock.ticker,
            "message": "실적 공시 이력이 없어 예측할 수 없습니다.",
        }

    message = None
    if next_est and days_to_next is not None and days_to_next < 0:
        message = "예상 실적일이 지났습니다. 신규 공시를 확인하세요."

    return {
        "status": "ok",
        "ticker": stock.ticker,
        "next_estimated_date": next_est,
        "next_estimated_uncertainty_days": uncertainty,
        "days_to_next": days_to_next if days_to_next is not None and days_to_next >= 0 else None,
        "last_earnings_date": last_date,
        "days_since_last_earnings": days_since,
        "message": message,
    }
