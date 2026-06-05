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
