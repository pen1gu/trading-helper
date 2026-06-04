from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict
from datetime import datetime

class StockBase(BaseModel):
    ticker: str
    name: Optional[str] = None
    market: Optional[str] = None
    price: Optional[float] = None
    change_rate: Optional[float] = None
    market_cap: Optional[float] = None
    per: Optional[float] = None
    pbr: Optional[float] = None
    roe: Optional[float] = None
    dividend_yield: Optional[float] = None
    foreign_ownership: Optional[float] = None
    ai_score: Optional[int] = None
    ai_recommendation: Optional[str] = None
    ai_analysis: Optional[Dict] = None

class StockCreate(StockBase):
    pass

class Stock(StockBase):
    id: int
    updated_at: datetime
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
