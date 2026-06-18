"""종목별 뉴스 검색 키워드·경쟁사 매핑."""

from __future__ import annotations

from typing import Dict, List, Literal, Optional, TypedDict

MAX_NEWS_QUERIES = 6


class SearchContext(TypedDict):
    keywords: List[str]
    competitors: List[str]


STOCK_SEARCH_CONTEXT: Dict[str, SearchContext] = {
    # 국내 주요
    "005930": {
        "keywords": ["반도체", "메모리", "HBM", "파운드리", "갤럭시"],
        "competitors": ["SK하이닉스", "LG전자", "TSMC", "마이크론", "인텔"],
    },
    "000660": {
        "keywords": ["반도체", "메모리", "HBM", "DRAM", "낸드"],
        "competitors": ["삼성전자", "마이크론", "TSMC", "인텔"],
    },
    "035420": {
        "keywords": ["검색", "클라우드", "AI", "플랫폼", "광고"],
        "competitors": ["카카오", "구글", "메타", "아마존"],
    },
    "035720": {
        "keywords": ["모빌리티", "핀테크", "플랫폼", "AI", "카카오톡"],
        "competitors": ["네이버", "우버", "토스"],
    },
    "005380": {
        "keywords": ["전기차", "자율주행", "수소", "SUV", "수출"],
        "competitors": ["기아", "테슬라", "도요타", "GM"],
    },
    "051910": {
        "keywords": ["배터리", "화학", "소재", "전기차", "양극재"],
        "competitors": ["삼성SDI", "포스코퓨처엠", "CATL", "SK온"],
    },
    "006400": {
        "keywords": ["배터리", "ESS", "전기차", "양극재", "리튬"],
        "competitors": ["LG화학", "CATL", "파나소닉", "SK온"],
    },
    "066570": {
        "keywords": ["가전", "OLED", "TV", "에어컨", "전자"],
        "competitors": ["삼성전자", "소니", "하이센스"],
    },
    # 미국 주요
    "AAPL": {
        "keywords": ["iPhone", "AI", "서비스", "반도체", "비전프로"],
        "competitors": ["삼성", "구글", "마이크로소프트", "화웨이"],
    },
    "NVDA": {
        "keywords": ["AI칩", "GPU", "데이터센터", "HBM", "루빈"],
        "competitors": ["AMD", "인텔", "구글", "마이크로소프트"],
    },
    "MSFT": {
        "keywords": ["클라우드", "Azure", "AI", "Copilot", "오피스"],
        "competitors": ["구글", "아마존", "애플", "오라클"],
    },
    "GOOGL": {
        "keywords": ["검색", "AI", "클라우드", "광고", "Gemini"],
        "competitors": ["마이크로소프트", "메타", "아마존", "오픈AI"],
    },
    "AMZN": {
        "keywords": ["AWS", "클라우드", "이커머스", "AI", "물류"],
        "competitors": ["마이크로소프트", "구글", "월마트", "알리바바"],
    },
    "META": {
        "keywords": ["AI", "광고", "메타버스", "LLaMA", "인스타그램"],
        "competitors": ["구글", "틱톡", "스냅", "애플"],
    },
    "TSLA": {
        "keywords": ["전기차", "FSD", "배터리", "로보택시", "에너지"],
        "competitors": ["BYD", "현대차", "GM", "리비안"],
    },
    "AMD": {
        "keywords": ["CPU", "GPU", "AI칩", "데이터센터", "MI300"],
        "competitors": ["엔비디아", "인텔", "퀄컴"],
    },
    "INTC": {
        "keywords": ["파운드리", "CPU", "AI", "반도체", "제조"],
        "competitors": ["TSMC", "삼성전자", "AMD", "엔비디아"],
    },
    "BA": {
        "keywords": ["항공", "737", "787", "수주", "안전"],
        "competitors": ["에어버스", "롤스로이스"],
    },
}


# 경쟁사 표기 → 티커 (DB 유니버스 기준)
COMPETITOR_ALIASES: Dict[str, str] = {
    "SK하이닉스": "000660",
    "삼성전자": "005930",
    "LG전자": "066570",
    "LG화학": "051910",
    "삼성SDI": "006400",
    "포스코퓨처엠": "003670",
    "카카오": "035720",
    "네이버": "035420",
    "NAVER": "035420",
    "현대차": "005380",
    "기아": "000270",
    "테슬라": "TSLA",
    "TSLA": "TSLA",
    "AMD": "AMD",
    "인텔": "INTC",
    "Intel": "INTC",
    "INTC": "INTC",
    "엔비디아": "NVDA",
    "NVDA": "NVDA",
    "구글": "GOOGL",
    "Google": "GOOGL",
    "GOOGL": "GOOGL",
    "마이크로소프트": "MSFT",
    "MSFT": "MSFT",
    "애플": "AAPL",
    "Apple": "AAPL",
    "AAPL": "AAPL",
    "아마존": "AMZN",
    "AMZN": "AMZN",
    "메타": "META",
    "META": "META",
    "GM": "GM",
    "BYD": "BYD",
    "리비안": "RIVN",
    "RIVN": "RIVN",
    "마이크론": "MU",
    "MU": "MU",
    "퀄컴": "QCOM",
    "QCOM": "QCOM",
    "오라클": "ORCL",
    "ORCL": "ORCL",
    "월마트": "WMT",
    "WMT": "WMT",
    "알리바바": "BABA",
    "BABA": "BABA",
}


def get_search_context(ticker: str) -> SearchContext:
    return STOCK_SEARCH_CONTEXT.get(
        ticker,
        {"keywords": [], "competitors": []},
    )


def resolve_competitor_ticker(name: str, name_to_ticker: Dict[str, str]) -> Optional[str]:
    """경쟁사 이름을 티커로 해석합니다. alias 우선, 없으면 name_to_ticker 맵 사용."""
    name = name.strip()
    if not name:
        return None
    if name in COMPETITOR_ALIASES:
        return COMPETITOR_ALIASES[name]
    if name in name_to_ticker:
        return name_to_ticker[name]
    lowered = name.lower()
    for alias, ticker in COMPETITOR_ALIASES.items():
        if alias.lower() == lowered:
            return ticker
    for stock_name, ticker in name_to_ticker.items():
        if stock_name and (name in stock_name or stock_name in name):
            return ticker
    return None


def build_news_queries(ticker: str, name: str) -> List[str]:
    """Google News RSS 검색 쿼리 목록 (최대 MAX_NEWS_QUERIES개)."""
    label = (name or ticker).strip()
    ctx = get_search_context(ticker)
    queries: List[str] = []

    if label:
        queries.append(f"{label} 주식")
    if ticker and ticker != label:
        queries.append(ticker)

    for kw in ctx["keywords"]:
        if label:
            queries.append(f"{label} {kw}")
        else:
            queries.append(kw)

    for comp in ctx["competitors"]:
        if label:
            queries.append(f"{label} {comp}")
        else:
            queries.append(comp)

    seen: set[str] = set()
    unique: List[str] = []
    for q in queries:
        q = q.strip()
        if not q or q in seen:
            continue
        seen.add(q)
        unique.append(q)
        if len(unique) >= MAX_NEWS_QUERIES:
            break

    return unique


def extract_hot_keywords(title: str, ticker: str) -> List[str]:
    """제목에 포함된 키워드·경쟁사를 hot_keywords로 추출."""
    ctx = get_search_context(ticker)
    candidates = ctx["keywords"] + ctx["competitors"]
    matched = [kw for kw in candidates if kw in title]
    return matched[:5]
