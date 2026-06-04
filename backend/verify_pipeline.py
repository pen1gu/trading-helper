import asyncio
import sys
import os

# backend 패키지를 찾을 수 있도록 경로 추가
sys.path.append(os.path.join(os.getcwd(), 'src'))

from backend.services.collector import DataCollector
from backend.services.analyzer import AIAnalyzer

async def test_pipeline():
    print("=== Pipeline Verification Start ===")
    
    collector = DataCollector()
    analyzer = AIAnalyzer()
    
    # 1. KR Stock Data Test
    print("\n[1] Testing KR Data Collection (Samsung Electronics)...")
    kr_data = collector.get_kr_stock_data("005930")
    print(f"KR Data: {kr_data}")
    
    # 2. US Stock Data Test
    print("\n[2] Testing US Data Collection (NVIDIA)...")
    us_data = collector.get_us_stock_data("NVDA")
    print(f"US Data: {us_data}")
    
    # 3. News Collection Test
    print("\n[3] Testing News Collection (NVIDIA)...")
    news = collector.get_stock_news("NVDA", "NVIDIA")
    print(f"Collected {len(news)} news items.")
    if news:
        print(f"First News: {news[0]['title']}")
    
    # 4. AI Analysis Test (Dry Run)
    if os.getenv("GEMINI_API_KEY"):
        print("\n[4] Testing AI Analysis with Gemini...")
        analysis = await analyzer.analyze_stock(us_data, news[:2])
        print(f"AI Analysis Result: {analysis}")
    else:
        print("\n[4] Skipping AI Analysis (GEMINI_API_KEY not found in .env)")
        
    print("\n=== Pipeline Verification Completed ===")

if __name__ == "__main__":
    asyncio.run(test_pipeline())
