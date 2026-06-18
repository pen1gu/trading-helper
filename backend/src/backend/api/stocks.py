from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_
from typing import List, Optional
from ..database import get_db
from .. import models, schemas
from ..data.ticker_utils import is_kr_ticker
from ..services.business_insight_service import get_or_fetch_business_insight
from ..services.buy_rationale_service import build_buy_rationale
from ..services.earnings_calendar_service import build_earnings_calendar
from ..services.financials_service import fetch_financials_payload
from ..services.investor_flow_analyzer import build_investor_flow_response
from ..services.news_summary_service import build_news_summary
from ..services.report_pipeline import latest_trade_date
from ..services.analyzer import AIAnalyzer
from ..services.quant_analyzer import calculate_heuristic_fair_price
from ..services.collector import DataCollector
from ..services.feature_store import collect_stock_features
from ..services.technical_analyzer import BarInput, TechnicalAnalyzer
from ..services.related_stocks_service import find_related_stocks

router = APIRouter()


async def _get_stock_or_404(db: AsyncSession, ticker: str) -> models.Stock:
    result = await db.execute(select(models.Stock).where(models.Stock.ticker == ticker))
    stock = result.scalars().first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    return stock

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
    market: Optional[str] = Query(None, description="Market: KR, US"),
    min_per: Optional[float] = Query(None),
    max_per: Optional[float] = Query(None),
    min_pbr: Optional[float] = Query(None),
    max_pbr: Optional[float] = Query(None),
    min_roe: Optional[float] = Query(None),
    ncav_only: Optional[bool] = Query(False)
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

    if min_per is not None:
        query = query.where(models.Stock.per >= min_per)
    if max_per is not None:
        query = query.where(models.Stock.per <= max_per)
    if min_pbr is not None:
        query = query.where(models.Stock.pbr >= min_pbr)
    if max_pbr is not None:
        query = query.where(models.Stock.pbr <= max_pbr)
    if min_roe is not None:
        query = query.where(models.Stock.roe >= min_roe)

    # 정렬 로직
    if sort_by == "change_rate":
        query = query.order_by(desc(models.Stock.change_rate))
    elif sort_by == "change_rate_asc":
        query = query.order_by(models.Stock.change_rate)
    elif sort_by == "market_cap":
        query = query.order_by(desc(models.Stock.market_cap))
    else:  # ai_score (default)
        query = query.order_by(desc(models.Stock.ai_score.isnot(None)), desc(models.Stock.ai_score))
        
    result = await db.execute(query.limit(1000))
    stocks = list(result.scalars().all())

    if ncav_only:
        filtered_stocks = []
        for s in stocks:
            if s.business_insight and s.market_cap:
                try:
                    ncav = s.business_insight.get("deep_value", {}).get("ncav")
                    if ncav is not None and ncav > s.market_cap:
                        filtered_stocks.append(s)
                except Exception:
                    pass
        stocks = filtered_stocks

    return stocks[:200]

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


@router.get("/{ticker}/technicals", response_model=schemas.TechnicalIndicatorsResponse)
async def get_stock_technicals(
    ticker: str,
    limit: int = Query(120, description="Number of bars to analyze"),
    db: AsyncSession = Depends(get_db),
):
    stock = await _get_stock_or_404(db, ticker)
    result = await db.execute(
        select(models.StockDailyBar)
        .where(models.StockDailyBar.stock_id == stock.id)
        .order_by(desc(models.StockDailyBar.trade_date))
        .limit(limit)
    )
    bars = sorted(result.scalars().all(), key=lambda b: b.trade_date)
    if not bars:
        return schemas.TechnicalIndicatorsResponse(
            status="empty",
            ticker=ticker,
            message="일봉 데이터가 없습니다.",
        )

    inputs = [
        BarInput(
            trade_date=b.trade_date,
            open_price=b.open_price,
            high_price=b.high_price,
            low_price=b.low_price,
            close_price=b.close_price,
            volume=b.volume,
        )
        for b in bars
    ]
    computed = TechnicalAnalyzer.compute_series(inputs)
    return schemas.TechnicalIndicatorsResponse(
        status="ok",
        ticker=ticker,
        bars=computed.get("bars", []),
        snapshot=computed.get("snapshot"),
    )


@router.get("/{ticker}/financials", response_model=schemas.FinancialsResponse)
async def get_stock_financials(ticker: str, db: AsyncSession = Depends(get_db)):
    await _get_stock_or_404(db, ticker)
    payload = fetch_financials_payload(ticker)
    return schemas.FinancialsResponse(**payload)


@router.get("/{ticker}/news-summary", response_model=schemas.NewsSummaryResponse)
async def get_stock_news_summary(
    ticker: str,
    window_days: int = Query(7, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
):
    stock = await _get_stock_or_404(db, ticker)
    summary = await build_news_summary(db, stock, window_days=window_days)
    return schemas.NewsSummaryResponse(**summary)


@router.get("/{ticker}/buy-rationale", response_model=schemas.BuyRationaleResponse)
async def get_stock_buy_rationale(ticker: str, db: AsyncSession = Depends(get_db)):
    stock = await _get_stock_or_404(db, ticker)
    rationale = await build_buy_rationale(db, stock)
    return schemas.BuyRationaleResponse(**rationale)


@router.get("/{ticker}/disclosures", response_model=schemas.DisclosuresResponse)
async def get_stock_disclosures(
    ticker: str,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    if not is_kr_ticker(ticker):
        return schemas.DisclosuresResponse(
            status="unsupported",
            ticker=ticker,
            message="국내 종목만 공시 데이터를 지원합니다.",
        )

    stock = await _get_stock_or_404(db, ticker)
    result = await db.execute(
        select(models.Disclosure)
        .where(models.Disclosure.stock_id == stock.id)
        .order_by(desc(models.Disclosure.rcept_dt))
        .limit(limit)
    )
    items = [
        schemas.DisclosureItem(
            rcept_no=d.rcept_no,
            report_nm=d.report_nm,
            report_type=d.report_type,
            rcept_dt=d.rcept_dt,
            dart_url=d.dart_url,
            summary=d.summary,
        )
        for d in result.scalars().all()
    ]
    return schemas.DisclosuresResponse(
        status="ok" if items else "empty",
        ticker=ticker,
        items=items,
        message=None if items else "수집된 공시가 없습니다.",
    )


@router.get("/{ticker}/earnings-calendar", response_model=schemas.EarningsCalendarResponse)
async def get_stock_earnings_calendar(ticker: str, db: AsyncSession = Depends(get_db)):
    if not is_kr_ticker(ticker):
        return schemas.EarningsCalendarResponse(
            status="unsupported",
            ticker=ticker,
            message="국내 종목만 실적 캘린더를 지원합니다.",
        )
    stock = await _get_stock_or_404(db, ticker)
    payload = await build_earnings_calendar(db, stock)
    return schemas.EarningsCalendarResponse(**payload)


@router.get("/{ticker}/investor-flow", response_model=schemas.InvestorFlowResponse)
async def get_stock_investor_flow(
    ticker: str,
    days: int = Query(60, ge=5, le=120),
    db: AsyncSession = Depends(get_db),
):
    if not is_kr_ticker(ticker):
        return schemas.InvestorFlowResponse(
            status="unsupported",
            ticker=ticker,
            days=days,
            message="국내 종목만 수급 데이터를 지원합니다.",
        )
    stock = await _get_stock_or_404(db, ticker)
    payload = await build_investor_flow_response(db, stock, days=days)
    return schemas.InvestorFlowResponse(**payload)

@router.get("/{ticker}/related", response_model=schemas.RelatedStocksResponse)
async def get_related_stocks(
    ticker: str,
    limit: int = Query(10, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
):
    stock = await _get_stock_or_404(db, ticker)
    items = await find_related_stocks(db, stock, limit=limit)
    return schemas.RelatedStocksResponse(
        ticker=ticker,
        items=[schemas.RelatedStockItem(**item) for item in items],
        total=len(items),
    )


@router.get("/{ticker}", response_model=schemas.Stock)
async def get_stock(ticker: str, db: AsyncSession = Depends(get_db)):
    # ... (기존 로직 유지)
    # 1. DB에서 먼저 조회
    result = await db.execute(select(models.Stock).where(models.Stock.ticker == ticker))
    stock = result.scalars().first()

    # 2. DB에 없으면 외부 검색 시도
    if not stock:
        collector = DataCollector()
        external_data = collector.fetch_stock_data(ticker)

        if external_data and external_data.get("daily_bars"):
            # 외부 데이터를 DB에 저장 (feature_store 활용)
            stock = await collect_stock_features(db, external_data)
            if stock:
                await db.commit()
                await db.refresh(stock)
            else:
                raise HTTPException(status_code=404, detail="Stock not found (failed to process external data)")
        else:
            raise HTTPException(status_code=404, detail="Stock not found in DB or external sources")

    return stock

@router.post("/{ticker}/target", response_model=schemas.Stock)
async def toggle_crawling_target(ticker: str, db: AsyncSession = Depends(get_db)):
    """특정 종목을 수동 크롤링 대상 풀에 추가하거나 제거합니다."""
    result = await db.execute(select(models.Stock).where(models.Stock.ticker == ticker))
    stock = result.scalars().first()

    if not stock:
        # 만약 DB에 없는 종목을 타겟팅하려 한다면 먼저 데이터를 가져옵니다 (get_stock의 로직 활용)
        collector = DataCollector()
        external_data = collector.fetch_stock_data(ticker)
        if not external_data or not external_data.get("daily_bars"):
            raise HTTPException(status_code=404, detail="Target stock not found in external sources")

        stock = await collect_stock_features(db, external_data)
        if not stock:
            raise HTTPException(status_code=500, detail="Failed to initialize stock data")

    # 토글 로직
    stock.is_crawling_target = not stock.is_crawling_target

    await db.commit()
    await db.refresh(stock)
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
