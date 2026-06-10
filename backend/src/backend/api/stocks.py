from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_
from typing import List, Optional
from ..database import get_db
from .. import models, schemas
from ..services.business_insight_service import get_or_fetch_business_insight
from ..services.report_pipeline import latest_trade_date
from ..services.analyzer import AIAnalyzer
from ..services.quant_analyzer import calculate_heuristic_fair_price

router = APIRouter()

@router.post("/{ticker}/analyze", response_model=schemas.Stock)
async def analyze_single_stock(ticker: str, db: AsyncSession = Depends(get_db)):
    # 1. DB에서 주식 정보 조회
    result = await db.execute(select(models.Stock).where(models.Stock.ticker == ticker))
    stock = result.scalars().first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
        
    # 2. 뉴스 목록 조회
    news_result = await db.execute(
        select(models.News)
        .where(models.News.stock_id == stock.id)
        .order_by(desc(models.News.published_at))
        .limit(10)
    )
    news_items = news_result.scalars().all()
    news_list = [{"title": n.title, "content": n.content, "published_at": n.published_at, "source": n.source} for n in news_items]
    
    # 3. 주식 데이터 직렬화
    stock_data = {
        "ticker": stock.ticker,
        "name": stock.name,
        "market": stock.market,
        "current_price": stock.current_price,
        "change_rate": stock.change_rate,
        "change_amount": stock.change_amount,
        "market_cap": stock.market_cap,
        "per": stock.per,
        "pbr": stock.pbr,
        "roe": stock.roe,
        "dividend_yield": stock.dividend_yield,
        "business_insight": stock.business_insight,
    }
    
    # 4. 분석기 호출
    analyzer = AIAnalyzer()
    analysis_result = await analyzer.analyze_stock(stock_data, news_list)
    
    if "error" in analysis_result:
        raise HTTPException(status_code=503, detail=analysis_result["error"])
        
    # 5. 결과 저장
    stock.ai_score = analysis_result.get("ai_score")
    stock.ai_recommendation = analysis_result.get("ai_recommendation")
    stock.ai_analysis = analysis_result.get("ai_analysis")
    
    # 6. 자체 휴리스틱 모델 분석 추가
    stock.quant_analysis = calculate_heuristic_fair_price(stock)
    
    await db.commit()
    await db.refresh(stock)
    return stock

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

@router.get("/{ticker}/business-insight", response_model=schemas.BusinessInsightResponse)
async def get_business_insight(
    ticker: str,
    refresh: bool = Query(False, description="Force refresh financial data"),
    db: AsyncSession = Depends(get_db),
):
    insight = await get_or_fetch_business_insight(db, ticker, force_refresh=refresh)
    if insight.get("status") == "not_found":
        raise HTTPException(status_code=404, detail="Stock not found")
    return insight


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
