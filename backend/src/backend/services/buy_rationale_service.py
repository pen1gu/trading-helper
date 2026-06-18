"""5축 매수 근거 규칙 엔진."""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..data.ticker_utils import is_kr_ticker
from .earnings_calendar_service import build_earnings_calendar
from .financials_service import fetch_financials_payload
from .investor_flow_analyzer import analyze_investor_flows
from .news_summary_service import build_news_summary
from .technical_analyzer import BarInput, TechnicalAnalyzer


PILLAR_WEIGHTS = {
    "value": 0.25,
    "quality": 0.25,
    "growth": 0.17,
    "momentum": 0.17,
    "catalyst": 0.16,
}

PILLAR_LABELS = {
    "value": "가치",
    "quality": "질",
    "growth": "성장",
    "momentum": "모멘텀",
    "catalyst": "촉매",
}

CATALYST_KEYWORDS = ("실적", "수주", "계약", "승인", "투자", "신제품", "매출")


def _clamp_score(value: float) -> int:
    return int(max(0, min(100, round(value))))


def _verdict(score: int) -> str:
    if score >= 80:
        return "강력 매수"
    if score >= 65:
        return "매수 검토"
    if score >= 45:
        return "중립"
    return "회피"


def calculate_quant_score(stock: models.Stock) -> int:
    """frontend quant.ts 로직 포팅."""
    score = 0.0

    if stock.roe is not None:
        if stock.roe >= 25:
            score += 40
        elif stock.roe >= 15:
            score += 30
        elif stock.roe >= 10:
            score += 20
        elif stock.roe >= 5:
            score += 10

    if stock.per is not None and stock.per > 0:
        if 10 <= stock.per <= 20:
            score += 15
        elif stock.per < 10:
            score += 10
        elif stock.per <= 30:
            score += 5

    if stock.foreign_ownership is not None:
        if stock.foreign_ownership >= 30:
            score += 15
        elif stock.foreign_ownership >= 15:
            score += 10
        elif stock.foreign_ownership >= 5:
            score += 5

    if stock.pbr is not None and stock.pbr > 0:
        if stock.pbr < 0.8:
            score += 15
        elif stock.pbr < 1.2:
            score += 10
        elif stock.pbr < 2.0:
            score += 5

    if stock.dividend_yield is not None:
        if stock.dividend_yield >= 4:
            score += 10
        elif stock.dividend_yield >= 2:
            score += 5

    market_cap_eok = None
    if stock.market_cap is not None:
        market_cap_eok = (
            stock.market_cap / 100_000_000
            if is_kr_ticker(stock.ticker)
            else stock.market_cap
        )
    if market_cap_eok is not None and 0 < market_cap_eok <= 5000:
        score += 5

    return _clamp_score(score)


def _fmt_pct(value: Optional[float], digits: int = 1) -> str:
    if value is None:
        return "N/A"
    return f"{value:.{digits}f}%"


def _fmt_num(value: Optional[float]) -> str:
    if value is None:
        return "N/A"
    if abs(value) >= 1_000_000_000_000:
        return f"{value / 1_000_000_000_000:.1f}조"
    if abs(value) >= 100_000_000:
        return f"{value / 100_000_000:.0f}억"
    return f"{value:,.0f}"


async def _load_technical_snapshot(
    db: AsyncSession, stock: models.Stock
) -> Dict[str, Any]:
    result = await db.execute(
        select(models.StockDailyBar)
        .where(models.StockDailyBar.stock_id == stock.id)
        .order_by(models.StockDailyBar.trade_date)
        .limit(120)
    )
    bars = list(result.scalars().all())
    if not bars:
        return {}
    inputs = [
        BarInput(
            trade_date=b.trade_date,
            open_price=b.open_price,
            high_price=b.high_price,
            low_price=b.low_price,
            close_price=b.close_price,
            volume=b.volume,
        )
        for b in bars
    ]
    return TechnicalAnalyzer.compute_series(inputs).get("snapshot", {})


async def _load_disclosures(
    db: AsyncSession, stock_id: int, limit: int = 30
) -> List[models.Disclosure]:
    result = await db.execute(
        select(models.Disclosure)
        .where(models.Disclosure.stock_id == stock_id)
        .order_by(desc(models.Disclosure.rcept_dt))
        .limit(limit)
    )
    return list(result.scalars().all())


def _score_value(
    stock: models.Stock,
    insight: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    bullets: List[str] = []
    risks: List[str] = []
    raw = 50.0

    if stock.pbr is not None and stock.pbr > 0:
        if stock.pbr < 1:
            raw += 15
            bullets.append(f"PBR {stock.pbr:.2f} — 순자산 대비 저평가 (출처: pykrx)")
        elif stock.pbr < 1.5:
            raw += 8
            bullets.append(f"PBR {stock.pbr:.2f} — 적정 수준 (출처: pykrx)")
        else:
            risks.append("PBR이 1.5 이상으로 프리미엄 구간입니다.")

    if stock.per is not None and stock.per > 0:
        if stock.per < 12:
            raw += 8
            bullets.append(f"PER {stock.per:.1f}배 (출처: pykrx)")
        elif stock.per > 35:
            risks.append(f"PER {stock.per:.1f}배로 고평가 가능성이 있습니다.")

    deep = (insight or {}).get("deep_value") or {}
    ncav_ratio = deep.get("ncav_to_market_cap")
    if ncav_ratio is not None:
        if ncav_ratio >= 1.0:
            raw += 15
            bullets.append(
                f"NCAV/시총 {ncav_ratio:.2f} — 청산가치 대비 저평가 (출처: DART)"
            )
        elif ncav_ratio >= 0.8:
            raw += 5

    ai = stock.ai_analysis or {}
    fair = ai.get("fair_price_range") or stock.quant_analysis or {}
    if stock.current_price and fair.get("min"):
        if stock.current_price <= fair["min"]:
            raw += 10
            bullets.append(
                f"현재가 {stock.current_price:,.0f} ≤ 적정가 하단 {fair['min']:,.0f} (출처: 퀀트)"
            )
        elif stock.current_price > fair.get("max", stock.current_price):
            risks.append("현재가가 적정가 상단을 상회합니다.")

    if stock.vs_60d_low_pct is not None and stock.vs_60d_low_pct <= 10:
        raw += 5
        bullets.append(
            f"60일 저점 대비 {_fmt_pct(stock.vs_60d_low_pct)} — 저점 근접 (출처: 시세)"
        )

    if not bullets:
        bullets.append("가치 지표 데이터가 부족합니다.")

    return {"score": _clamp_score(raw), "bullets": bullets[:3], "risks": risks[:2]}


def _score_quality(
    stock: models.Stock,
    insight: Optional[Dict[str, Any]],
    flow_snapshot: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    bullets: List[str] = []
    risks: List[str] = []
    quant = calculate_quant_score(stock)
    raw = quant * 0.6

    if stock.roe is not None:
        if stock.roe >= 15:
            raw += 10
            bullets.append(f"ROE {_fmt_pct(stock.roe)} — 수익성 양호 (출처: pykrx)")
        elif stock.roe < 5:
            risks.append(f"ROE {_fmt_pct(stock.roe)}로 자본 효율이 낮습니다.")

    moat = (insight or {}).get("moat_proxy") or {}
    moat_score = moat.get("score")
    if moat_score is not None:
        if moat_score >= 70:
            raw += 10
            bullets.append(f"해자 프록시 점수 {moat_score} (출처: DART)")
        elif moat_score < 40:
            risks.append("경쟁 우위 지표가 약합니다.")

    capital = (insight or {}).get("capital_allocation") or {}
    breakdown = capital.get("breakdown_5y_avg") or {}
    growth_share = (breakdown.get("capex") or 0) + (breakdown.get("rd") or 0)
    if growth_share >= 40:
        raw += 5
        bullets.append(
            f"성장 투자 비중 {_fmt_pct(growth_share)} (출처: DART)"
        )

    if stock.foreign_ownership is not None:
        bullets.append(
            f"외국인 지분율 {_fmt_pct(stock.foreign_ownership)} (출처: pykrx)"
        )
        if stock.foreign_ownership >= 20 and flow_snapshot:
            foreign_5d = flow_snapshot.get("foreign_net_5d")
            if foreign_5d is not None and foreign_5d > 0:
                raw += 5
            elif foreign_5d is not None and foreign_5d < 0:
                risks.append("외국인 지분은 높으나 최근 수급 이탈 중입니다.")

    if not bullets:
        bullets.append(f"퀀트 점수 {quant}/100 (출처: 규칙엔진)")

    return {"score": _clamp_score(raw), "bullets": bullets[:3], "risks": risks[:2]}


def _score_growth(
    insight: Optional[Dict[str, Any]],
    financials: Dict[str, Any],
) -> Dict[str, Any]:
    bullets: List[str] = []
    risks: List[str] = []
    raw = 50.0

    cagr = financials.get("revenue_cagr_3y_pct")
    if cagr is not None:
        if cagr > 10:
            raw += 20
            bullets.append(f"매출 3년 CAGR {_fmt_pct(cagr)} (출처: {financials.get('source', '재무')})")
        elif cagr > 5:
            raw += 12
            bullets.append(f"매출 3년 CAGR {_fmt_pct(cagr)} (출처: {financials.get('source', '재무')})")
        elif cagr < 0:
            risks.append("매출이 감소 추세입니다.")

    rows = financials.get("rows") or []
    if rows:
        latest = rows[-1]
        rev_yoy = latest.get("revenue_yoy_pct")
        if rev_yoy is not None and rev_yoy > 10:
            raw += 8
            bullets.append(f"최근 매출 YoY {_fmt_pct(rev_yoy)} (출처: 재무)")

    rd = (insight or {}).get("rd_efficiency") or {}
    rd_intensity = rd.get("rd_intensity_pct")
    if rd_intensity is not None:
        if rd_intensity >= 10:
            raw += 8
            bullets.append(f"R&D/매출 {_fmt_pct(rd_intensity)} (출처: DART)")
        elif rd_intensity < 3:
            risks.append("R&D 투자 비중이 낮습니다.")

    if not bullets:
        if financials.get("status") == "unavailable":
            bullets.append("성장 지표용 재무 데이터가 없습니다.")
        else:
            bullets.append("성장 모멘텀이 뚜렷하지 않습니다.")

    return {"score": _clamp_score(raw), "bullets": bullets[:3], "risks": risks[:2]}


def _score_momentum(
    stock: models.Stock,
    tech: Dict[str, Any],
    flow_snapshot: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    bullets: List[str] = []
    risks: List[str] = []
    raw = 50.0

    vs_20d = stock.vs_avg_20d_pct if stock.vs_avg_20d_pct is not None else tech.get("vs_ma20_pct")
    if vs_20d is not None:
        if vs_20d > 5:
            raw += 12
            bullets.append(f"20일 평균 대비 {_fmt_pct(vs_20d)} (출처: 시세)")
        elif vs_20d > 0:
            raw += 6
            bullets.append(f"20일 평균 대비 {_fmt_pct(vs_20d)} (출처: 시세)")
        elif vs_20d < -10:
            risks.append("20일 평균 대비 하락 추세입니다.")

    rsi = tech.get("rsi14")
    if rsi is not None:
        if 40 <= rsi <= 70:
            raw += 8
            bullets.append(f"RSI {rsi:.0f} — 과열/과매도 아님 (출처: 기술지표)")
        elif rsi > 75:
            risks.append(f"RSI {rsi:.0f} — 단기 과열 가능성")
        elif rsi < 30:
            bullets.append(f"RSI {rsi:.0f} — 과매도 구간 (출처: 기술지표)")

    alignment = tech.get("ma_alignment")
    if alignment == "bullish":
        raw += 12
        bullets.append("이동평균 정배열 (MA5>MA20>MA60) (출처: 기술지표)")
    elif alignment == "bearish":
        risks.append("이동평균 역배열 — 하락 추세")

    vol_ratio = tech.get("volume_ratio_vs_20d")
    if vol_ratio is not None and vol_ratio >= 1.5:
        raw += 5
        bullets.append(f"거래량 20일 평균 대비 {vol_ratio:.1f}배 (출처: 시세)")

    if flow_snapshot and is_kr_ticker(stock.ticker):
        foreign_5d = flow_snapshot.get("foreign_net_5d")
        if foreign_5d is not None and foreign_5d > 0:
            raw += 10
            bullets.append(
                f"외국인 5일 순매수 {_fmt_num(foreign_5d)} (출처: pykrx)"
            )
        elif foreign_5d is not None and foreign_5d < 0:
            risks.append(f"외국인 5일 순매도 {_fmt_num(abs(foreign_5d))} (출처: pykrx)")

        streak = flow_snapshot.get("flow_streak", 0)
        signal = flow_snapshot.get("flow_signal")
        if streak >= 3 and signal in ("buy", "strong_buy"):
            raw += 8
            bullets.append(
                f"외국인 {streak}일 연속 순매수 (출처: pykrx)"
            )

        vs_ind = flow_snapshot.get("vs_individual")
        if vs_ind == "smart_money_buying":
            raw += 5
            bullets.append("개인 매도, 외국인·기관 매수 — 수급 양호 (출처: pykrx)")

    if not bullets:
        bullets.append("모멘텀 지표 데이터가 부족합니다.")

    return {"score": _clamp_score(raw), "bullets": bullets[:3], "risks": risks[:2]}


def _score_catalyst(
    stock: models.Stock,
    news_summary: Dict[str, Any],
    disclosures: List[models.Disclosure],
    earnings: Dict[str, Any],
) -> Dict[str, Any]:
    bullets: List[str] = []
    risks: List[str] = []
    raw = 50.0
    today = date.today()

    avg_sent = news_summary.get("avg_sentiment")
    if avg_sent is not None:
        if avg_sent >= 65:
            raw += 15
            bullets.append(
                f"최근 7일 뉴스 감성 {avg_sent:.0f}pt (출처: 뉴스)"
            )
        elif avg_sent <= 40:
            risks.append(f"최근 7일 뉴스 감성 {avg_sent:.0f}pt — 부정적")

    keywords = news_summary.get("top_keywords") or []
    catalyst_hits = [k for k in keywords if any(w in k for w in CATALYST_KEYWORDS)]
    if catalyst_hits:
        raw += 8
        bullets.append(
            f"촉매 키워드: {', '.join(catalyst_hits[:3])} (출처: 뉴스)"
        )

    ai = stock.ai_analysis or {}
    if ai.get("hot_reason"):
        raw += 5
        bullets.append(f"{ai['hot_reason'][:80]} (출처: AI)")

    for disc in disclosures:
        if disc.report_type != "earnings":
            continue
        days_ago = (today - disc.rcept_dt).days
        if days_ago <= 7:
            raw += 15
            bullets.append(
                f"{days_ago}일 전 실적 공시: {disc.report_nm[:40]} (출처: DART)"
            )
            break

    days_to_next = earnings.get("days_to_next")
    if days_to_next is not None and 0 < days_to_next <= 14:
        raw += 10
        bullets.append(
            f"실적 발표 예상 D-{days_to_next} (출처: DART 패턴)"
        )

    for disc in disclosures:
        days_ago = (today - disc.rcept_dt).days
        if days_ago > 30:
            continue
        if disc.report_type == "dividend":
            raw += 5
            bullets.append(f"{days_ago}일 전 배당 공시 (출처: DART)")
        elif disc.report_type == "capital":
            raw -= 8
            risks.append(f"{days_ago}일 전 {disc.report_nm[:30]} — 희석 리스크 (출처: DART)")

    if not bullets:
        bullets.append("최근 뚜렷한 촉매 이벤트가 없습니다.")

    return {"score": _clamp_score(raw), "bullets": bullets[:3], "risks": risks[:2]}


def _iso_dt(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


async def build_buy_rationale(
    db: AsyncSession,
    stock: models.Stock,
) -> Dict[str, Any]:
    insight = stock.business_insight if stock.business_insight else None

    tech_task = _load_technical_snapshot(db, stock)
    news_task = build_news_summary(db, stock)
    fin_task = asyncio.to_thread(fetch_financials_payload, stock.ticker)

    if stock.id:
        disc_task = _load_disclosures(db, stock.id)
    else:
        async def _empty_disc() -> List[models.Disclosure]:
            return []
        disc_task = _empty_disc()

    if stock.id and is_kr_ticker(stock.ticker):
        flow_task = analyze_investor_flows(db, stock)
        earn_task = build_earnings_calendar(db, stock)
    else:
        async def _empty_flow() -> Dict[str, Any]:
            return {}
        async def _unsupported_earn() -> Dict[str, Any]:
            return {"status": "unsupported"}
        flow_task = _empty_flow()
        earn_task = _unsupported_earn()

    tech, news_summary, financials, disclosures, flow_data, earnings = await asyncio.gather(
        tech_task, news_task, fin_task, disc_task, flow_task, earn_task
    )

    flow_snapshot = flow_data.get("snapshot") if flow_data else None

    pillar_results = {
        "value": _score_value(stock, insight),
        "quality": _score_quality(stock, insight, flow_snapshot),
        "growth": _score_growth(insight, financials),
        "momentum": _score_momentum(stock, tech, flow_snapshot),
        "catalyst": _score_catalyst(stock, news_summary, disclosures, earnings),
    }

    pillars = [
        {
            "id": pid,
            "score": pillar_results[pid]["score"],
            "label": PILLAR_LABELS[pid],
            "bullets": pillar_results[pid]["bullets"],
            "risks": pillar_results[pid]["risks"],
        }
        for pid in PILLAR_WEIGHTS
    ]

    overall = _clamp_score(
        sum(p["score"] * PILLAR_WEIGHTS[p["id"]] for p in pillars)
    )

    return {
        "status": "ok",
        "ticker": stock.ticker,
        "overall_score": overall,
        "verdict": _verdict(overall),
        "pillars": pillars,
        "data_freshness": {
            "quote": _iso_dt(stock.data_collected_at),
            "financials": _iso_dt(stock.financials_collected_at)
            or financials.get("collected_at"),
            "news": _iso_dt(stock.news_collected_at),
            "disclosures": _iso_dt(
                disclosures[0].collected_at if disclosures else None
            ),
            "investor_flow": _iso_dt(flow_data.get("last_collected_at")),
        },
    }
