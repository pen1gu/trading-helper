import os
import json
import google.generativeai as genai
from typing import Dict, Any, List
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

class AIAnalyzer:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
        else:
            self.model = None

    async def analyze_stock(self, stock_data: Dict[str, Any], news_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        주식 데이터와 뉴스를 기반으로 AI 분석을 수행합니다.
        """
        if not self.model:
            return {"error": "Gemini API key not configured"}

        # JSON 직렬화 전 datetime 객체를 문자열로 변환
        serialized_news = []
        for n in news_list:
            item = n.copy()
            if isinstance(item.get('published_at'), datetime):
                item['published_at'] = item['published_at'].isoformat()
            serialized_news.append(item)

        prompt = f"""
        당신은 전문 주식 분석가입니다. 다음 주식 데이터와 최신 뉴스를 바탕으로 상세 분석을 수행해주세요.

        [주식 데이터]
        {json.dumps(stock_data, ensure_ascii=False, indent=2)}

        [최신 뉴스]
        {json.dumps(serialized_news, ensure_ascii=False, indent=2)}

        분석 결과는 반드시 다음 JSON 형식으로 응답해주세요:
        {{
            "ai_score": (0~100 사이의 점수),
            "ai_recommendation": ("Long", "Short", "Neutral" 중 하나),
            "ai_analysis": {{
                "strengths": ["강점1", "강점2", "강점3"],
                "weaknesses": ["약점1", "약점2", "약점3"],
                "radar_chart": {{
                    "profitability": (0~10),
                    "growth": (0~10),
                    "valuation": (0~10),
                    "stability": (0~10),
                    "momentum": (0~10)
                }}
            }},
            "summary": "3줄 요약 내용"
        }}
        """
        
        try:
            response = self.model.generate_content(prompt)
            text = response.text
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            
            return json.loads(text.strip())
        except Exception as e:
            print(f"Error during AI analysis: {e}")
            return {"error": str(e)}

    async def analyze_sentiment(self, news_content: str) -> Dict[str, Any]:
        """
        뉴스 기사의 감성 분석을 수행합니다.
        """
        if not self.model:
            return {"error": "Gemini API key not configured"}

        prompt = f"""
        다음 뉴스 기사의 시장 센티멘트를 분석해주세요.
        
        [기사 내용]
        {news_content}
        
        결과는 반드시 다음 JSON 형식으로 응답해주세요:
        {{
            "sentiment_score": (0~100, 100에 가까울수록 긍정),
            "summary": "뉴스 3줄 요약",
            "hot_keywords": ["키워드1", "키워드2", "키워드3"]
        }}
        """
        
        try:
            response = self.model.generate_content(prompt)
            text = response.text
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            
            return json.loads(text.strip())
        except Exception as e:
            print(f"Error during sentiment analysis: {e}")
            return {"error": str(e)}
