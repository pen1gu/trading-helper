import requests
import os
from dotenv import load_dotenv
from typing import List, Dict, Any

load_dotenv()

class DiscordNotifier:
    def __init__(self):
        self.webhook_url = os.getenv("DISCORD_WEBHOOK_URL")

    def send_morning_report(self, top_longs: List[Dict[str, Any]], top_shorts: List[Dict[str, Any]], market_summary: str):
        """
        매일 아침 장 시작 전 브리핑을 디코드로 전송합니다.
        """
        if not self.webhook_url:
            return

        embeds = [
            {
                "title": "☀️ StockInsight AI 모닝 브리핑",
                "description": market_summary,
                "color": 0x3b82f6, # Blue
                "fields": [
                    {
                        "name": "🚀 매수 Top 3 (롱)",
                        "value": "\n".join([
                            f"**{s['name']}** ({s['ticker']}): {s.get('ai_score', '-')}점\n↳ {s.get('hot_reason', '')[:80]}"
                            for s in top_longs
                        ]) or "데이터 없음",
                        "inline": False
                    },
                    {
                        "name": "📉 매도 Top 3 (숏)",
                        "value": "\n".join([
                            f"**{s['name']}** ({s['ticker']}): {s.get('ai_score', '-')}점\n↳ {s.get('hot_reason', '')[:80]}"
                            for s in top_shorts
                        ]) or "데이터 없음",
                        "inline": False
                    }
                ],
                "footer": {"text": "StockInsight AI System"}
            }
        ]

        payload = {"embeds": embeds}
        try:
            response = requests.post(self.webhook_url, json=payload)
            response.raise_for_status()
        except Exception:
            pass
