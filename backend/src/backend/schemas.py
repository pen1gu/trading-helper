from datetime import date, datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict

class StockBase(BaseModel):
    ticker: str
    name: Optional[str] = None
    market: Optional[str] = None
    trade_date: Optional[date] = None
    current_price: Optional[float] = None
    day_open: Optional[float] = None
    day_high: Optional[float] = None
    day_low: Optional[float] = None
    day_close: Optional[float] = None
    prev_close: Optional[float] = None
    change_rate: Optional[float] = None
    change_amount: Optional[float] = None
    volume: Optional[int] = None
    volume_change_rate: Optional[float] = None
    day_range_pct: Optional[float] = None
    quote_source: Optional[str] = None
    data_collected_at: Optional[datetime] = None
    close_max_5d: Optional[float] = None
    close_min_5d: Optional[float] = None
    close_avg_5d: Optional[float] = None
    high_max_5d: Optional[float] = None
    low_min_5d: Optional[float] = None
    volume_avg_5d: Optional[float] = None
    close_max_20d: Optional[float] = None
    close_min_20d: Optional[float] = None
    close_avg_20d: Optional[float] = None
    high_max_20d: Optional[float] = None
    low_min_20d: Optional[float] = None
    volume_avg_20d: Optional[float] = None
    close_max_60d: Optional[float] = None
    close_min_60d: Optional[float] = None
    close_avg_60d: Optional[float] = None
    high_max_60d: Optional[float] = None
    low_min_60d: Optional[float] = None
    volume_avg_60d: Optional[float] = None
    vs_avg_20d_pct: Optional[float] = None
    vs_60d_high_pct: Optional[float] = None
    vs_60d_low_pct: Optional[float] = None
    market_cap: Optional[float] = None
    per: Optional[float] = None
    pbr: Optional[float] = None
    roe: Optional[float] = None
    dividend_yield: Optional[float] = None
    foreign_ownership: Optional[float] = None
    eps: Optional[float] = None
    beta: Optional[float] = None
    fifty_two_week_high: Optional[float] = None
    fifty_two_week_low: Optional[float] = None
    avg_volume_10d: Optional[float] = None
    ai_score: Optional[int] = None
    ai_recommendation: Optional[str] = None
    ai_analysis: Optional[Dict] = None
    quant_analysis: Optional[Dict] = None
    is_crawling_target: bool = False
    business_insight: Optional[Dict] = None
    financials_collected_at: Optional[datetime] = None
    news_collected_at: Optional[datetime] = None

class StockCreate(StockBase):
    pass

class Stock(StockBase):
    id: int
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class StockDailyBarBase(BaseModel):
    trade_date: date
    open_price: Optional[float] = None
    high_price: Optional[float] = None
    low_price: Optional[float] = None
    close_price: Optional[float] = None
    volume: Optional[int] = None
    change_rate: Optional[float] = None


class StockDailyBar(StockDailyBarBase):
    id: int
    stock_id: int
    model_config = ConfigDict(from_attributes=True)


class WatchlistBase(BaseModel):
    ticker: str


class Watchlist(WatchlistBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class RecentViewBase(BaseModel):
    ticker: str


class RecentView(RecentViewBase):
    id: int
    viewed_at: datetime
    model_config = ConfigDict(from_attributes=True)


class NewsBase(BaseModel):
    title: str
    content: Optional[str] = None
    url: Optional[str] = None
    source: Optional[str] = None
    published_at: Optional[datetime] = None
    sentiment_score: Optional[int] = None
    summary: Optional[str] = None
    hot_keywords: Optional[List[str]] = None
    stock_id: Optional[int] = None

class NewsCreate(NewsBase):
    pass

class News(NewsBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ReportHighlight(BaseModel):
    type: str
    text: str


class KeyMetrics(BaseModel):
    trade_date: Optional[date] = None
    current_price: Optional[float] = None
    prev_close: Optional[float] = None
    change_rate: Optional[float] = None
    change_amount: Optional[float] = None
    day_open: Optional[float] = None
    day_high: Optional[float] = None
    day_low: Optional[float] = None
    volume: Optional[int] = None
    close_avg_20d: Optional[float] = None
    close_max_60d: Optional[float] = None
    close_min_60d: Optional[float] = None
    vs_avg_20d_pct: Optional[float] = None
    vs_60d_high_pct: Optional[float] = None
    vs_60d_low_pct: Optional[float] = None
    per: Optional[float] = None
    pbr: Optional[float] = None


class TopPick(BaseModel):
    ticker: str
    name: str
    hot_reason: str
    news_url: Optional[str] = None
    change_rate: Optional[float] = None
    current_price: Optional[float] = None
    price: Optional[float] = None  # frontend compatibility
    ai_score: Optional[int] = None
    key_metrics: Optional[KeyMetrics] = None


class CompanyReport(BaseModel):
    ticker: str
    name: str
    position: str
    lines: List[str] = []
    news_citations: List[str] = []


class MarketIndex(BaseModel):
    name: str
    price: Optional[float] = None
    change: Optional[float] = None


class DailyReportResponse(BaseModel):
    market_summary: str
    highlights: List[ReportHighlight] = []
    long_picks: List[TopPick] = []
    short_picks: List[TopPick] = []
    company_reports: List[CompanyReport] = []
    data_source: str = "empty"  # live | empty
    indices: List[MarketIndex] = []
    updated_at: Optional[datetime] = None
    next_refresh_at: Optional[datetime] = None
    data_collected_at: Optional[datetime] = None
    news_collected_at: Optional[datetime] = None
    report_generated_at: Optional[datetime] = None


class RefreshReportResponse(BaseModel):
    message: str
    updated_at: datetime
    next_refresh_at: datetime


class CollectReportResponse(BaseModel):
    message: str
    collected_at: datetime
    processed_count: int
    errors: List[str] = []


class MarketCollectStatus(BaseModel):
    last_collected_at: Optional[datetime] = None
    trade_date: Optional[date] = None
    stock_count: int = 0
    universe_estimate: int = 0


class NewsCollectStatus(BaseModel):
    last_collected_at: Optional[datetime] = None
    total_articles: int = 0
    stocks_with_news: int = 0


class FinancialsCollectStatus(BaseModel):
    last_collected_at: Optional[datetime] = None
    analyzed_count: int = 0
    watchlist_analyzed: int = 0
    watchlist_total: int = 0
    pending_watchlist: int = 0


class ReportCollectStatus(BaseModel):
    last_generated_at: Optional[datetime] = None
    next_refresh_at: Optional[datetime] = None


class DisclosureCollectStatus(BaseModel):
    last_collected_at: Optional[datetime] = None
    total_disclosures: int = 0
    stocks_with_disclosures: int = 0


class InvestorFlowCollectStatus(BaseModel):
    last_collected_at: Optional[datetime] = None
    total_rows: int = 0
    stocks_with_flow: int = 0


class CollectStatusResponse(BaseModel):
    market: MarketCollectStatus
    news: NewsCollectStatus
    financials: FinancialsCollectStatus
    report: ReportCollectStatus
    disclosures: DisclosureCollectStatus = DisclosureCollectStatus()
    investor_flow: InvestorFlowCollectStatus = InvestorFlowCollectStatus()


class BusinessInsightResponse(BaseModel):
    status: str
    moat_proxy: Optional[Dict] = None
    rd_efficiency: Optional[Dict] = None
    capital_allocation: Optional[Dict] = None
    deep_value: Optional[Dict] = None
    data_years: Optional[List[int]] = None
    source: Optional[str] = None
    collected_at: Optional[str] = None
    message: Optional[str] = None


class TechnicalSnapshot(BaseModel):
    close: Optional[float] = None
    ma5: Optional[float] = None
    ma20: Optional[float] = None
    ma60: Optional[float] = None
    rsi14: Optional[float] = None
    vs_ma20_pct: Optional[float] = None
    vs_ma60_pct: Optional[float] = None
    ma_alignment: Optional[str] = None
    volume: Optional[int] = None
    volume_avg_20d: Optional[float] = None
    volume_ratio_vs_20d: Optional[float] = None


class TechnicalBarPoint(BaseModel):
    trade_date: str
    open_price: Optional[float] = None
    high_price: Optional[float] = None
    low_price: Optional[float] = None
    close_price: Optional[float] = None
    volume: Optional[int] = None
    ma5: Optional[float] = None
    ma20: Optional[float] = None
    ma60: Optional[float] = None
    rsi14: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_histogram: Optional[float] = None


class TechnicalIndicatorsResponse(BaseModel):
    status: str
    ticker: str
    bars: List[TechnicalBarPoint] = []
    snapshot: Optional[TechnicalSnapshot] = None
    message: Optional[str] = None


class AnnualFinancialRow(BaseModel):
    fiscal_year: int
    revenue: Optional[float] = None
    operating_income: Optional[float] = None
    operating_margin_pct: Optional[float] = None
    rd_expense: Optional[float] = None
    operating_cash_flow: Optional[float] = None
    revenue_yoy_pct: Optional[float] = None
    operating_income_yoy_pct: Optional[float] = None


class FinancialsResponse(BaseModel):
    status: str
    ticker: str
    source: Optional[str] = None
    rows: List[AnnualFinancialRow] = []
    data_years: List[int] = []
    revenue_cagr_3y_pct: Optional[float] = None
    collected_at: Optional[str] = None
    message: Optional[str] = None


class NewsSummaryResponse(BaseModel):
    status: str
    ticker: str
    avg_sentiment: Optional[float] = None
    positive_count: int = 0
    negative_count: int = 0
    neutral_count: int = 0
    article_count: int = 0
    top_keywords: List[str] = []
    window_days: int = 7
    message: Optional[str] = None


class BuyRationalePillar(BaseModel):
    id: str
    score: int
    label: str
    bullets: List[str] = []
    risks: List[str] = []


class BuyRationaleResponse(BaseModel):
    status: str
    ticker: str
    overall_score: int = 0
    verdict: str = "중립"
    pillars: List[BuyRationalePillar] = []
    data_freshness: Dict[str, Optional[str]] = {}
    message: Optional[str] = None


class DisclosureItem(BaseModel):
    rcept_no: str
    report_nm: str
    report_type: str
    rcept_dt: date
    dart_url: Optional[str] = None
    summary: Optional[str] = None


class DisclosuresResponse(BaseModel):
    status: str
    ticker: str
    items: List[DisclosureItem] = []
    message: Optional[str] = None


class EarningsCalendarResponse(BaseModel):
    status: str
    ticker: str
    next_estimated_date: Optional[date] = None
    next_estimated_uncertainty_days: Optional[int] = None
    days_to_next: Optional[int] = None
    last_earnings_date: Optional[date] = None
    days_since_last_earnings: Optional[int] = None
    message: Optional[str] = None


class InvestorFlowDaily(BaseModel):
    trade_date: date
    foreign_net: Optional[int] = None
    institutional_net: Optional[int] = None
    individual_net: Optional[int] = None


class InvestorFlowSnapshot(BaseModel):
    foreign_net_5d: Optional[float] = None
    foreign_net_20d: Optional[float] = None
    institutional_net_5d: Optional[float] = None
    flow_streak: int = 0
    flow_signal: str = "neutral"
    vs_individual: Optional[str] = None


class InvestorFlowResponse(BaseModel):
    status: str
    ticker: str
    days: int = 60
    daily: List[InvestorFlowDaily] = []
    snapshot: Optional[InvestorFlowSnapshot] = None
    message: Optional[str] = None


class RelatedStockItem(BaseModel):
    ticker: str
    name: str
    current_price: Optional[float] = None
    change_rate: Optional[float] = None
    ai_score: Optional[int] = None
    relation_type: str
    relation_reason: str


class RelatedStocksResponse(BaseModel):
    ticker: str
    items: List[RelatedStockItem] = []
    total: int = 0
