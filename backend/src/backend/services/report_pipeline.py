import asyncio
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..logging_config import task_logger
from .business_insight_service import _is_cache_valid, collect_business_insight_for_stock
from .feature_store import build_analysis_context, collect_stock_features
from .news_crawl_service import (
    NewsCrawlContext,
    NewsCrawlMode,
    count_skip_tickers,
    load_news_crawl_contexts,
    mark_news_collected,
)
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


async def _get_last_bar_date(db: AsyncSession, ticker: str) -> Optional[str]:
    """해당 종목의 가장 최근 일봉 날짜를 반환합니다 (YYYY-MM-DD)."""
    result = await db.execute(
        select(models.StockDailyBar.trade_date)
        .join(models.Stock, models.Stock.id == models.StockDailyBar.stock_id)
        .where(models.Stock.ticker == ticker)
        .order_by(models.StockDailyBar.trade_date.desc())
        .limit(1)
    )
    last_date = result.scalar_one_or_none()
    return last_date.isoformat() if last_date else None


async def _fetch_ticker_async(
    db: AsyncSession,
    collector,
    ticker: str,
    news_ctx: Optional[NewsCrawlContext] = None,
) -> Dict[str, Any]:
    """비동기 DB 조회 후 동기 수집 호출 (증분 업데이트 지원)."""
    from .news_crawler import fetch_stock_news_if_needed

    ctx = news_ctx or NewsCrawlContext(mode=NewsCrawlMode.FETCH)
    
    # DB에서 가장 최근 일봉 날짜 조회
    last_date = await _get_last_bar_date(db, ticker)
    start_date = None
    if last_date:
        # 마지막 날짜 다음 날부터 가져오기 위해 1일 추가
        dt = date.fromisoformat(last_date) + timedelta(days=1)
        start_date = dt.isoformat()

    try:
        # 네트워크 호출은 thread pool에서 실행
        data = await asyncio.to_thread(
            collector.fetch_stock_data, ticker, start_date=start_date
        )

        if not data or not data.get("daily_bars"):
            # 증분 업데이트 시 새 데이터가 없는 것은 에러가 아님
            if start_date:
                return {"ticker": ticker, "data": {"daily_bars": []}, "news": [], "news_skipped": True, "incremental": True}
            return {"ticker": ticker, "error": "quote data unavailable"}

        # 뉴스는 항상 최신으로 가져옴 (news_ctx가 제어)
        news = await asyncio.to_thread(
            fetch_stock_news_if_needed, ctx, ticker, data.get("name") or ticker
        )
        return {
            "ticker": ticker,
            "data": data,
            "news": news,
            "news_skipped": ctx.mode == NewsCrawlMode.SKIP,
            "incremental": bool(start_date),
        }
    except Exception as e:
        return {"ticker": ticker, "error": str(e)}


async def _save_news_items(
    db: AsyncSession,
    stock: models.Stock,
    news_items: List[Dict[str, Any]],
    analyzer: Optional[Any] = None,
) -> int:
    saved = 0
    sentiment_calls = 0
    max_sentiment_per_batch = 3

    for item in news_items:
        news_exists = await db.execute(
            select(models.News).where(models.News.url == item["url"])
        )
        if news_exists.scalars().first():
            continue

        sentiment_score = item.get("sentiment_score")
        summary = item.get("summary")
        hot_keywords = item.get("hot_keywords")

        if (
            analyzer is not None
            and getattr(analyzer, "model", None) is not None
            and sentiment_calls < max_sentiment_per_batch
        ):
            content = item.get("title", "")
            body = item.get("summary") or item.get("content") or ""
            if body:
                content = f"{content}\n{body}"
            result = await analyzer.analyze_sentiment(content[:2000])
            if "error" not in result:
                sentiment_score = result.get("sentiment_score", sentiment_score)
                summary = result.get("summary") or summary
                hot_keywords = result.get("hot_keywords") or hot_keywords
                sentiment_calls += 1

        db.add(
            models.News(
                stock_id=stock.id,
                title=item["title"],
                content=item.get("content"),
                url=item["url"],
                source=item.get("source"),
                published_at=item.get("published_at"),
                sentiment_score=sentiment_score,
                summary=summary,
                hot_keywords=hot_keywords,
            )
        )
        saved += 1
    return saved


async def _persist_quote_and_news(
    db: AsyncSession,
    fetch_results: List[Dict[str, Any]],
    collected_at: datetime,
    analyzer: Optional[Any] = None,
) -> Tuple[int, List[str], List[models.Stock], int, int]:
    """시세·뉴스 저장. (성공수, errors, stocks, 신규뉴스수, 뉴스스킵수) 반환."""
    from ..data.ticker_utils import is_kr_ticker
    from .investor_flow_crawler import collect_investor_flow_for_stock

    processed_count = 0
    errors: List[str] = []
    saved_stocks: List[models.Stock] = []
    new_news_count = 0
    news_skip_count = 0

    for res in fetch_results:
        ticker = res["ticker"]
        if "error" in res:
            errors.append(f"{ticker}: {res['error']}")
            continue

        data = res["data"]
        stock = await collect_stock_features(db, data, collected_at=collected_at)
        if stock is None:
            errors.append(f"{ticker}: feature collection failed")
            continue

        stock.ai_score = None
        stock.ai_recommendation = None
        stock.ai_analysis = None

        if res.get("news_skipped"):
            news_skip_count += 1
        else:
            new_news_count += await _save_news_items(
                db, stock, res.get("news", []), analyzer=analyzer
            )
            mark_news_collected(stock, collected_at)

        if is_kr_ticker(ticker):
            try:
                await collect_investor_flow_for_stock(db, stock, collected_at=collected_at)
            except Exception as e:
                errors.append(f"{ticker}: investor flow failed ({e})")

        saved_stocks.append(stock)
        processed_count += 1

    return processed_count, errors, saved_stocks, new_news_count, news_skip_count


async def _build_universe(db: AsyncSession, collector) -> List[str]:
    """KR Top 1000 + PRICE_UNIVERSE + watchlist + 수동 크롤링 타겟 유니버스."""
    kr_top_1000 = await asyncio.to_thread(collector.get_top_tickers, "KR", 1000)
    
    # 관심종목 가져오기
    watchlist_res = await db.execute(select(models.Watchlist.ticker))
    watchlist_tickers = [r for r in watchlist_res.scalars().all()]
    
    # 수동 크롤링 타겟 종목 가져오기
    target_res = await db.execute(select(models.Stock.ticker).where(models.Stock.is_crawling_target == True))
    target_tickers = [r for r in target_res.scalars().all()]
    
    return list(set(PRICE_UNIVERSE_TICKERS) | set(kr_top_1000) | set(watchlist_tickers) | set(target_tickers))


async def _collect_ticker_batch(
    db: AsyncSession,
    collector,
    universe: List[str],
    collected_at: datetime,
) -> Dict[str, Any]:
    """2-phase 수집: fetch → save (재무 분석은 InsightCollectionPipeline에서 별도 실행)."""
    total = len(universe)
    indices = collector.get_market_indices()
    news_contexts = await load_news_crawl_contexts(db, universe)
    skip_count = count_skip_tickers(news_contexts)

    semaphore = asyncio.Semaphore(15)

    async def bounded_fetch(ticker: str):
        async with semaphore:
            ctx = news_contexts.get(ticker)
            return await _fetch_ticker_async(db, collector, ticker, ctx)

    task_logger.info(
        "collect.fetching_data_parallel started tickers=%d news_skip=%d",
        total,
        skip_count,
    )
    fetch_results = await asyncio.gather(*(bounded_fetch(t) for t in universe))
    task_logger.info("collect.fetching_data_parallel completed")

    from .analyzer import AIAnalyzer

    analyzer = AIAnalyzer()
    (
        processed_count,
        errors,
        saved_stocks,
        new_news_count,
        news_skip_count,
    ) = await _persist_quote_and_news(
        db, fetch_results, collected_at, analyzer=analyzer
    )
    await db.commit()

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

    return {
        "processed_count": processed_count,
        "errors": errors,
        "indices": indices,
        "new_news_count": new_news_count,
        "news_skip_count": news_skip_count,
    }


class DataCollectionPipeline:
    def __init__(self):
        from .collector import DataCollector

        self.collector = DataCollector()

    async def run_stream(self, db: AsyncSession, target: str = "all"):
        """실시간 진행률을 yield하는 비동기 수집 파이프라인
        target: all | market | news
        """
        started = time.perf_counter()

        collect_market = target in ("all", "market")
        collect_news = target in ("all", "news")

        yield {"progress": 0, "message": "상위 1000종목 리스트 추출 중...", "status": "collecting"}
        universe = await _build_universe(db, self.collector)
        total = len(universe)

        indices = []
        if collect_market:
            yield {"progress": 2, "message": "시장 지수 수집 중...", "status": "collecting"}
            indices = self.collector.get_market_indices()
        
        # 현재 시간을 KST로 고정
        collected_at = datetime.now(KST)

        processed_count = 0
        errors: List[str] = []
        saved_stocks: List[models.Stock] = []
        new_news_count = 0
        news_skip_count = 0

        news_contexts = {}
        if collect_news:
            news_contexts = await load_news_crawl_contexts(db, universe)
        
        skip_count = count_skip_tickers(news_contexts)

        semaphore = asyncio.Semaphore(15)

        async def bounded_fetch(ticker: str):
            async with semaphore:
                # collect_news가 아니면 ctx는 None
                ctx = news_contexts.get(ticker) if collect_news else NewsCrawlContext(mode=NewsCrawlMode.SKIP)
                return await _fetch_ticker_async(db, self.collector, ticker, ctx)

        msg = f"총 {total}개 종목 "
        if collect_market and collect_news:
            msg += f"시세·뉴스 페치 시작 (뉴스 스킵 {skip_count}종목)..."
        elif collect_market:
            msg += "시세 데이터 페치 시작..."
        else:
            msg += f"뉴스 데이터 페치 시작 (스킵 {skip_count}종목)..."

        yield {
            "progress": 5,
            "message": msg,
            "status": "collecting",
        }
        
        fetch_tasks = [asyncio.create_task(bounded_fetch(t)) for t in universe]
        fetch_results = []
        for i, coro in enumerate(asyncio.as_completed(fetch_tasks), start=1):
            res = await coro
            fetch_results.append(res)
            if i % 10 == 0 or i == total:
                progress = int(5 + (i / total) * 60)
                yield {
                    "progress": progress,
                    "message": f"시세·뉴스 페치 중... ({i}/{total})",
                    "status": "collecting",
                }

        yield {"progress": 65, "message": "데이터 페치 완료, DB 저장 중...", "status": "collecting"}

        from ..data.ticker_utils import is_kr_ticker
        from .analyzer import AIAnalyzer
        from .investor_flow_crawler import collect_investor_flow_for_stock

        analyzer = AIAnalyzer() if collect_news else None
        incremental_count = 0
        for i, res in enumerate(fetch_results, start=1):
            ticker = res["ticker"]
            progress = int(65 + (i / total) * 15)

            if "error" in res:
                errors.append(f"{ticker}: {res['error']}")
                continue
            
            if res.get("incremental"):
                incremental_count += 1

            data = res["data"]
            # 시세 업데이트 여부와 상관없이 Stock 객체는 가져와야 함 (뉴스 저장 위해)
            stock = await collect_stock_features(db, data, collected_at=collected_at if collect_market else None)
            if stock is None:
                errors.append(f"{ticker}: feature collection failed")
                continue

            if collect_market:
                stock.ai_score = None
                stock.ai_recommendation = None
                stock.ai_analysis = None

            if collect_news:
                if res.get("news_skipped"):
                    news_skip_count += 1
                else:
                    new_news_count += await _save_news_items(
                        db, stock, res.get("news", []), analyzer=analyzer
                    )
                    mark_news_collected(stock, collected_at)

            if collect_market and is_kr_ticker(ticker):
                try:
                    await collect_investor_flow_for_stock(
                        db, stock, collected_at=collected_at
                    )
                except Exception as e:
                    errors.append(f"{ticker}: investor flow failed ({e})")

            saved_stocks.append(stock)
            processed_count += 1

            if i % 20 == 0 or i == total:
                await db.commit()

        yield {"progress": 80, "message": "수집 완료 처리 중...", "status": "collecting"}

        report_result = await db.execute(select(models.MarketReport).limit(1))
        report = report_result.scalars().first()
        if not report:
            report = models.MarketReport()
            db.add(report)

        if collect_market:
            report.indices = indices
            report.data_collected_at = collected_at
        
        report.updated_at = collected_at
        await db.commit()

        elapsed = time.perf_counter() - started
        
        final_msg = "수집 완료! "
        if collect_market:
            final_msg += f"시세 {processed_count}개(증분 {incremental_count}개), "
        if collect_news:
            final_msg += f"뉴스 신규 {new_news_count}건 (스킵 {news_skip_count}), "
        final_msg += f"{len(errors)}개 실패, {elapsed:.1f}초"

        yield {
            "progress": 100,
            "message": final_msg,
            "status": "done",
            "processed_count": processed_count,
        }

    async def run(self, db: AsyncSession) -> Dict[str, Any]:
        started = time.perf_counter()
        universe = await _build_universe(db, self.collector)
        task_logger.info("collect.start tickers=%d", len(universe))

        collected_at = datetime.now(KST)
        result = await _collect_ticker_batch(db, self.collector, universe, collected_at)

        elapsed = time.perf_counter() - started
        task_logger.info(
            "collect.done processed=%d errors=%d duration=%.1fs",
            result["processed_count"],
            len(result["errors"]),
            elapsed,
        )
        return {
            "message": "데이터 불러오기가 완료되었습니다.",
            "collected_at": collected_at.isoformat(),
            "processed_count": result["processed_count"],
            "errors": result["errors"],
        }


async def _resolve_insight_stocks(
    db: AsyncSession,
    collector,
    scope: str,
) -> List[models.Stock]:
    if scope == "watchlist":
        result = await db.execute(
            select(models.Stock)
            .join(models.Watchlist, models.Stock.ticker == models.Watchlist.ticker)
        )
        return list(result.scalars().all())

    universe = await _build_universe(db, collector)
    result = await db.execute(
        select(models.Stock).where(models.Stock.ticker.in_(universe))
    )
    stocks_by_ticker = {s.ticker: s for s in result.scalars().all()}
    missing = [t for t in universe if t not in stocks_by_ticker]
    for ticker in missing:
        stock = models.Stock(ticker=ticker)
        db.add(stock)
        stocks_by_ticker[ticker] = stock
    if missing:
        await db.flush()
    return [stocks_by_ticker[t] for t in universe if t in stocks_by_ticker]


class InsightCollectionPipeline:
    """관심종목 또는 전체 유니버스 재무·사업 분석 (DART/SEC)."""

    def __init__(self):
        from .collector import DataCollector

        self.collector = DataCollector()

    async def run_stream(self, db: AsyncSession, scope: str = "watchlist"):
        started = time.perf_counter()
        scope_label = "관심종목" if scope == "watchlist" else "전체 유니버스"

        yield {
            "progress": 0,
            "stage": "financial_analysis",
            "message": f"{scope_label} 목록 조회 중...",
            "status": "running",
        }

        stocks = await _resolve_insight_stocks(db, self.collector, scope)
        pending = [s for s in stocks if not _is_cache_valid(s)]
        total = len(pending)
        skipped = len(stocks) - total

        if total == 0:
            yield {
                "progress": 100,
                "stage": "financial_analysis",
                "message": f"분석 대상 없음 (캐시 유효 {skipped}종목)",
                "status": "done",
                "done_count": 0,
                "total": 0,
                "skipped_count": skipped,
            }
            return

        yield {
            "progress": 5,
            "stage": "financial_analysis",
            "message": f"재무·사업 분석 시작 ({total}종목, 캐시 스킵 {skipped}종목)...",
            "status": "running",
            "done_count": 0,
            "total": total,
            "skipped_count": skipped,
        }

        errors: List[str] = []
        done_count = 0
        semaphore = asyncio.Semaphore(2)

        async def _one(stock: models.Stock) -> None:
            nonlocal done_count
            async with semaphore:
                try:
                    await collect_business_insight_for_stock(db, stock)
                except Exception as e:
                    errors.append(f"{stock.ticker}: business insight failed ({e})")
                done_count += 1

        tasks = [asyncio.create_task(_one(s)) for s in pending]
        for coro in asyncio.as_completed(tasks):
            await coro
            progress = int(5 + (done_count / total) * 90)
            current = pending[min(done_count, total - 1)] if pending else None
            ticker_label = current.ticker if current else ""
            yield {
                "progress": progress,
                "stage": "financial_analysis",
                "message": f"재무·사업 분석 중... {ticker_label} ({done_count}/{total})",
                "status": "running",
                "done_count": done_count,
                "total": total,
            }

        await db.commit()
        elapsed = time.perf_counter() - started
        yield {
            "progress": 100,
            "stage": "financial_analysis",
            "message": f"재무·사업 분석 완료! {done_count}종목, {len(errors)}개 실패, {elapsed:.1f}초",
            "status": "done",
            "done_count": done_count,
            "total": total,
            "skipped_count": skipped,
            "errors": errors[:10],
        }


DISCLOSURE_CACHE_HOURS = 24


def _is_disclosure_cache_valid(collected_at: Optional[datetime]) -> bool:
    if collected_at is None:
        return False
    if collected_at.tzinfo is None:
        collected_at = collected_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - collected_at < timedelta(hours=DISCLOSURE_CACHE_HOURS)


async def _resolve_disclosure_stocks(
    db: AsyncSession,
    collector,
    scope: str,
) -> List[models.Stock]:
    from ..data.ticker_utils import is_kr_ticker

    stocks = await _resolve_insight_stocks(db, collector, scope)
    return [s for s in stocks if is_kr_ticker(s.ticker)]


async def _latest_disclosure_collected_at(
    db: AsyncSession, stock_id: int
) -> Optional[datetime]:
    from sqlalchemy import func

    result = await db.execute(
        select(func.max(models.Disclosure.collected_at)).where(
            models.Disclosure.stock_id == stock_id
        )
    )
    return result.scalar_one_or_none()


async def _save_disclosures_for_stock(
    db: AsyncSession,
    stock: models.Stock,
    collected_at: datetime,
) -> int:
    from .disclosure_crawler import DisclosureCrawler

    crawler = DisclosureCrawler()
    records = await asyncio.to_thread(crawler.fetch_recent, stock.ticker)
    saved = 0
    for rec in records:
        exists = await db.execute(
            select(models.Disclosure).where(models.Disclosure.rcept_no == rec.rcept_no)
        )
        if exists.scalars().first():
            continue
        db.add(
            models.Disclosure(
                stock_id=stock.id,
                rcept_no=rec.rcept_no,
                report_nm=rec.report_nm,
                report_type=rec.report_type,
                rcept_dt=rec.rcept_dt,
                dart_url=rec.dart_url,
                summary=rec.summary,
                collected_at=collected_at,
            )
        )
        saved += 1
    return saved


class DisclosureCollectionPipeline:
    """국내 종목 DART 공시 수집."""

    def __init__(self):
        from .collector import DataCollector

        self.collector = DataCollector()

    async def run_stream(self, db: AsyncSession, scope: str = "watchlist"):
        started = time.perf_counter()
        scope_label = "관심종목" if scope == "watchlist" else "전체 유니버스"

        yield {
            "progress": 0,
            "stage": "disclosure_collection",
            "message": f"{scope_label} 공시 수집 대상 조회 중...",
            "status": "running",
        }

        stocks = await _resolve_disclosure_stocks(db, self.collector, scope)
        pending: List[models.Stock] = []
        skipped = 0
        for stock in stocks:
            last_at = await _latest_disclosure_collected_at(db, stock.id) if stock.id else None
            if _is_disclosure_cache_valid(last_at):
                skipped += 1
            else:
                pending.append(stock)

        total = len(pending)
        if total == 0:
            yield {
                "progress": 100,
                "stage": "disclosure_collection",
                "message": f"공시 수집 대상 없음 (캐시 유효 {skipped}종목)",
                "status": "done",
                "done_count": 0,
                "total": 0,
                "skipped_count": skipped,
            }
            return

        yield {
            "progress": 5,
            "stage": "disclosure_collection",
            "message": f"공시 수집 시작 ({total}종목, 캐시 스킵 {skipped}종목)...",
            "status": "running",
            "done_count": 0,
            "total": total,
            "skipped_count": skipped,
        }

        errors: List[str] = []
        done_count = 0
        saved_total = 0
        collected_at = datetime.now(KST)
        semaphore = asyncio.Semaphore(2)

        async def _one(stock: models.Stock) -> None:
            nonlocal done_count, saved_total
            async with semaphore:
                try:
                    saved_total += await _save_disclosures_for_stock(
                        db, stock, collected_at
                    )
                except Exception as e:
                    errors.append(f"{stock.ticker}: disclosure failed ({e})")
                done_count += 1

        tasks = [asyncio.create_task(_one(s)) for s in pending]
        for coro in asyncio.as_completed(tasks):
            await coro
            progress = int(5 + (done_count / total) * 90)
            current = pending[min(done_count, total - 1)] if pending else None
            ticker_label = current.ticker if current else ""
            yield {
                "progress": progress,
                "stage": "disclosure_collection",
                "message": f"공시 수집 중... {ticker_label} ({done_count}/{total})",
                "status": "running",
                "done_count": done_count,
                "total": total,
            }

        await db.commit()
        elapsed = time.perf_counter() - started
        yield {
            "progress": 100,
            "stage": "disclosure_collection",
            "message": (
                f"공시 수집 완료! {done_count}종목, 신규 {saved_total}건, "
                f"{len(errors)}개 실패, {elapsed:.1f}초"
            ),
            "status": "done",
            "done_count": done_count,
            "total": total,
            "skipped_count": skipped,
            "saved_count": saved_total,
            "errors": errors[:10],
        }


async def build_collect_status(db: AsyncSession, collector) -> Dict[str, Any]:
    """데이터 로딩 페이지용 수집 현황 집계."""
    from sqlalchemy import func

    report_result = await db.execute(
        select(models.MarketReport).order_by(models.MarketReport.updated_at.desc()).limit(1)
    )
    report = report_result.scalars().first()

    trade_date = await latest_trade_date(db)

    stock_count_result = await db.execute(
        select(func.count()).select_from(models.Stock).where(
            models.Stock.change_rate.isnot(None)
        )
    )
    stock_count = stock_count_result.scalar() or 0

    universe = await _build_universe(db, collector)

    news_max_result = await db.execute(
        select(func.max(models.Stock.news_collected_at))
    )
    news_last = news_max_result.scalar()

    news_total_result = await db.execute(select(func.count()).select_from(models.News))
    news_total = news_total_result.scalar() or 0

    stocks_with_news_result = await db.execute(
        select(func.count(func.distinct(models.News.stock_id))).where(
            models.News.stock_id.isnot(None)
        )
    )
    stocks_with_news = stocks_with_news_result.scalar() or 0

    fin_max_result = await db.execute(
        select(func.max(models.Stock.financials_collected_at))
    )
    fin_last = fin_max_result.scalar()

    analyzed_result = await db.execute(
        select(func.count()).select_from(models.Stock).where(
            models.Stock.business_insight.isnot(None)
        )
    )
    analyzed_count = analyzed_result.scalar() or 0

    watchlist_result = await db.execute(
        select(models.Stock)
        .join(models.Watchlist, models.Stock.ticker == models.Watchlist.ticker)
    )
    watchlist_stocks = list(watchlist_result.scalars().all())
    watchlist_total = len(watchlist_stocks)
    watchlist_analyzed = sum(
        1 for s in watchlist_stocks if s.business_insight is not None
    )

    disc_max_result = await db.execute(
        select(func.max(models.Disclosure.collected_at))
    )
    disc_last = disc_max_result.scalar()

    disc_total_result = await db.execute(
        select(func.count()).select_from(models.Disclosure)
    )
    disc_total = disc_total_result.scalar() or 0

    stocks_with_disc_result = await db.execute(
        select(func.count(func.distinct(models.Disclosure.stock_id)))
    )
    stocks_with_disc = stocks_with_disc_result.scalar() or 0

    flow_max_result = await db.execute(
        select(func.max(models.StockInvestorFlow.collected_at))
    )
    flow_last = flow_max_result.scalar()

    flow_total_result = await db.execute(
        select(func.count()).select_from(models.StockInvestorFlow)
    )
    flow_total = flow_total_result.scalar() or 0

    stocks_with_flow_result = await db.execute(
        select(func.count(func.distinct(models.StockInvestorFlow.stock_id)))
    )
    stocks_with_flow = stocks_with_flow_result.scalar() or 0

    return {
        "market": {
            "last_collected_at": report.data_collected_at if report else None,
            "trade_date": trade_date,
            "stock_count": stock_count,
            "universe_estimate": len(universe),
        },
        "news": {
            "last_collected_at": news_last,
            "total_articles": news_total,
            "stocks_with_news": stocks_with_news,
        },
        "financials": {
            "last_collected_at": fin_last,
            "analyzed_count": analyzed_count,
            "watchlist_analyzed": watchlist_analyzed,
            "watchlist_total": watchlist_total,
            "pending_watchlist": max(watchlist_total - watchlist_analyzed, 0),
        },
        "report": {
            "last_generated_at": report.report_generated_at if report else None,
            "next_refresh_at": report.next_refresh_at if report else None,
        },
        "disclosures": {
            "last_collected_at": disc_last,
            "total_disclosures": disc_total,
            "stocks_with_disclosures": stocks_with_disc,
        },
        "investor_flow": {
            "last_collected_at": flow_last,
            "total_rows": flow_total,
            "stocks_with_flow": stocks_with_flow,
        },
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
