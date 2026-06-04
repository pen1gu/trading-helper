from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from .database import Base

class Stock(Base):
    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, index=True)
    market = Column(String)  # KOSPI, KOSDAQ, NASDAQ, etc.
    
    # Fundamentals
    price = Column(Float)
    change_rate = Column(Float)  # 등락률
    market_cap = Column(Float)   # 시가총액
    per = Column(Float)
    pbr = Column(Float)
    roe = Column(Float)
    dividend_yield = Column(Float) # 배당수익률
    foreign_ownership = Column(Float) # 외국인 소진율
    
    # AI Scoring
    ai_score = Column(Integer)  # 0~100
    ai_recommendation = Column(String) # Long, Short, Neutral
    ai_analysis = Column(JSON) # Strengths (수익성, 성장성, 저평가, 안정성, 모멘텀)
    
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

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
