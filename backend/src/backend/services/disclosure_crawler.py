"""DART 공시 수집."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

import requests

from ..data.ticker_utils import is_kr_ticker
from .financial_crawler import DART_API_KEY, FinancialCrawler

DART_LIST_URL = "https://opendart.fss.or.kr/api/list.json"
DART_VIEWER_URL = "https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no}"

EARNINGS_KEYWORDS = ("분기보고서", "반기보고서", "사업보고서", "실적", "영업(잠정)실적", "매출액")
DIVIDEND_KEYWORDS = ("배당", "현금배당", "주주배당")
CAPITAL_KEYWORDS = ("유상증자", "전환사채", "신주인수권", "교환사채", "CB", "BW")
MNA_KEYWORDS = ("합병", "분할", "지분취득", "주식교환", "영업양수")


@dataclass
class DisclosureRecord:
    rcept_no: str
    report_nm: str
    report_type: str
    rcept_dt: date
    dart_url: str
    summary: Optional[str] = None


def classify_report_type(report_nm: str) -> str:
    name = report_nm.replace(" ", "")
    if any(k.replace(" ", "") in name for k in EARNINGS_KEYWORDS):
        return "earnings"
    if any(k.replace(" ", "") in name for k in DIVIDEND_KEYWORDS):
        return "dividend"
    if any(k.replace(" ", "") in name for k in CAPITAL_KEYWORDS):
        return "capital"
    if any(k.replace(" ", "") in name for k in MNA_KEYWORDS):
        return "mna"
    return "other"


def _extract_summary(report_nm: str, report_type: str) -> str:
    type_labels = {
        "earnings": "실적 공시",
        "dividend": "배당 공시",
        "capital": "자본 조달 공시",
        "mna": "M&A/지분 공시",
        "other": "기타 공시",
    }
    return f"{type_labels.get(report_type, '공시')}: {report_nm[:60]}"


class DisclosureCrawler:
    def __init__(self) -> None:
        self._financial = FinancialCrawler()

    def fetch_recent(
        self,
        ticker: str,
        *,
        days: int = 90,
        page_count: int = 100,
    ) -> List[DisclosureRecord]:
        if not is_kr_ticker(ticker):
            return []
        if not DART_API_KEY:
            return []

        corp_code = self._financial._resolve_corp_code(ticker)
        if not corp_code:
            return []

        end_dt = date.today()
        bgn_dt = end_dt - timedelta(days=days)
        records: List[DisclosureRecord] = []
        page_no = 1

        while True:
            self._financial._throttle(0.2)
            try:
                resp = requests.get(
                    DART_LIST_URL,
                    params={
                        "crtfc_key": DART_API_KEY,
                        "corp_code": corp_code,
                        "bgn_de": bgn_dt.strftime("%Y%m%d"),
                        "end_de": end_dt.strftime("%Y%m%d"),
                        "page_no": str(page_no),
                        "page_count": str(page_count),
                    },
                    timeout=30,
                )
                if resp.status_code != 200:
                    break
                payload = resp.json()
                if payload.get("status") != "000":
                    break
                items = payload.get("list") or []
                if not items:
                    break

                for item in items:
                    rcept_no = (item.get("rcept_no") or "").strip()
                    report_nm = (item.get("report_nm") or "").strip()
                    rcept_dt_raw = (item.get("rcept_dt") or "").strip()
                    if not rcept_no or not report_nm or len(rcept_dt_raw) != 8:
                        continue
                    rcept_dt = date(
                        int(rcept_dt_raw[:4]),
                        int(rcept_dt_raw[4:6]),
                        int(rcept_dt_raw[6:8]),
                    )
                    report_type = classify_report_type(report_nm)
                    records.append(
                        DisclosureRecord(
                            rcept_no=rcept_no,
                            report_nm=report_nm,
                            report_type=report_type,
                            rcept_dt=rcept_dt,
                            dart_url=DART_VIEWER_URL.format(rcept_no=rcept_no),
                            summary=_extract_summary(report_nm, report_type),
                        )
                    )

                total_page = int(payload.get("total_page") or 1)
                if page_no >= total_page:
                    break
                page_no += 1
            except Exception:
                break

        return records
