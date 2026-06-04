from .celery_app import celery_app
from .services.collector import DataCollector
from .services.analyzer import AIAnalyzer
from .database import AsyncSessionLocal
from . import models
from sqlalchemy import select
from datetime import datetime
import asyncio

@celery_app.task(name="collect_stock_data_task")
def collect_stock_data_task():
    return asyncio.run(_collect_and_analyze())

async def _collect_and_analyze():
    collector = DataCollector()
    analyzer = AIAnalyzer()
    
    async with AsyncSessionLocal() as db:
        # 1. 관심 종목 수집 (예시 티커)
        tickers = ["005930", "AAPL", "NVDA", "000660"]
        
        for ticker in tickers:
            print(f"Processing {ticker}...")
            # 주식 기초 데이터 수집
            if ticker.isdigit():
                data = collector.get_kr_stock_data(ticker)
            else:
                data = collector.get_us_stock_data(ticker)
            
            if not data: continue
            
            # 뉴스 수집
            news_items = collector.get_stock_news(ticker, data['name'])
            
            # AI 분석 (주식 + 뉴스 통합)
            analysis = await analyzer.analyze_stock(data, news_items)
            
            # DB 저장 (Stock)
            result = await db.execute(select(models.Stock).where(models.Stock.ticker == ticker))
            stock = result.scalars().first()
            
            if stock:
                for key, value in data.items():
                    setattr(stock, key, value)
                stock.ai_score = analysis.get("ai_score")
                stock.ai_recommendation = analysis.get("ai_recommendation")
                stock.ai_analysis = analysis.get("ai_analysis")
            else:
                stock = models.Stock(
                    **data,
                    ai_score=analysis.get("ai_score"),
                    ai_recommendation=analysis.get("ai_recommendation"),
                    ai_analysis=analysis.get("ai_analysis")
                )
                db.add(stock)
            
            await db.flush() # stock.id 확보

            # DB 저장 (News) - 뉴스마다 감성 분석 수행 후 저장
            for item in news_items:
                # 이미 저장된 뉴스인지 확인
                news_exists = await db.execute(select(models.News).where(models.News.url == item['url']))
                if news_exists.scalars().first(): continue
                
                sentiment = await analyzer.analyze_sentiment(item['title'] + " " + item['content'])
                
                db_news = models.News(
                    stock_id=stock.id,
                    title=item['title'],
                    content=item['content'],
                    url=item['url'],
                    source=item['source'],
                    published_at=item['published_at'],
                    sentiment_score=sentiment.get("sentiment_score"),
                    summary=sentiment.get("summary"),
                    hot_keywords=sentiment.get("hot_keywords")
                )
                db.add(db_news)
        
        await db.commit()
    return "Full collection, news analysis, and AI scoring completed."
