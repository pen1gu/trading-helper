"""news_sentiment 단위 테스트."""

from __future__ import annotations

from backend.services.news_sentiment import NEUTRAL_SCORE, score_news_sentiment


class TestScoreNewsSentiment:
    def test_neutral_title_without_keywords(self):
        assert score_news_sentiment("삼성전자, 4분기 실적 발표 예정") == NEUTRAL_SCORE

    def test_positive_korean_title(self):
        score = score_news_sentiment("삼성전자, 실적 호조에 급등")
        assert score > NEUTRAL_SCORE
        assert score <= 100

    def test_negative_korean_title(self):
        score = score_news_sentiment("실적 부진·적자 전환 우려에 급락")
        assert score < NEUTRAL_SCORE
        assert score >= 0

    def test_positive_english_title(self):
        score = score_news_sentiment("NVIDIA shares surge on strong earnings beat")
        assert score > NEUTRAL_SCORE

    def test_negative_english_title(self):
        score = score_news_sentiment("Tesla plunges after profit miss and downgrade")
        assert score < NEUTRAL_SCORE

    def test_body_adds_weight(self):
        title_only = score_news_sentiment("Apple quarterly update")
        with_body = score_news_sentiment(
            "Apple quarterly update",
            "Revenue growth beat expectations and partnership deal announced.",
        )
        assert with_body > title_only

    def test_score_clamped_to_range(self):
        score = score_news_sentiment(
            "급등 호실적 신고가 수주 승인 성장 확대 개선 호조 강세 반등 회복",
            "surge rally beat upgrade record high profit growth strong outperform",
        )
        assert 0 <= score <= 100
