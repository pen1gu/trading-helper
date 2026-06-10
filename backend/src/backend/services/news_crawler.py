"""종목 키워드·경쟁사 기반 Google News RSS 크롤러 (Gemini 미사용)."""

from __future__ import annotations

import re
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Set
from urllib.parse import quote

import feedparser

from ..data.stock_search_context import build_news_queries, extract_hot_keywords
from .news_crawl_service import NewsCrawlContext, NewsCrawlMode

MAX_NEWS_PER_STOCK = 10
_HTML_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(text: str) -> str:
    return _HTML_TAG_RE.sub("", text).strip()


def _parse_published(entry: Any) -> datetime:
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        # feedparser's published_parsed is UTC
        return datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
    return datetime.now(timezone.utc)


def _published_date(item: Dict[str, Any]) -> Optional[date]:
    published_at = item.get("published_at")
    if isinstance(published_at, datetime):
        return published_at.date()
    return None


def _should_include_item(
    item: Dict[str, Any],
    *,
    known_urls: Optional[Set[str]] = None,
    exclude_publish_dates: Optional[Set[date]] = None,
) -> bool:
    url = item.get("url") or ""
    if known_urls and url in known_urls:
        return False
    pub_date = _published_date(item)
    if pub_date and exclude_publish_dates and pub_date in exclude_publish_dates:
        return False
    return True


def _fetch_rss(query: str) -> List[Dict[str, Any]]:
    rss_url = (
        f"https://news.google.com/rss/search?q={quote(query, safe='')}"
        "&hl=ko&gl=KR&ceid=KR:ko"
    )
    items: List[Dict[str, Any]] = []
    try:
        feed = feedparser.parse(rss_url)
        for entry in feed.entries[:5]:
            title = getattr(entry, "title", "") or ""
            url = getattr(entry, "link", "") or ""
            if not title or not url:
                continue
            raw_summary = getattr(entry, "summary", "") or ""
            source = "Google News"
            if hasattr(entry, "source") and entry.source:
                source = entry.source.get("title", "Google News")
            items.append(
                {
                    "title": title,
                    "url": url,
                    "source": source,
                    "published_at": _parse_published(entry),
                    "content": raw_summary,
                    "summary": _strip_html(raw_summary)[:500] if raw_summary else None,
                }
            )
    except Exception:
        pass
    return items


def fetch_stock_news(
    ticker: str,
    name: str,
    *,
    known_urls: Optional[Set[str]] = None,
    exclude_publish_dates: Optional[Set[date]] = None,
) -> List[Dict[str, Any]]:
    """다중 RSS 쿼리로 종목 뉴스 수집. URL·날짜 필터 후 최대 10건."""
    queries = build_news_queries(ticker, name)
    if not queries:
        queries = [name or ticker]

    by_url: Dict[str, Dict[str, Any]] = {}
    for query in queries:
        for item in _fetch_rss(query):
            url = item["url"]
            if url in by_url:
                continue
            if not _should_include_item(
                item,
                known_urls=known_urls,
                exclude_publish_dates=exclude_publish_dates,
            ):
                continue
            item["hot_keywords"] = extract_hot_keywords(item["title"], ticker)
            by_url[url] = item

    sorted_items = sorted(
        by_url.values(),
        key=lambda x: x.get("published_at") or datetime.min,
        reverse=True,
    )
    return sorted_items[:MAX_NEWS_PER_STOCK]


def fetch_stock_news_if_needed(
    ctx: NewsCrawlContext,
    ticker: str,
    name: str,
) -> List[Dict[str, Any]]:
    """SKIP 모드면 RSS 호출 없이 빈 목록 반환."""
    if ctx.mode == NewsCrawlMode.SKIP:
        return []
    return fetch_stock_news(
        ticker,
        name,
        known_urls=ctx.known_urls,
        exclude_publish_dates=ctx.exclude_publish_dates,
    )
