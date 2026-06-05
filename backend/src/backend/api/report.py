import json
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from .logging_utils import api_logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from .. import models, schemas
from ..services.report_pipeline import (
    DataCollectionPipeline,
    ReportGenerationPipeline,
    ReportPipeline,
    extract_news_url,
    latest_trade_date,
    next_refresh_at_kst,
    select_picks,
    stock_to_pick_dict,
)

router = APIRouter()

KST = timezone(timedelta(hours=9))

DEFAULT_SUMMARY = (
    "시장 데이터가 아직 없습니다. 「데이터 불러오기」로 시세와 뉴스를 먼저 적재해주세요."
)
DEFAULT_HIGHLIGHTS: list[dict[str, str]] = []


def _default_response() -> schemas.DailyReportResponse:
    now = datetime.now(KST)
    return schemas.DailyReportResponse(
        market_summary=DEFAULT_SUMMARY,
        highlights=[],
        long_picks=[],
        short_picks=[],
        data_source="empty",
        indices=[],
        updated_at=now,
        next_refresh_at=next_refresh_at_kst(now),
        data_collected_at=None,
        report_generated_at=None,
    )


async def _resolve_news_url(db: AsyncSession, stock: models.Stock) -> str | None:
    url = extract_news_url(stock)
    if url:
        return url
    if not stock.id:
        return None
    result = await db.execute(
        select(models.News.url)
        .where(models.News.stock_id == stock.id, models.News.url.isnot(None))
        .order_by(models.News.published_at.desc().nullslast(), models.News.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _stocks_to_picks(
    db: AsyncSession, stocks: list[models.Stock]
) -> list[schemas.TopPick]:
    picks: list[schemas.TopPick] = []
    for stock in stocks:
        picks.append(
            schemas.TopPick(
                **stock_to_pick_dict(
                    stock, news_url=await _resolve_news_url(db, stock)
                )
            )
        )
    return picks


async def _build_daily_from_db(db: AsyncSession) -> schemas.DailyReportResponse:
    report_result = await db.execute(
        select(models.MarketReport).order_by(models.MarketReport.updated_at.desc()).limit(1)
    )
    report = report_result.scalars().first()

    trade_date = await latest_trade_date(db)
    stocks_query = select(models.Stock)
    if trade_date is not None:
        stocks_query = stocks_query.where(models.Stock.trade_date == trade_date)
    stocks_result = await db.execute(stocks_query)
    stocks = stocks_result.scalars().all()

    if not stocks and not report:
        return _default_response()

    long_stocks, short_stocks = select_picks(list(stocks))
    long_picks = await _stocks_to_picks(db, long_stocks)
    short_picks = await _stocks_to_picks(db, short_stocks)

    now = datetime.now(KST)
    summary = (
        report.market_summary
        if report and report.market_summary
        else DEFAULT_SUMMARY
    )
    highlights_raw = report.highlights if report and report.highlights else DEFAULT_HIGHLIGHTS
    indices_raw = report.indices if report and report.indices else []

    stock_times = [s.updated_at for s in stocks if s.updated_at]
    updated_at = report.updated_at if report else (max(stock_times) if stock_times else now)
    company_reports = []
    raw_company_reports = report.company_reports if report and report.company_reports else []
    for item in raw_company_reports:
        company_reports.append(schemas.CompanyReport(**item))

    return schemas.DailyReportResponse(
        market_summary=summary,
        highlights=[schemas.ReportHighlight(**h) for h in highlights_raw],
        long_picks=long_picks,
        short_picks=short_picks,
        company_reports=company_reports,
        data_source="live",
        indices=[schemas.MarketIndex(**idx) for idx in indices_raw] if indices_raw else [],
        updated_at=updated_at,
        next_refresh_at=report.next_refresh_at
        if report and report.next_refresh_at
        else next_refresh_at_kst(now),
        data_collected_at=report.data_collected_at if report else None,
        report_generated_at=report.report_generated_at if report else None,
    )


@router.get("/daily", response_model=schemas.DailyReportResponse)
async def get_daily_report(db: AsyncSession = Depends(get_db)):
    try:
        return await _build_daily_from_db(db)
    except Exception as e:
        api_logger.warning("GET /report/daily failed, using defaults: %s", e)
        return _default_response()


@router.get("/collect-stream")
async def collect_market_data_stream(db: AsyncSession = Depends(get_db)):
    """실시간 수집 진행률을 SSE로 스트리밍합니다."""
    pipeline = DataCollectionPipeline()

    async def event_generator():
        async for progress_data in pipeline.run_stream(db):
            yield f"data: {json.dumps(progress_data, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/collect", response_model=schemas.CollectReportResponse)
async def collect_market_data(db: AsyncSession = Depends(get_db)):
    result = await DataCollectionPipeline().run(db)
    if result.get("error"):
        api_logger.error("POST /report/collect failed: %s", result["error"])
        raise HTTPException(status_code=503, detail=result["error"])

    errors = result.get("errors") or []
    if errors:
        api_logger.warning(
            "POST /report/collect: %d ticker(s) skipped — %s",
            len(errors),
            "; ".join(errors[:3]) + ("..." if len(errors) > 3 else ""),
        )

    api_logger.info(
        "POST /report/collect ok processed=%d errors=%d",
        result.get("processed_count", 0),
        len(errors),
    )
    return schemas.CollectReportResponse(
        message=result["message"],
        collected_at=datetime.fromisoformat(result["collected_at"]),
        processed_count=result.get("processed_count", 0),
        errors=errors,
    )


@router.post("/generate", response_model=schemas.RefreshReportResponse)
async def generate_daily_report(db: AsyncSession = Depends(get_db)):
    pipeline = ReportGenerationPipeline()
    if not pipeline.gemini_configured:
        api_logger.error("POST /report/generate: Gemini API key not configured")
        raise HTTPException(
            status_code=503,
            detail="Gemini API 키가 설정되지 않았습니다. .env에 GEMINI_API_KEY를 추가해주세요.",
        )

    result = await pipeline.run(db)
    if result.get("error"):
        api_logger.error("POST /report/generate failed: %s", result["error"])
        raise HTTPException(status_code=503, detail=result["error"])

    updated = datetime.fromisoformat(result["updated_at"])
    next_refresh = datetime.fromisoformat(result["next_refresh_at"])

    api_logger.info(
        "POST /report/generate completed (%d reports)",
        result.get("processed_count", 0),
    )
    return schemas.RefreshReportResponse(
        message=result["message"],
        updated_at=updated,
        next_refresh_at=next_refresh,
    )


@router.post("/refresh", response_model=schemas.RefreshReportResponse)
async def refresh_daily_report(db: AsyncSession = Depends(get_db)):
    """Deprecated: collect와 generate를 한 번에 실행하는 하위 호환 API."""
    pipeline = ReportPipeline()
    if not pipeline.gemini_configured:
        api_logger.error("POST /report/refresh: Gemini API key not configured")
        raise HTTPException(
            status_code=503,
            detail="Gemini API 키가 설정되지 않았습니다. .env에 GEMINI_API_KEY를 추가해주세요.",
        )

    result = await pipeline.run(db)
    if result.get("error"):
        api_logger.error("POST /report/refresh failed: %s", result["error"])
        raise HTTPException(status_code=503, detail=result["error"])

    return schemas.RefreshReportResponse(
        message=result["message"],
        updated_at=datetime.fromisoformat(result["updated_at"]),
        next_refresh_at=datetime.fromisoformat(result["next_refresh_at"]),
    )
