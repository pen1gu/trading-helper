import asyncio
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..logging_config import task_logger
from .business_insight_service import collect_business_insight_for_stock
from .feature_store import build_analysis_context, collect_stock_features
from .notifier import DiscordNotifier
from .watchlist import (
    MAX_PICKS,
    PRICE_UNIVERSE_TICKERS,
)

KST = timezone(timedelta(hours=9))


def next_refresh_at_kst(from_dt: Optional[datetime] = None) -> datetime:
    """다음 08:30 KST 시각을 반환합니다."""
    now = from_dt or datetime.now(KST)
    if now.tzinfo is None:
        now = now.replace(tzinfo=KST)
    else:
        now = now.astimezone(KST)
    target = now.replace(hour=8, minute=30, second=0, microsecond=0)
    if now >= target:
        target += timedelta(days=1)
    return target


def _long_sort_key(stock: models.Stock) -> tuple:
    return (-(stock.change_rate or 0), stock.ticker)


def _short_sort_key(stock: models.Stock) -> tuple:
    return (stock.change_rate or 0, stock.ticker)


def select_picks(
    stocks: List[models.Stock], limit: int = MAX_PICKS
) -> Tuple[List[models.Stock], List[models.Stock]]:
    """당일 전일비 기준 롱(상승)·숏(하락) 목록."""
    longs = [
        s
        for s in stocks
        if s.change_rate is not None and s.current_price is not None and s.change_rate >= 0
    ]
    shorts = [
        s
        for s in stocks
        if s.change_rate is not None and s.current_price is not None and s.change_rate < 0
    ]
    longs.sort(key=_long_sort_key)
    shorts.sort(key=_short_sort_key)
    return longs[:limit], shorts[:limit]


def select_report_picks(stocks: List[models.Stock]) -> Tuple[List[models.Stock], List[models.Stock]]:
    """Gemini 리포트용 당일 Top5 롱/숏."""
    return select_picks(stocks, limit=5)


def extract_hot_reason(stock: models.Stock) -> str:
    ai = stock.ai_analysis or {}
    if ai.get("hot_reason"):
        return ai["hot_reason"]
    strengths = ai.get("strengths") or []
    if strengths:
        return strengths[0]
    if ai.get("summary"):
        return ai["summary"]
    return "분석 데이터 준비 중입니다."


def extract_news_url(stock: models.Stock) -> Optional[str]:
    ai = stock.ai_analysis or {}
    return ai.get("source_news_url")


def stock_to_pick_dict(stock: models.Stock, news_url: Optional[str] = None) -> Dict[str, Any]:
    key_metrics = {
        "trade_date": stock.trade_date,
        "current_price": stock.current_price,
        "prev_close": stock.prev_close,
        "change_rate": stock.change_rate,
        "change_amount": stock.change_amount,
        "day_open": stock.day_open,
        "day_high": stock.day_high,
        "day_low": stock.day_low,
        "volume": stock.volume,
        "close_avg_20d": stock.close_avg_20d,
        "close_max_60d": stock.close_max_60d,
        "close_min_60d": stock.close_min_60d,
        "vs_avg_20d_pct": stock.vs_avg_20d_pct,
        "vs_60d_high_pct": stock.vs_60d_high_pct,
        "vs_60d_low_pct": stock.vs_60d_low_pct,
        "per": stock.per,
        "pbr": stock.pbr,
    }
    return {
        "ticker": stock.ticker,
        "name": stock.name or stock.ticker,
        "hot_reason": extract_hot_reason(stock),
        "news_url": news_url or extract_news_url(stock),
        "change_rate": stock.change_rate,
        "current_price": stock.current_price,
        "price": stock.current_price,
        "ai_score": stock.ai_score,
        "key_metrics": key_metrics,
    }


async def latest_trade_date(db: AsyncSession) -> Optional[date]:
    result = await db.execute(
        select(models.Stock.trade_date)
        .where(models.Stock.trade_date.isnot(None))
        .order_by(models.Stock.trade_date.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def latest_trade_date_stocks(db: AsyncSession) -> List[models.Stock]:
    trade_date = await latest_trade_date(db)
    if trade_date is None:
        return []
    result = await db.execute(
        select(models.Stock).where(models.Stock.trade_date == trade_date)
    )
    return list(result.scalars().all())


def _fetch_ticker_sync(collector, ticker: str) -> Dict[str, Any]:
    """네트워크 호출만 수행하는 동기 헬퍼 (스레드에서 실행용)"""
    try:
        if ticker.isdigit():
            data = collector.get_kr_stock_data(ticker)
        else:
            data = collector.get_us_stock_data(ticker)

        if not data or not data.get("daily_bars"):
            return {"ticker": ticker, "error": "quote data unavailable"}

        news = collector.get_stock_news(ticker, data.get("name") or ticker)
        return {"ticker": ticker, "data": data, "news": news}
    except Exception as e:
        return {"ticker": ticker, "error": str(e)}


class DataCollectionPipeline:
    def __init__(self):
        from .collector import DataCollector

        self.collector = DataCollector()

    async def run_stream(self, db: AsyncSession):
        """실시간 진행률을 yield하는 비동기 수집 파이프라인"""
        started = time.perf_counter()
        
        yield {"progress": 0, "message": "상위 1000종목 리스트 추출 중...", "status": "collecting"}
        
        # 1. 국내 상위 1000종목 동적 추출
        kr_top_1000 = await asyncio.to_thread(self.collector.get_top_tickers, "KR", 1000)
        
        # 2. 기본 유니버스(미국 위주) + 국내 1000 + 관심 종목 합치기
        watchlist_res = await db.execute(select(models.Watchlist.ticker))
        watchlist_tickers = [r for r in watchlist_res.scalars().all()]
        
        universe = list(set(PRICE_UNIVERSE_TICKERS) | set(kr_top_1000) | set(watchlist_tickers))
        financial_insight_tickers = set(PRICE_UNIVERSE_TICKERS) | set(watchlist_tickers)
        total = len(universe)
        
        yield {"progress": 2, "message": "시장 지수 수집 중...", "status": "collecting"}
        indices = self.collector.get_market_indices()
        collected_at = datetime.now(KST)

        processed_count = 0
        errors = []

        # 1. 병렬 페치 단계
        semaphore = asyncio.Semaphore(15)
        async def bounded_fetch(ticker: str):
            async with semaphore:
                return await asyncio.to_thread(_fetch_ticker_sync, self.collector, ticker)

        yield {"progress": 5, "message": f"총 {total}개 종목 데이터 페치 시작...", "status": "collecting"}
        fetch_results = await asyncio.gather(*(bounded_fetch(t) for t in universe))

        # 2. 순차 DB 저장 단계 및 실시간 진행률 yield
        for i, res in enumerate(fetch_results, start=1):
            ticker = res["ticker"]
            progress = int(5 + (i / total) * 90) # 5%~95% 구간
            
            if "error" in res:
                errors.append(f"{ticker}: {res['error']}")
                yield {"progress": progress, "message": f"{ticker} 수집 실패: {res['error']}", "status": "collecting"}
                continue

            yield {"progress": progress, "message": f"{res['data'].get('name', ticker)} 저장 중...", "status": "collecting"}
            
            data = res["data"]
            stock = await collect_stock_features(db, data, collected_at=collected_at)
            if stock:
                # AI 분석 초기화
                stock.ai_score = None
                stock.ai_recommendation = None
                stock.ai_analysis = None

                if ticker in financial_insight_tickers:
                    try:
                        await collect_business_insight_for_stock(db, stock)
                    except Exception as e:
                        errors.append(f"{ticker}: business insight failed ({e})")

                # 뉴스 저장
                for item in res.get("news", []):
                    news_exists = await db.execute(
                        select(models.News).where(models.News.url == item["url"])
                    )
                    if not news_exists.scalars().first():
                        db.add(models.News(
                            stock_id=stock.id,
                            title=item["title"],
                            content=item.get("content"),
                            url=item["url"],
                            source=item.get("source"),
                            published_at=item.get("published_at"),
                        ))
                processed_count += 1
            else:
                errors.append(f"{ticker}: feature collection failed")

            if i % 10 == 0 or i == total:
                await db.commit()

        # 리포트 메타데이터 업데이트
        report_result = await db.execute(select(models.MarketReport).limit(1))
        report = report_result.scalars().first()
        if not report:
            report = models.MarketReport()
            db.add(report)
        
        report.indices = indices
        report.data_collected_at = collected_at
        report.updated_at = collected_at
        await db.commit()

        elapsed = time.perf_counter() - started
        yield {
            "progress": 100, 
            "message": f"수집 완료! ({processed_count}개 성공, {len(errors)}개 실패, {elapsed:.1f}초)", 
            "status": "done",
            "processed_count": processed_count
        }

    async def run(self, db: AsyncSession) -> Dict[str, Any]:
        started = time.perf_counter()
        universe = list(PRICE_UNIVERSE_TICKERS)
        task_logger.info("collect.start tickers=%d", len(universe))

        collected_at = datetime.now(KST)
        indices = self.collector.get_market_indices()
        task_logger.info("collect.indices fetched=%d", len(indices or []))

        # 1. 병렬 페치 단계 (Semaphore로 동시성 제어)
        semaphore = asyncio.Semaphore(15)

        async def bounded_fetch(ticker: str):
            async with semaphore:
                return await asyncio.to_thread(_fetch_ticker_sync, self.collector, ticker)

        task_logger.info("collect.fetching_data_parallel started")
        fetch_results = await asyncio.gather(*(bounded_fetch(t) for t in universe))
        task_logger.info("collect.fetching_data_parallel completed")

        # 2. 순차 DB 저장 단계
        processed_count = 0
        errors: List[str] = []

        for i, res in enumerate(fetch_results, start=1):
            ticker = res["ticker"]
            if "error" in res:
                errors.append(f"{ticker}: {res['error']}")
                continue

            data = res["data"]
            stock = await collect_stock_features(db, data, collected_at=collected_at)
            if stock is None:
                errors.append(f"{ticker}: no daily bars after collect")
                continue

            stock.ai_score = None
            stock.ai_recommendation = None
            stock.ai_analysis = None

            try:
                await collect_business_insight_for_stock(db, stock)
            except Exception as e:
                errors.append(f"{ticker}: business insight failed ({e})")

            for item in res.get("news", []):
                news_exists = await db.execute(
                    select(models.News).where(models.News.url == item["url"])
                )
                if news_exists.scalars().first():
                    continue

                db.add(
                    models.News(
                        stock_id=stock.id,
                        title=item["title"],
                        content=item.get("content"),
                        url=item["url"],
                        source=item.get("source"),
                        published_at=item.get("published_at"),
                    )
                )
            processed_count += 1

            if i % 25 == 0 or i == len(fetch_results):
                task_logger.info(
                    "collect.db_save_progress %d/%d ok=%d skipped=%d",
                    i,
                    len(fetch_results),
                    processed_count,
                    len(errors),
                )

        report_result = await db.execute(select(models.MarketReport).limit(1))
        report = report_result.scalars().first()
        if report:
            report.indices = indices
            report.data_collected_at = collected_at
            report.updated_at = collected_at
        else:
            report = models.MarketReport(
                indices=indices,
                data_collected_at=collected_at,
                updated_at=collected_at,
            )
            db.add(report)

        await db.commit()
        elapsed = time.perf_counter() - started
        task_logger.info(
            "collect.done processed=%d errors=%d duration=%.1fs",
            processed_count,
            len(errors),
            elapsed,
        )
        return {
            "message": "데이터 불러오기가 완료되었습니다.",
            "collected_at": collected_at.isoformat(),
            "processed_count": processed_count,
            "errors": errors,
        }


class ReportGenerationPipeline:
    def __init__(self):
        from .analyzer import AIAnalyzer

        self.analyzer = AIAnalyzer()
        self.notifier = DiscordNotifier()

    @property
    def gemini_configured(self) -> bool:
        return self.analyzer.model is not None

    async def run(self, db: AsyncSession) -> Dict[str, Any]:
        started = time.perf_counter()
        if not self.gemini_configured:
            task_logger.error("generate.aborted gemini_not_configured")
            return {"error": "Gemini API key not configured"}

        stocks = await latest_trade_date_stocks(db)
        if not stocks:
            task_logger.warning("generate.aborted no_stocks_in_db")
            return {"error": "데이터가 없습니다. 먼저 데이터 불러오기를 실행해주세요."}

        top_longs, top_shorts = select_report_picks(stocks)
        if not top_longs and not top_shorts:
            task_logger.warning("generate.aborted no_change_rate_data")
            return {"error": "리포트를 작성할 당일 등락 데이터가 없습니다."}

        task_logger.info(
            "generate.start universe=%d long=%s short=%s",
            len(stocks),
            [s.ticker for s in top_longs],
            [s.ticker for s in top_shorts],
        )

        long_contexts = [await build_analysis_context(db, stock) for stock in top_longs]
        short_contexts = [await build_analysis_context(db, stock) for stock in top_shorts]
        task_logger.info("generate.contexts built long=%d short=%d", len(long_contexts), len(short_contexts))

        indices_result = await db.execute(select(models.MarketReport).limit(1))
        current_report = indices_result.scalars().first()
        indices = current_report.indices if current_report and current_report.indices else []

        report_payload = await self.analyzer.generate_position_report(
            indices=indices,
            long_contexts=long_contexts,
            short_contexts=short_contexts,
        )
        if report_payload.get("error"):
            task_logger.error("generate.gemini_failed %s", report_payload["error"])
            return report_payload

        generated_at = datetime.now(KST)
        next_refresh = next_refresh_at_kst(generated_at)
        company_reports = _normalize_company_reports(report_payload)

        report_result = await db.execute(select(models.MarketReport).limit(1))
        report = report_result.scalars().first()
        if report:
            report.market_summary = report_payload.get("market_mood", "")
            report.highlights = report_payload.get("highlights", [])
            report.company_reports = company_reports
            report.updated_at = generated_at
            report.report_generated_at = generated_at
            report.next_refresh_at = next_refresh
        else:
            report = models.MarketReport(
                market_summary=report_payload.get("market_mood", ""),
                highlights=report_payload.get("highlights", []),
                company_reports=company_reports,
                updated_at=generated_at,
                report_generated_at=generated_at,
                next_refresh_at=next_refresh,
            )
            db.add(report)

        _apply_company_reports(top_longs, top_shorts, company_reports)
        await db.commit()

        long_dicts = [stock_to_pick_dict(s) for s in top_longs]
        short_dicts = [stock_to_pick_dict(s) for s in top_shorts]
        self.notifier.send_morning_report(
            long_dicts, short_dicts, report_payload.get("market_mood", "")
        )

        elapsed = time.perf_counter() - started
        task_logger.info(
            "generate.done reports=%d duration=%.1fs",
            len(company_reports),
            elapsed,
        )
        return {
            "message": "AI 리포트 작성이 완료되었습니다.",
            "updated_at": generated_at.isoformat(),
            "next_refresh_at": next_refresh.isoformat(),
            "processed_count": len(company_reports),
            "errors": [],
        }


def _normalize_company_reports(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    reports: List[Dict[str, Any]] = []
    for key, position in (("long_top5", "long"), ("short_top5", "short")):
        for item in payload.get(key, []) or []:
            reports.append(
                {
                    "ticker": item.get("ticker"),
                    "name": item.get("name") or item.get("ticker"),
                    "position": position,
                    "lines": item.get("lines") or [],
                    "news_citations": item.get("news_citations") or [],
                }
            )
    return reports


def _apply_company_reports(
    longs: List[models.Stock],
    shorts: List[models.Stock],
    company_reports: List[Dict[str, Any]],
) -> None:
    stock_by_ticker = {s.ticker: s for s in [*longs, *shorts]}
    for item in company_reports:
        stock = stock_by_ticker.get(item.get("ticker"))
        if not stock:
            continue
        lines = item.get("lines") or []
        ai_blob = stock.ai_analysis or {}
        ai_blob["report_lines"] = lines
        ai_blob["hot_reason"] = " ".join(lines[:2]) if lines else extract_hot_reason(stock)
        if item.get("news_citations"):
            ai_blob["source_news_url"] = item["news_citations"][0]
        stock.ai_analysis = ai_blob
        stock.ai_recommendation = "Long" if item.get("position") == "long" else "Short"
        stock.ai_score = None


class ReportPipeline:
    """하위 호환용 collect → generate 래퍼."""

    def __init__(self):
        self.collector_pipeline = DataCollectionPipeline()
        self.report_pipeline = ReportGenerationPipeline()

    @property
    def gemini_configured(self) -> bool:
        return self.report_pipeline.gemini_configured

    async def run(self, db: AsyncSession) -> Dict[str, Any]:
        task_logger.info("refresh.start (collect → generate)")
        collect_result = await self.collector_pipeline.run(db)
        if collect_result.get("error"):
            return collect_result
        return await self.report_pipeline.run(db)
