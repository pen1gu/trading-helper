from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    UniqueConstraint,
)
from sqlalchemy.sql import func
from .database import Base


class Stock(Base):
    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, index=True)
    market = Column(String)  # KOSPI, KOSDAQ, NASDAQ, etc.

    # Latest quote snapshot
    trade_date = Column(Date)
    current_price = Column(Float)
    day_open = Column(Float)
    day_high = Column(Float)
    day_low = Column(Float)
    day_close = Column(Float)
    prev_close = Column(Float)
    change_rate = Column(Float)  # 전일 종가 대비 등락률
    change_amount = Column(Float)
    volume = Column(BigInteger)
    volume_change_rate = Column(Float)
    day_range_pct = Column(Float)
    quote_source = Column(String)
    data_collected_at = Column(DateTime(timezone=True))

    # Historical aggregates, excluding the latest trade_date
    close_max_5d = Column(Float)
    close_min_5d = Column(Float)
    close_avg_5d = Column(Float)
    high_max_5d = Column(Float)
    low_min_5d = Column(Float)
    volume_avg_5d = Column(Float)
    close_max_20d = Column(Float)
    close_min_20d = Column(Float)
    close_avg_20d = Column(Float)
    high_max_20d = Column(Float)
    low_min_20d = Column(Float)
    volume_avg_20d = Column(Float)
    close_max_60d = Column(Float)
    close_min_60d = Column(Float)
    close_avg_60d = Column(Float)
    high_max_60d = Column(Float)
    low_min_60d = Column(Float)
    volume_avg_60d = Column(Float)
    vs_avg_20d_pct = Column(Float)
    vs_60d_high_pct = Column(Float)
    vs_60d_low_pct = Column(Float)

    # Fundamentals
    market_cap = Column(Float)   # 시가총액
    per = Column(Float)
    pbr = Column(Float)
    roe = Column(Float)
    dividend_yield = Column(Float) # 배당수익률
    foreign_ownership = Column(Float) # 외국인 소진율
    eps = Column(Float)
    beta = Column(Float)
    fifty_two_week_high = Column(Float)
    fifty_two_week_low = Column(Float)
    avg_volume_10d = Column(Float)

    # AI Scoring
    ai_score = Column(Integer)  # 0~100
    ai_recommendation = Column(String) # Long, Short, Neutral
    ai_analysis = Column(JSON) # Strengths (수익성, 성장성, 저평가, 안정성, 모멘텀)
    quant_analysis = Column(JSON) # 자체 휴리스틱 모델 분석 결과 (적정가 범위 등)
    is_crawling_target = Column(Boolean, default=False, nullable=False, server_default='false')

    # Business insight (rule-based, no AI)
    business_insight = Column(JSON)
    financials_collected_at = Column(DateTime(timezone=True))
    news_collected_at = Column(DateTime(timezone=True))

    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class StockDailyBar(Base):
    __tablename__ = "stock_daily_bars"
    __table_args__ = (
        UniqueConstraint("stock_id", "trade_date", name="uq_stock_daily_bars_stock_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False)
    trade_date = Column(Date, nullable=False)
    open_price = Column(Float)
    high_price = Column(Float)
    low_price = Column(Float)
    close_price = Column(Float)
    volume = Column(BigInteger)
    change_rate = Column(Float)
    change_amount = Column(Float)
    quote_source = Column(String)
    collected_at = Column(DateTime(timezone=True), server_default=func.now())


class News(Base):
    __tablename__ = "news"

    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=True)
    title = Column(String, nullable=False)
    content = Column(String)
    url = Column(String, unique=True)
    source = Column(String)
    published_at = Column(DateTime(timezone=True))
    
    # AI Analysis
    sentiment_score = Column(Integer) # 0~100
    summary = Column(String)
    hot_keywords = Column(JSON)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MarketReport(Base):
    __tablename__ = "market_reports"

    id = Column(Integer, primary_key=True, index=True)
    market_summary = Column(String)
    highlights = Column(JSON)  # [{"type": "핵심"|"주의", "text": "..."}]
    company_reports = Column(JSON)
    indices = Column(JSON)  # 매크로 지수 스냅샷
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
    next_refresh_at = Column(DateTime(timezone=True))
    data_collected_at = Column(DateTime(timezone=True))
    report_generated_at = Column(DateTime(timezone=True))


class Watchlist(Base):
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Disclosure(Base):
    __tablename__ = "disclosures"
    __table_args__ = (
        UniqueConstraint("rcept_no", name="uq_disclosures_rcept_no"),
    )

    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False, index=True)
    rcept_no = Column(String, unique=True, nullable=False, index=True)
    report_nm = Column(String, nullable=False)
    report_type = Column(String, nullable=False)
    rcept_dt = Column(Date, nullable=False)
    dart_url = Column(String)
    summary = Column(String)
    collected_at = Column(DateTime(timezone=True), server_default=func.now())


class StockInvestorFlow(Base):
    __tablename__ = "stock_investor_flows"
    __table_args__ = (
        UniqueConstraint("stock_id", "trade_date", name="uq_stock_investor_flows_stock_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False, index=True)
    trade_date = Column(Date, nullable=False)
    foreign_net = Column(BigInteger)
    institutional_net = Column(BigInteger)
    individual_net = Column(BigInteger)
    foreign_net_5d = Column(Float)
    collected_at = Column(DateTime(timezone=True), server_default=func.now())
