"""관심 종목·시세 유니버스 (최대 100종목)."""

# Gemini 전체 분석(뉴스·AI 점수)
AI_WATCHLIST_TICKERS = ["005930", "AAPL", "NVDA", "000660", "TSLA", "INTC", "BA"]

# 시세만 갱신 (AI 미실행) — AI 목록과 합쳐 유니크 최대 100
_PRICE_UNIVERSE_RAW = [
    # 국내 (Top 1000은 동적 수집 예정)
    "005930", "000660", "035420",
    # 미국 확장 (Top 1000 샘플)
    "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "META", "TSLA", "BRK-B", "AVGO",
    "JPM", "LLY", "V", "UNH", "XOM", "MA", "COST", "HD", "PG", "JNJ",
    "ORCL", "BAC", "ABBV", "CRM", "NFLX", "AMD", "INTC", "QCOM", "TXN", "AMAT",
    "MU", "LRCX", "KLAC", "ADI", "SNPS", "CDNS", "MRVL", "IBM", "NOW", "UBER",
    "BA", "DIS", "NKE", "PEP", "KO", "WMT", "CSCO", "ACN", "LIN", "PM",
    "RTX", "HON", "LOW", "UPS", "SBUX", "GS", "MS", "BLK", "AXP", "CAT",
    "DE", "PLTR", "COIN", "SQ", "SHOP", "PYPL", "ABNB", "ARM", "SMCI", "DELL",
    "PANW", "CRWD", "SNOW", "DDOG", "NET", "ZS", "FTNT", "MDB", "TEAM", "WDAY",
    "ADBE", "INTU", "BKNG", "MELI", "PDD", "BABA", "JD", "NIO", "RIVN", "LCID",
    "F", "GM", "T", "VZ", "VZ", "PFE", "MRK", "BMY", "AMGN", "GILD", "GILD",
    "SHEL", "TTE", "BP", "HSBC", "RY", "TD", "BMO", "BNS", "SAN", "BBVA",
    "UBS", "CS", "DB", "BNP", "ING", "ASML", "SAP", "SONY", "TM", "HMC",
    "NVO", "NVS", "AZN", "GSK", "SNY", "RIO", "BHP", "VALE", "FCX", "NEM",
    "GE", "MMM", "CAT", "DE", "HON", "LMT", "GD", "NOC", "RTX", "BA",
    "CVS", "UNH", "ELV", "CI", "HUM", "CNC", "WBA", "WMT", "TGT", "COST",
    "KR", "FDX", "UPS", "DAL", "UAL", "AAL", "LUV", "MAR", "HLT", "BKNG",
    "EXPE", "ABNB", "DIS", "NFLX", "CMCSA", "CHTR", "VZ", "T", "TMUS", "LUMN",
    "AMT", "PLD", "CCI", "EQIX", "PSA", "DLR", "O", "VICI", "WY", "SBAC",
    "DUK", "SO", "NEE", "AEP", "EXC", "D", "XEL", "ED", "PEG", "WEC",
    "JPM", "BAC", "WFC", "C", "MS", "GS", "USB", "PNC", "TFC", "COF",
    # ... (이하 생략, 실제 운영 시에는 더 많은 티커 리스트를 파일이나 DB에서 관리 권장)
]

_seen: set[str] = set()
PRICE_UNIVERSE_TICKERS: list[str] = []
for _t in _PRICE_UNIVERSE_RAW:
    if _t not in _seen and len(PRICE_UNIVERSE_TICKERS) < 100:
        _seen.add(_t)
        PRICE_UNIVERSE_TICKERS.append(_t)

# 하위 호환
WATCHLIST_TICKERS = AI_WATCHLIST_TICKERS

MAX_PICKS = 100
TOP_N_BRIEFING = 3
TOP_N_REPORT = 5

TICKER_NAME_OVERRIDES = {
    "005930": "삼성전자",
    "000660": "SK하이닉스",
    "035420": "NAVER",
    "005380": "현대차",
    "051910": "LG화학",
    "006400": "삼성SDI",
    "035720": "카카오",
    "003670": "포스코퓨처엠",
    "028260": "삼성물산",
    "105560": "KB금융",
    "055550": "신한지주",
    "032830": "삼성생명",
    "034730": "SK",
    "015760": "한국전력",
    "009150": "삼성전기",
    "012330": "현대모비스",
    "066570": "LG전자",
    "003550": "LG",
    "017670": "SK텔레콤",
    "030200": "KT",
}
