"""뉴스 감성 점수 — 규칙 기반 휴리스틱 (Gemini 미사용)."""

from __future__ import annotations

from typing import Iterable, Optional

NEUTRAL_SCORE = 50
TITLE_POS_WEIGHT = 10
TITLE_NEG_WEIGHT = 10
BODY_POS_WEIGHT = 5
BODY_NEG_WEIGHT = 5

_POSITIVE_KEYWORDS: tuple[str, ...] = (
    # Korean
    "상승",
    "급등",
    "호실적",
    "흑자",
    "신고가",
    "돌파",
    "수주",
    "계약",
    "승인",
    "성장",
    "확대",
    "개선",
    "호조",
    "강세",
    "반등",
    "회복",
    "목표가 상향",
    "목표가↑",
    "매수",
    "추천",
    "호재",
    "파트너십",
    "투자 유치",
    "실적 개선",
    "영업이익 증가",
    "매출 증가",
    # English
    "surge",
    "rally",
    "beat",
    "beats",
    "upgrade",
    "upgraded",
    "record high",
    "all-time high",
    "profit",
    "growth",
    "strong",
    "outperform",
    "buy rating",
    "raises target",
    "raised target",
    "bullish",
    "recovery",
    "rebound",
    "win",
    "wins",
    "deal",
    "partnership",
    "approval",
)

_NEGATIVE_KEYWORDS: tuple[str, ...] = (
    # Korean
    "하락",
    "급락",
    "적자",
    "손실",
    "실적 부진",
    "매출 감소",
    "영업이익 감소",
    "약세",
    "조정",
    "하향",
    "목표가 하향",
    "목표가↓",
    "매도",
    "경고",
    "리콜",
    "규제",
    "제재",
    "소송",
    "분쟁",
    "파산",
    "구조조정",
    "감원",
    "적발",
    "횡령",
    "사기",
    "악재",
    "우려",
    "리스크",
    "지연",
    "취소",
    "철회",
    # English
    "fall",
    "falls",
    "drop",
    "plunge",
    "slump",
    "miss",
    "misses",
    "downgrade",
    "downgraded",
    "loss",
    "losses",
    "weak",
    "underperform",
    "sell rating",
    "cuts target",
    "cut target",
    "bearish",
    "recall",
    "lawsuit",
    "investigation",
    "fraud",
    "bankruptcy",
    "delay",
    "delayed",
    "cancel",
    "cancelled",
    "warning",
    "concern",
    "risk",
)


def _count_matches(text: str, keywords: Iterable[str]) -> int:
    lowered = text.lower()
    return sum(1 for kw in keywords if kw in lowered or kw in text)


def score_news_sentiment(title: str, body: Optional[str] = None) -> int:
    """제목·본문 키워드 매칭으로 0~100 감성 점수를 반환합니다."""
    title_text = (title or "").strip()
    body_text = (body or "").strip()

    delta = 0
    delta += _count_matches(title_text, _POSITIVE_KEYWORDS) * TITLE_POS_WEIGHT
    delta -= _count_matches(title_text, _NEGATIVE_KEYWORDS) * TITLE_NEG_WEIGHT

    if body_text:
        delta += _count_matches(body_text, _POSITIVE_KEYWORDS) * BODY_POS_WEIGHT
        delta -= _count_matches(body_text, _NEGATIVE_KEYWORDS) * BODY_NEG_WEIGHT

    return max(0, min(100, NEUTRAL_SCORE + delta))
