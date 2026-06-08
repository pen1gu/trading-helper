"""재무 시계열 기반 규칙형 사업·경영 분석."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .financial_crawler import AnnualFinancial, FinancialSeries


def _pct(numerator: Optional[float], denominator: Optional[float]) -> Optional[float]:
    if numerator is None or denominator in (None, 0):
        return None
    return numerator / denominator * 100


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


def _std(values: List[float]) -> float:
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    return math.sqrt(variance)


def _clamp_score(value: float, low: float = 0, high: float = 100) -> int:
    return int(max(low, min(high, round(value))))


def _growth_volatility(rates: List[float]) -> float:
    if len(rates) < 2:
        return 0.0
    return _std(rates)


class BusinessAnalyzer:
    @staticmethod
    def compute(series: FinancialSeries) -> Dict[str, Any]:
        annual = series.annual
        if not annual:
            return {
                "status": "unavailable",
                "message": "재무 공시 데이터를 수집할 수 없습니다.",
                "source": series.source,
                "collected_at": (
                    series.collected_at.isoformat() if series.collected_at else None
                ),
            }

        moat = BusinessAnalyzer._compute_moat_proxy(annual)
        rd_eff = BusinessAnalyzer._compute_rd_efficiency(annual)
        capital = BusinessAnalyzer._compute_capital_allocation(annual)

        latest = annual[-1]
        if latest.rd_expense is None and latest.capex is None and latest.revenue:
            rd_eff["interpretation"] = (
                "금융업 등 R&D/CapEx 지표가 무의미한 업종으로, "
                "해당 항목 해석이 제한됩니다."
            )

        return {
            "status": "ok",
            "moat_proxy": moat,
            "rd_efficiency": rd_eff,
            "capital_allocation": capital,
            "data_years": [a.fiscal_year for a in annual],
            "source": series.source,
            "collected_at": (
                series.collected_at.isoformat() if series.collected_at else None
            ),
        }

    @staticmethod
    def _compute_moat_proxy(annual: List[AnnualFinancial]) -> Dict[str, Any]:
        latest = annual[-1]
        raw_deferred = (
            latest.contract_liabilities / latest.revenue
            if latest.contract_liabilities and latest.revenue
            else None
        )
        deferred_ratio = min(raw_deferred, 1.0) if raw_deferred is not None else None

        gross_margins: List[float] = []
        for a in annual:
            margin = _pct(a.gross_profit, a.revenue)
            if margin is not None:
                gross_margins.append(margin)
        margin_stability = _std(gross_margins) if gross_margins else None

        growth_rates: List[float] = []
        for i in range(1, len(annual)):
            prev, curr = annual[i - 1], annual[i]
            if prev.revenue and curr.revenue and prev.revenue > 0:
                growth_rates.append((curr.revenue - prev.revenue) / prev.revenue * 100)
        growth_vol = _growth_volatility(growth_rates)

        deferred_score = 0.0
        if deferred_ratio is not None:
            deferred_score = min(deferred_ratio / 0.3 * 100, 100)

        stability_score = 0.0
        if margin_stability is not None:
            stability_score = max(0, 100 - margin_stability * 5)

        consistency_score = 0.0
        if growth_vol is not None:
            consistency_score = max(0, 100 - growth_vol * 3)

        score = _clamp_score(
            deferred_score * 0.4 + stability_score * 0.35 + consistency_score * 0.25
        )

        if score >= 70:
            interpretation = (
                "계약부채·마진 안정성이 높아 고객 이탈 비용이 상대적으로 클 가능성이 있습니다."
            )
        elif score >= 40:
            interpretation = (
                "일부 lock-in 신호가 있으나 업종 특성을 함께 확인해야 합니다."
            )
        else:
            interpretation = (
                "재무 지표상 전환 비용이 낮을 수 있어 점유율만으로는 방어가 어려울 수 있습니다."
            )

        return {
            "score": score,
            "deferred_revenue_ratio": round(deferred_ratio, 4) if deferred_ratio else None,
            "gross_margin_stability": round(margin_stability, 4) if margin_stability is not None else None,
            "revenue_growth_volatility": round(growth_vol, 4) if growth_rates else None,
            "interpretation": interpretation,
            "label": "전환 비용 프록시",
        }

    @staticmethod
    def _compute_rd_efficiency(annual: List[AnnualFinancial]) -> Dict[str, Any]:
        latest = annual[-1]
        rd_intensity = _pct(latest.rd_expense, latest.revenue)

        rd_values = [(a.fiscal_year, a.rd_expense) for a in annual if a.rd_expense]
        rev_values = [(a.fiscal_year, a.revenue) for a in annual if a.revenue]
        rd_cagr = _cagr([(y, v) for y, v in rd_values if v])
        rev_cagr = _cagr([(y, v) for y, v in rev_values if v])
        rd_vs_rev = (rd_cagr - rev_cagr) if rd_cagr is not None and rev_cagr is not None else None

        capex_dep = None
        if latest.capex and latest.depreciation and latest.depreciation > 0:
            capex_dep = latest.capex / latest.depreciation

        op_margins: List[float] = []
        for a in annual:
            margin = _pct(a.operating_income, a.revenue)
            if margin is not None:
                op_margins.append(margin)
        margin_trend = 0.0
        if len(op_margins) >= 2:
            margin_trend = op_margins[-1] - op_margins[0]

        intensity_score = min((rd_intensity or 0) / 15 * 100, 100)
        growth_score = 50.0
        if rd_vs_rev is not None:
            growth_score = _clamp_score(50 + rd_vs_rev * 5)
        capex_score = 50.0
        if capex_dep is not None:
            if capex_dep >= 1.5:
                capex_score = 80
            elif capex_dep >= 1.0:
                capex_score = 60
            else:
                capex_score = 30
        trend_score = _clamp_score(50 + margin_trend * 2)

        score = _clamp_score(
            intensity_score * 0.3 + growth_score * 0.3 + capex_score * 0.25 + trend_score * 0.15
        )

        parts: List[str] = []
        if rd_intensity is not None:
            parts.append(f"R&D/매출 {rd_intensity:.1f}%")
        if rd_vs_rev is not None:
            direction = "앞서" if rd_vs_rev > 0 else "뒤처"
            parts.append(f"R&D 성장이 매출 성장보다 {direction} 있습니다")
        if capex_dep is not None:
            if capex_dep >= 1.5:
                parts.append("CapEx가 감가상각 대비 충분해 성장 투자 비중이 높아 보입니다")
            elif capex_dep < 1.0:
                parts.append("CapEx가 감가상각보다 낮아 유지보수 위주일 수 있습니다")

        interpretation = ". ".join(parts) + "." if parts else "R&D 관련 데이터가 제한적입니다."

        return {
            "score": score,
            "rd_intensity_pct": round(rd_intensity, 2) if rd_intensity else None,
            "rd_vs_revenue_growth": round(rd_vs_rev, 2) if rd_vs_rev is not None else None,
            "capex_to_depreciation": round(capex_dep, 2) if capex_dep else None,
            "operating_margin_trend": round(margin_trend, 2) if op_margins else None,
            "interpretation": interpretation,
            "label": "R&D 효율",
        }

    @staticmethod
    def _compute_capital_allocation(annual: List[AnnualFinancial]) -> Dict[str, Any]:
        totals = {"capex": 0.0, "rd": 0.0, "dividends": 0.0, "buybacks": 0.0, "debt": 0.0}
        count = 0

        for a in annual:
            ocf = a.operating_cash_flow
            if ocf is None or ocf <= 0:
                pool = sum(
                    v or 0
                    for v in [a.capex, a.rd_expense, a.dividends, a.buybacks, a.debt_repayment]
                )
                if pool <= 0:
                    continue
            else:
                pool = ocf

            count += 1
            totals["capex"] += _pct(a.capex, pool) or 0
            totals["rd"] += _pct(a.rd_expense, pool) or 0
            totals["dividends"] += _pct(a.dividends, pool) or 0
            totals["buybacks"] += _pct(a.buybacks, pool) or 0
            totals["debt"] += _pct(a.debt_repayment, pool) or 0

        if count == 0:
            return {
                "score": 0,
                "profile": "unknown",
                "breakdown_5y_avg": {},
                "long_term_signal": "unknown",
                "interpretation": "자본 배치 데이터가 부족합니다.",
                "label": "자본 배치",
            }

        breakdown = {k: round(v / count, 1) for k, v in totals.items()}

        profile = max(breakdown, key=breakdown.get)
        profile_map = {
            "capex": "growth",
            "rd": "growth",
            "dividends": "shareholder_return",
            "buybacks": "shareholder_return",
            "debt": "deleveraging",
        }
        allocation_profile = profile_map.get(profile, "balanced")
        if breakdown.get("capex", 0) + breakdown.get("rd", 0) > 40:
            allocation_profile = "growth"
        elif breakdown.get("dividends", 0) + breakdown.get("buybacks", 0) > 40:
            allocation_profile = "shareholder_return"

        growth_shares: List[float] = []
        for a in annual:
            ocf = a.operating_cash_flow or 1
            growth_shares.append(
                ((_pct(a.capex, ocf) or 0) + (_pct(a.rd_expense, ocf) or 0))
            )
        long_term_signal = "stable"
        if len(growth_shares) >= 2:
            if growth_shares[-1] > growth_shares[0] + 5:
                long_term_signal = "increasing"
            elif growth_shares[-1] < growth_shares[0] - 5:
                long_term_signal = "decreasing"

        growth_score = min(breakdown.get("capex", 0) + breakdown.get("rd", 0), 100)
        long_term_bonus = 15 if long_term_signal == "increasing" else 0
        score = _clamp_score(growth_score * 0.7 + long_term_bonus + 15)

        profile_labels = {
            "growth": "성장 투자(CapEx·R&D) 중심",
            "balanced": "균형 배분",
            "shareholder_return": "주주 환원(배당·자사주) 중심",
            "deleveraging": "부채 상환 중심",
        }
        signal_labels = {
            "increasing": "장기 투자 비중이 증가 추세입니다.",
            "decreasing": "장기 투자 비중이 감소 추세입니다.",
            "stable": "장기 투자 비중이 안정적입니다.",
        }

        interpretation = (
            f"{profile_labels.get(allocation_profile, '균형 배분')} 경향입니다. "
            f"{signal_labels.get(long_term_signal, '')}"
        )

        return {
            "score": score,
            "profile": allocation_profile,
            "breakdown_5y_avg": breakdown,
            "long_term_signal": long_term_signal,
            "interpretation": interpretation,
            "label": "자본 배치",
        }


def fetch_and_analyze(ticker: str) -> Dict[str, Any]:
    from .financial_crawler import FinancialCrawler

    crawler = FinancialCrawler()
    series = crawler.fetch_annual_financials(ticker)
    return BusinessAnalyzer.compute(series)
