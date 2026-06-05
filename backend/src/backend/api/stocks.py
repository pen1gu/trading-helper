from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_
from typing import List, Optional
from ..database import get_db
from .. import models, schemas
from ..services.report_pipeline import latest_trade_date

router = APIRouter()

@router.get("/", response_model=List[schemas.Stock])
async def get_stocks(db: AsyncSession = Depends(get_db)):
    # Watchlist 테이블에 있는 종목들만 필터링하여 반환
    query = (
        select(models.Stock)
        .join(models.Watchlist, models.Stock.ticker == models.Watchlist.ticker)
    )
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/scan", response_model=List[schemas.Stock])
async def scan_stocks(
    db: AsyncSession = Depends(get_db),
    q: Optional[str] = Query(None, description="Search ticker or name"),
    sort_by: str = Query("ai_score", description="Sort by: ai_score, change_rate, market_cap"),
    market: Optional[str] = Query(None, description="Market: KR, US")
):
    # 등락률 정보가 있는(수집 완료된) 종목 전체를 대상으로 검색
    query = select(models.Stock).where(models.Stock.change_rate.isnot(None))
    
    if market == "KR":
        query = query.where(models.Stock.market == "KOSPI/KOSDAQ")
    elif market == "US":
        query = query.where(models.Stock.market == "NASDAQ/NYSE")
    
    if q:
        search_filter = or_(
            models.Stock.ticker.ilike(f"%{q}%"),
            models.Stock.name.ilike(f"%{q}%")
        )
        query = query.where(search_filter)

    # 정렬 로직
    if sort_by == "change_rate":
        query = query.order_by(desc(models.Stock.change_rate))
    elif sort_by == "change_rate_asc": # 하락률순 추가
        query = query.order_by(models.Stock.change_rate)
    elif sort_by == "market_cap":
        query = query.order_by(desc(models.Stock.market_cap))
    else:  # ai_score (default)
        # AI 스코어가 없는 경우 하단으로, 있는 경우 높은 순으로 정렬
        query = query.order_by(desc(models.Stock.ai_score.isnot(None)), desc(models.Stock.ai_score))
        
    result = await db.execute(query.limit(200)) # 표시 개수 확장
    return result.scalars().all()

@router.get("/{ticker}", response_model=schemas.Stock)
async def get_stock(ticker: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Stock).where(models.Stock.ticker == ticker))
    stock = result.scalars().first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    return stock

@router.get("/{ticker}/bars", response_model=List[schemas.StockDailyBar])
async def get_stock_bars(
    ticker: str, 
    limit: int = Query(60, description="Number of bars to fetch"),
    db: AsyncSession = Depends(get_db)
):
    # 특정 종목의 과거 봉 데이터 조회
    stock_result = await db.execute(select(models.Stock.id).where(models.Stock.ticker == ticker))
    stock_id = stock_result.scalar()
    if not stock_id:
        raise HTTPException(status_code=404, detail="Stock not found")
        
    result = await db.execute(
        select(models.StockDailyBar)
        .where(models.StockDailyBar.stock_id == stock_id)
        .order_by(desc(models.StockDailyBar.trade_date))
        .limit(limit)
    )
    # 프론트엔드 차트 렌더링을 위해 시간순(오름차순)으로 반환
    bars = result.scalars().all()
    return sorted(bars, key=lambda x: x.trade_date)
