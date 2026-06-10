import os
import json
import time
import google.generativeai as genai
from typing import Dict, Any, List
from datetime import datetime
from dotenv import load_dotenv

from ..logging_config import task_logger

load_dotenv()

class AIAnalyzer:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
        if api_key:
            masked_key = f"{api_key[:4]}...{api_key[-4:]}"
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel(self.model_name)
            task_logger.info("gemini.ready model=%s key=%s", self.model_name, masked_key)
        else:
            self.model = None
            task_logger.warning("gemini.disabled GEMINI_API_KEY not set")

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

        분석 결과는 반드시 다음 JSON 형식으로 응답해주세요 (모든 텍스트는 한국어):
        {{
            "ai_score": (0~100 사이의 점수),
            "ai_recommendation": ("Long", "Short", "Neutral" 중 하나),
            "hot_reason": "왜 지금 이 종목이 금일 이슈가 되고 있는지 2~3문장으로 설명 (뉴스·수치 근거 포함)",
            "fair_price_range": {{
                "min": (숫자, 현재가와 펀더멘털 기반 매수 적정가 하단),
                "max": (숫자, 현재가와 펀더멘털 기반 매수 적정가 상단),
                "reason": "적정가 산출 근거. 과거 재무(PER/PBR 등)뿐만 아니라 최근 20일/60일 가격 모멘텀과 급등에 따른 '거품(Bubble)' 가능성을 반드시 반영하여 할인/할증 여부를 명시할 것 (1~2문장)"
            }},
            "ai_analysis": {{
                "strengths": ["강점1", "강점2", "강점3"],
                "weaknesses": ["약점1 (거품이나 단기 과열 리스크가 있다면 반드시 포함할 것)", "약점2", "약점3"],
                "radar_chart": {{
                    "profitability": (0~10),
                    "growth": (0~10),
                    "valuation": (0~10, 고평가/거품일수록 낮은 점수 부여),
                    "stability": (0~10),
                    "momentum": (0~10, 최근 가격 변동 및 뉴스 트렌드 반영)
                }}
            }},
            "summary": "핵심 요약 3줄"
        }}

        중요:
        1. 모든 퍼센테이지 수치는 소수점 3자리에서 반올림하여 2자리까지만 언급하세요.
        2. 적정 주가(fair_price_range)를 산정할 때, 순수 가치투자 기준만 고집하지 마십시오. 최근 뉴스의 모멘텀, 테마성 급등, 20일/60일 고점 대비 현재가(과열 여부)를 종합적으로 고려하여 현재 시장 상황에 맞는 현실적인 적정가를 제시하세요. 거품이 끼어있다고 판단되면 현재가보다 낮은 적정가를 제시하고 그 이유를 적으세요.
        """
        
        try:
            started = time.perf_counter()
            task_logger.info("gemini.request op=analyze_stock model=%s", self.model_name)
            response = self.model.generate_content(prompt)
            task_logger.info(
                "gemini.response op=analyze_stock model=%s duration=%.1fs",
                self.model_name,
                time.perf_counter() - started,
            )
            text = response.text
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            
            result = json.loads(text.strip())
            return self._normalize_stock_analysis(result)
        except Exception as e:
            task_logger.exception("gemini.error op=analyze_stock model=%s", self.model_name)
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
            return {"error": str(e)}

    @staticmethod
    def _normalize_stock_analysis(result: Dict[str, Any]) -> Dict[str, Any]:
        """hot_reason·summary·fair_price_range를 ai_analysis JSON에 병합해 DB 저장 형식으로 정규화합니다."""
        if "error" in result:
            return result
        ai_analysis = result.get("ai_analysis") or {}
        if result.get("hot_reason"):
            ai_analysis["hot_reason"] = result["hot_reason"]
        if result.get("summary"):
            ai_analysis["summary"] = result["summary"]
        if result.get("fair_price_range"):
            ai_analysis["fair_price_range"] = result["fair_price_range"]
        result["ai_analysis"] = ai_analysis
        return result

    async def generate_market_briefing(
        self,
        indices: List[Dict[str, Any]],
        top_longs: List[Dict[str, Any]],
        top_shorts: List[Dict[str, Any]],
        recent_news: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        시장 지수·Top3·뉴스를 바탕으로 홈 화면 AI 브리핑을 생성합니다.
        """
        if not self.model:
            return {"error": "Gemini API key not configured"}

        serialized_news = []
        for n in recent_news[:15]:
            item = n.copy()
            if isinstance(item.get("published_at"), datetime):
                item["published_at"] = item["published_at"].isoformat()
            serialized_news.append(item)

        prompt = f"""
        당신은 전문 시장 애널리스트입니다. 다음 데이터를 바탕으로 오늘의 시장 브리핑을 작성해주세요.

        [시장 지수]
        {json.dumps(indices, ensure_ascii=False, indent=2)}

        [매수(롱) Top 3]
        {json.dumps(top_longs, ensure_ascii=False, indent=2)}

        [매도(숏) Top 3]
        {json.dumps(top_shorts, ensure_ascii=False, indent=2)}

        [최근 뉴스]
        {json.dumps(serialized_news, ensure_ascii=False, indent=2)}

        반드시 다음 JSON 형식으로 응답 (모든 텍스트 한국어):
        {{
            "summary": "오늘 시장 전반을 한 문단으로 요약",
            "highlights": [
                {{"type": "핵심", "text": "핵심 인사이트 1"}},
                {{"type": "주의", "text": "주의할 점 1"}}
            ]
        }}
        """

        try:
            started = time.perf_counter()
            task_logger.info("gemini.request op=market_briefing model=%s", self.model_name)
            response = self.model.generate_content(prompt)
            task_logger.info(
                "gemini.response op=market_briefing model=%s duration=%.1fs",
                self.model_name,
                time.perf_counter() - started,
            )
            text = response.text
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            return json.loads(text.strip())
        except Exception as e:
            task_logger.exception("gemini.error op=market_briefing model=%s", self.model_name)
            return {"error": str(e)}

    async def generate_position_report(
        self,
        indices: List[Dict[str, Any]],
        long_contexts: List[Dict[str, Any]],
        short_contexts: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        DB에 저장된 당일·과거 피처와 뉴스만 근거로 롱/숏 Top5 리포트를 작성합니다.
        """
        if not self.model:
            return {"error": "Gemini API key not configured"}

        prompt = f"""
        당신은 전문 시장 애널리스트입니다. 아래 데이터베이스 피처와 뉴스만 사용해
        매수(롱) Top5와 매도(숏) Top5 리포트를 작성해주세요.

        중요 규칙:
        - 제공된 DB 컬럼 값과 뉴스에 없는 숫자·사실은 만들지 마세요.
        - 각 회사마다 주요 이슈, 주가 영향 이벤트, 실적/제품/파트너십 등을 3줄 이내로 정리하세요.
        - 각 회사 설명에는 전일비, 현재가, 20일 평균 대비, 60일 고저 대비 등 제공된 수치 중
          의미 있는 수치를 반드시 근거로 포함하세요.
        - 각 회사 설명은 뉴스·동향 근거와 수치 근거가 연결되어야 합니다.
        - 마지막에 전체 시장 분위기를 한 문단으로 정리하세요.

        [시장 지수]
        {json.dumps(indices, ensure_ascii=False, indent=2, default=str)}

        [매수(롱) Top5 컨텍스트]
        {json.dumps(long_contexts, ensure_ascii=False, indent=2, default=str)}

        [매도(숏) Top5 컨텍스트]
        {json.dumps(short_contexts, ensure_ascii=False, indent=2, default=str)}

        반드시 다음 JSON 형식으로만 응답하세요:
        {{
            "long_top5": [
                {{
                    "ticker": "종목코드",
                    "name": "회사명",
                    "lines": ["3줄 이내 문장1", "문장2", "문장3"],
                    "news_citations": ["근거 뉴스 URL 또는 제목"]
                }}
            ],
            "short_top5": [
                {{
                    "ticker": "종목코드",
                    "name": "회사명",
                    "lines": ["3줄 이내 문장1", "문장2", "문장3"],
                    "news_citations": ["근거 뉴스 URL 또는 제목"]
                }}
            ],
            "market_mood": "전체 시장 분위기 한 문단",
            "highlights": [
                {{"type": "핵심", "text": "핵심 인사이트"}},
                {{"type": "주의", "text": "주의할 점"}}
            ]
        }}
        """

        try:
            started = time.perf_counter()
            task_logger.info(
                "gemini.request op=position_report model=%s long=%d short=%d",
                self.model_name,
                len(long_contexts),
                len(short_contexts),
            )
            response = self.model.generate_content(prompt)
            task_logger.info(
                "gemini.response op=position_report model=%s duration=%.1fs",
                self.model_name,
                time.perf_counter() - started,
            )
            text = response.text
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            return json.loads(text.strip())
        except Exception as e:
            task_logger.exception(
                "gemini.error op=position_report model=%s", self.model_name
            )
            return {"error": str(e)}
