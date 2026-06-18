"""연관주 선정 서비스 (하이브리드 룰 기반)."""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Literal, Optional, Set, Tuple

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..data.stock_search_context import (
    get_search_context,
    resolve_competitor_ticker,
)

RelationType = Literal["competitor", "theme", "peer"]

FEATURE_KEYS = ("log_market_cap", "per", "pbr", "change_rate", "vs_avg_20d_pct")
WINDOW_DAYS = 7
MAX_LIMIT = 10

WEIGHT_COMPETITOR = 50.0
WEIGHT_THEME = 25.0
WEIGHT_PEER = 25.0


def _extract_features(stock: models.Stock) -> Dict[str, float]:
    features: Dict[str, float] = {}
    if stock.market_cap and stock.market_cap > 0:
        features["log_market_cap"] = math.log(stock.market_cap)
    if stock.per is not None:
        features["per"] = float(stock.per)
    if stock.pbr is not None:
        features["pbr"] = float(stock.pbr)
    if stock.change_rate is not None:
        features["change_rate"] = float(stock.change_rate)
    if stock.vs_avg_20d_pct is not None:
        features["vs_avg_20d_pct"] = float(stock.vs_avg_20d_pct)
    return features


def _compute_feature_stats(
    stocks: List[models.Stock],
) -> Dict[str, Tuple[float, float]]:
    buckets: Dict[str, List[float]] = defaultdict(list)
    for stock in stocks:
        for key, value in _extract_features(stock).items():
            buckets[key].append(value)

    stats: Dict[str, Tuple[float, float]] = {}
    for key, values in buckets.items():
        if len(values) < 2:
            stats[key] = (values[0], 1.0)
            continue
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        std = math.sqrt(variance) if variance > 0 else 1.0
        stats[key] = (mean, std)
    return stats


def _normalized_feature_distance(
    source: Dict[str, float],
    candidate: Dict[str, float],
    stats: Dict[str, Tuple[float, float]],
) -> float:
    distances: List[float] = []
    for key in FEATURE_KEYS:
        if key not in source or key not in candidate or key not in stats:
            continue
        mean, std = stats[key]
        z_source = (source[key] - mean) / std
        z_candidate = (candidate[key] - mean) / std
        distances.append(abs(z_source - z_candidate))

    if not distances:
        return 1.0
    avg = sum(distances) / len(distances)
    return min(1.0, avg / 4.0)


def _build_name_to_ticker(stocks: List[models.Stock]) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    for stock in stocks:
        if stock.name:
            mapping[stock.name] = stock.ticker
    return mapping


def resolve_competitor_tickers(
    competitor_names: List[str],
    candidates: List[models.Stock],
    *,
    exclude_ticker: Optional[str] = None,
) -> Set[str]:
    name_to_ticker = _build_name_to_ticker(candidates)
    tickers: Set[str] = set()
    for name in competitor_names:
        ticker = resolve_competitor_ticker(name, name_to_ticker)
        if ticker and ticker != exclude_ticker:
            tickers.add(ticker)
    return tickers


def _candidate_keyword_set(
    stock: models.Stock,
    news_keywords: Set[str],
) -> Set[str]:
    ctx = get_search_context(stock.ticker)
    keywords: Set[str] = set(ctx["keywords"])
    keywords.update(news_keywords)
    if stock.name:
        keywords.add(stock.name)
    return {k.strip() for k in keywords if k and k.strip()}


def score_candidate(
    source: models.Stock,
    candidate: models.Stock,
    *,
    competitor_tickers: Set[str],
    source_keywords: Set[str],
    candidate_keywords: Set[str],
    feature_stats: Dict[str, Tuple[float, float]],
) -> Tuple[float, RelationType, str]:
    score = 0.0
    relation_type: RelationType = "peer"
    relation_reason = "시총·PER·모멘텀 유사"

    if candidate.ticker in competitor_tickers:
        score += WEIGHT_COMPETITOR
        relation_type = "competitor"
        source_label = source.name or source.ticker
        relation_reason = f"{source_label} 경쟁사로 매핑"

    if source_keywords and candidate_keywords:
        overlap = source_keywords & candidate_keywords
        if overlap:
            ratio = len(overlap) / max(len(source_keywords), 1)
            score += ratio * WEIGHT_THEME
            if relation_type != "competitor":
                relation_type = "theme"
                joined = "·".join(sorted(overlap)[:3])
                relation_reason = f"{joined} 키워드 공통"

    source_features = _extract_features(source)
    candidate_features = _extract_features(candidate)
    distance = _normalized_feature_distance(source_features, candidate_features, feature_stats)
    score += (1.0 - distance) * WEIGHT_PEER

    return score, relation_type, relation_reason


def _sort_key(item: Tuple[models.Stock, float, RelationType, str]) -> Tuple:
    stock, score, _, _ = item
    return (
        -score,
        -(stock.market_cap or 0),
        -(stock.ai_score or 0),
        -abs(stock.change_rate or 0),
    )


async def _load_news_keywords_by_stock(
    db: AsyncSession,
    stock_ids: List[int],
    *,
    window_days: int = WINDOW_DAYS,
) -> Dict[int, Set[str]]:
    if not stock_ids:
        return {}

    cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)
    result = await db.execute(
        select(models.News)
        .where(
            models.News.stock_id.in_(stock_ids),
            models.News.published_at.isnot(None),
            models.News.published_at >= cutoff,
        )
    )
    keywords_by_stock: Dict[int, Set[str]] = defaultdict(set)
    for article in result.scalars().all():
        if not article.stock_id:
            continue
        for kw in article.hot_keywords or []:
            if kw:
                keywords_by_stock[article.stock_id].add(kw.strip())
    return keywords_by_stock


async def find_related_stocks(
    db: AsyncSession,
    stock: models.Stock,
    *,
    limit: int = MAX_LIMIT,
) -> List[Dict[str, Any]]:
    limit = min(max(limit, 1), MAX_LIMIT)

    query = select(models.Stock).where(
        models.Stock.ticker != stock.ticker,
        or_(
            models.Stock.current_price.isnot(None),
            models.Stock.change_rate.isnot(None),
        ),
    )
    if stock.market:
        query = query.where(models.Stock.market == stock.market)

    result = await db.execute(query)
    candidates = list(result.scalars().all())
    if not candidates:
        return []

    ctx = get_search_context(stock.ticker)
    competitor_tickers = resolve_competitor_tickers(
        ctx["competitors"],
        candidates + [stock],
        exclude_ticker=stock.ticker,
    )

    all_stocks = [stock] + candidates
    feature_stats = _compute_feature_stats(all_stocks)

    stock_ids = [s.id for s in all_stocks if s.id]
    keywords_by_stock = await _load_news_keywords_by_stock(db, stock_ids)

    source_keywords = _candidate_keyword_set(
        stock,
        keywords_by_stock.get(stock.id or -1, set()),
    )

    scored: List[Tuple[models.Stock, float, RelationType, str]] = []
    for candidate in candidates:
        candidate_keywords = _candidate_keyword_set(
            candidate,
            keywords_by_stock.get(candidate.id or -1, set()),
        )
        score, relation_type, relation_reason = score_candidate(
            stock,
            candidate,
            competitor_tickers=competitor_tickers,
            source_keywords=source_keywords,
            candidate_keywords=candidate_keywords,
            feature_stats=feature_stats,
        )
        scored.append((candidate, score, relation_type, relation_reason))

    scored.sort(key=_sort_key)

    items: List[Dict[str, Any]] = []
    for candidate, _, relation_type, relation_reason in scored[:limit]:
        items.append(
            {
                "ticker": candidate.ticker,
                "name": candidate.name or candidate.ticker,
                "current_price": candidate.current_price,
                "change_rate": candidate.change_rate,
                "ai_score": candidate.ai_score,
                "relation_type": relation_type,
                "relation_reason": relation_reason,
            }
        )
    return items
