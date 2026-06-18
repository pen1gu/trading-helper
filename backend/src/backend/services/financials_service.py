"""연간 재무제표 API용 서비스."""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

from .financial_crawler import AnnualFinancial, FinancialCrawler


def _pct_change(curr: Optional[float], prev: Optional[float]) -> Optional[float]:
    if curr is None or prev in (None, 0):
        return None
    return (curr - prev) / abs(prev) * 100


def _cagr(values: List[tuple[int, float]]) -> Optional[float]:
    if len(values) < 2:
        return None
    sorted_vals = sorted(values, key=lambda x: x[0])
    start_year, start_val = sorted_vals[0]
    end_year, end_val = sorted_vals[-1]
    years = end_year - start_year
    if years <= 0 or start_val <= 0 or end_val <= 0:
        return None
    return (math.pow(end_val / start_val, 1 / years) - 1) * 100


def annual_to_row(annual: AnnualFinancial, prev: Optional[AnnualFinancial]) -> Dict[str, Any]:
    op_margin = None
    if annual.revenue and annual.operating_income is not None:
        op_margin = annual.operating_income / annual.revenue * 100
    return {
        "fiscal_year": annual.fiscal_year,
        "revenue": annual.revenue,
        "operating_income": annual.operating_income,
        "operating_margin_pct": round(op_margin, 2) if op_margin is not None else None,
        "rd_expense": annual.rd_expense,
        "operating_cash_flow": annual.operating_cash_flow,
        "revenue_yoy_pct": _pct_change(annual.revenue, prev.revenue if prev else None),
        "operating_income_yoy_pct": _pct_change(
            annual.operating_income, prev.operating_income if prev else None
        ),
    }


def fetch_financials_payload(ticker: str) -> Dict[str, Any]:
    crawler = FinancialCrawler()
    series = crawler.fetch_annual_financials(ticker)
    if not series.annual:
        return {
            "status": "unavailable",
            "ticker": ticker,
            "source": series.source,
            "message": "재무 공시 데이터를 수집할 수 없습니다.",
            "rows": [],
            "revenue_cagr_3y_pct": None,
            "collected_at": (
                series.collected_at.isoformat() if series.collected_at else None
            ),
        }

    rows: List[Dict[str, Any]] = []
    for i, item in enumerate(series.annual):
        prev = series.annual[i - 1] if i > 0 else None
        rows.append(annual_to_row(item, prev))

    rev_points = [
        (a.fiscal_year, a.revenue)
        for a in series.annual
        if a.revenue is not None and a.revenue > 0
    ]
    cagr = _cagr(rev_points[-4:]) if len(rev_points) >= 2 else None

    return {
        "status": "ok",
        "ticker": ticker,
        "source": series.source,
        "rows": rows,
        "data_years": [a.fiscal_year for a in series.annual],
        "revenue_cagr_3y_pct": round(cagr, 2) if cagr is not None else None,
        "collected_at": (
            series.collected_at.isoformat() if series.collected_at else None
        ),
    }
