"""related_stocks_service 단위 테스트."""

from __future__ import annotations

from types import SimpleNamespace

from backend.services.related_stocks_service import (
    MAX_LIMIT,
    resolve_competitor_tickers,
    score_candidate,
)


def _stock(**kwargs):
    defaults = {
        "id": 1,
        "ticker": "005930",
        "name": "삼성전자",
        "market": "KOSPI/KOSDAQ",
        "market_cap": 500_000_000_000_000,
        "per": 15.0,
        "pbr": 1.2,
        "change_rate": 1.5,
        "vs_avg_20d_pct": 2.0,
        "ai_score": 80,
        "current_price": 70000,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


class TestResolveCompetitorTickers:
    def test_samsung_maps_sk_hynix(self):
        candidates = [
            _stock(ticker="000660", name="SK하이닉스", id=2),
            _stock(ticker="066570", name="LG전자", id=3),
        ]
        tickers = resolve_competitor_tickers(
            ["SK하이닉스", "LG전자", "TSMC"],
            candidates,
            exclude_ticker="005930",
        )
        assert "000660" in tickers
        assert "066570" in tickers
        assert "TSMC" not in tickers

    def test_excludes_self_ticker(self):
        candidates = [_stock(ticker="005930", name="삼성전자")]
        tickers = resolve_competitor_tickers(
            ["삼성전자"],
            candidates,
            exclude_ticker="005930",
        )
        assert tickers == set()


class TestScoreCandidate:
    def test_competitor_scores_highest(self):
        source = _stock()
        competitor = _stock(ticker="000660", name="SK하이닉스", id=2)
        peer = _stock(ticker="035420", name="NAVER", id=3, market_cap=50_000_000_000_000)

        stats = {
            "log_market_cap": (30.0, 1.0),
            "per": (15.0, 5.0),
            "pbr": (1.2, 0.5),
            "change_rate": (1.0, 2.0),
            "vs_avg_20d_pct": (1.0, 2.0),
        }

        comp_score, comp_type, comp_reason = score_candidate(
            source,
            competitor,
            competitor_tickers={"000660"},
            source_keywords={"반도체", "HBM"},
            candidate_keywords={"반도체", "DRAM"},
            feature_stats=stats,
        )
        peer_score, peer_type, _ = score_candidate(
            source,
            peer,
            competitor_tickers=set(),
            source_keywords={"반도체", "HBM"},
            candidate_keywords={"검색", "AI"},
            feature_stats=stats,
        )

        assert comp_type == "competitor"
        assert "경쟁사" in comp_reason
        assert comp_score > peer_score
        assert peer_type in ("peer", "theme")

    def test_theme_overlap_sets_relation_type(self):
        source = _stock()
        candidate = _stock(ticker="000660", name="SK하이닉스", id=2)

        stats = {"log_market_cap": (30.0, 1.0)}
        _, relation_type, reason = score_candidate(
            source,
            candidate,
            competitor_tickers=set(),
            source_keywords={"반도체", "HBM", "메모리"},
            candidate_keywords={"반도체", "DRAM"},
            feature_stats=stats,
        )

        assert relation_type == "theme"
        assert "키워드 공통" in reason


class TestMaxLimit:
    def test_max_limit_constant(self):
        assert MAX_LIMIT == 10


if __name__ == "__main__":
    TestResolveCompetitorTickers().test_samsung_maps_sk_hynix()
    TestResolveCompetitorTickers().test_excludes_self_ticker()
    TestScoreCandidate().test_competitor_scores_highest()
    TestScoreCandidate().test_theme_overlap_sets_relation_type()
    TestMaxLimit().test_max_limit_constant()
    print("All tests passed")
