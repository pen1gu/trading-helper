"""SEC EDGAR / DART / yfinance 기반 연간 재무제표 수집."""

from __future__ import annotations

import io
import os
import time
import zipfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv

from ..data.ticker_utils import is_kr_ticker
from .request_pacing import pace
from .yfinance_client import fetch_financial_statements

load_dotenv(Path(__file__).resolve().parents[3] / ".env")

SEC_USER_AGENT = os.getenv(
    "SEC_USER_AGENT",
    "TradingHelper/1.0 (contact@example.com)",
)
DART_API_KEY = os.getenv("DART_API_KEY", "")
CACHE_DIR = Path(__file__).resolve().parents[3] / ".cache"
CACHE_DIR.mkdir(exist_ok=True)

SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SEC_FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
DART_CORP_CODE_URL = "https://opendart.fss.or.kr/api/corpCode.xml"
DART_FINANCIALS_URL = "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json"

SEC_CONCEPTS: Dict[str, List[str]] = {
    "revenue": [
        "Revenues",
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "SalesRevenueNet",
        "RevenueFromContractWithCustomerIncludingAssessedTax",
    ],
    "gross_profit": ["GrossProfit"],
    "operating_income": ["OperatingIncomeLoss"],
    "rd_expense": ["ResearchAndDevelopmentExpense"],
    "capex": ["PaymentsToAcquirePropertyPlantAndEquipment"],
    "depreciation": ["DepreciationDepletionAndAmortization"],
    "dividends": ["PaymentsOfDividends", "Dividends"],
    "buybacks": [
        "PaymentsForRepurchaseOfCommonStock",
        "PaymentsForRepurchaseOfEquity",
    ],
    "contract_liabilities": [
        "ContractWithCustomerLiability",
        "ContractWithCustomerLiabilityCurrent",
        "DeferredRevenue",
    ],
    "goodwill": ["Goodwill"],
    "current_assets": ["AssetsCurrent"],
    "total_liabilities": ["Liabilities"],
    "cash_and_equivalents": ["CashAndCashEquivalentsAtCarryingValue", "Cash"],
    "inventory": ["InventoryNet"],
    "current_liabilities": ["LiabilitiesCurrent"],
    "operating_cash_flow": [
        "NetCashProvidedByUsedInOperatingActivities",
    ],
    "debt_repayment": [
        "RepaymentsOfLongTermDebt",
        "RepaymentsOfDebt",
    ],
}

YF_FIELD_MAP: Dict[str, List[str]] = {
    "revenue": ["Total Revenue", "Operating Revenue"],
    "gross_profit": ["Gross Profit"],
    "operating_income": ["Operating Income", "EBIT"],
    "rd_expense": ["Research And Development"],
    "capex": ["Capital Expenditure"],
    "depreciation": ["Depreciation And Amortization", "Reconciled Depreciation"],
    "dividends": ["Cash Dividends Paid", "Common Stock Dividends Paid"],
    "buybacks": ["Repurchase Of Capital Stock", "Common Stock Payments"],
    "current_assets": ["Total Current Assets", "Current Assets", "Assets Current"],
    "total_liabilities": ["Total Liabilities Net Minority Interest", "Total Liabilities"],
    "cash_and_equivalents": ["Cash And Cash Equivalents", "Cash Financial"],
    "inventory": ["Inventory"],
    "current_liabilities": ["Current Liabilities", "Total Current Liabilities"],
    "operating_cash_flow": ["Operating Cash Flow"],
    "debt_repayment": ["Repayment Of Debt", "Long Term Debt Payments"],
}

DART_EXACT_MATCH_FIELDS = frozenset(
    {
        "current_assets",
        "total_liabilities",
        "current_liabilities",
        "cash_and_equivalents",
        "inventory",
        "revenue",
        "gross_profit",
        "operating_income",
    }
)

DART_ACCOUNT_MAP: Dict[str, List[str]] = {
    "revenue": ["매출액", "수익(매출액)", "영업수익", "매출"],
    "gross_profit": ["매출총이익"],
    "operating_income": ["영업이익", "영업이익(손실)"],
    "rd_expense": ["연구개발비", "경상연구개발비"],
    "capex": [
        "유형자산의취득",
        "유형자산의 취득",
        "무형자산의취득",
        "무형자산의 취득",
    ],
    "depreciation": ["감가상각비", "감가상각비 및 무형자산상각비"],
    "dividends": ["배당금의지급", "배당금의 지급", "배당금지급"],
    "buybacks": ["자기주식의취득", "자기주식의 취득", "자기주식취득"],
    "contract_liabilities": ["계약부채", "선수금"],
    "goodwill": ["영업권"],
    "current_assets": ["유동자산"],
    "total_liabilities": ["부채총계"],
    "cash_and_equivalents": ["현금및현금성자산", "현금 및 현금성자산"],
    "inventory": ["재고자산"],
    "current_liabilities": ["유동부채"],
    "operating_cash_flow": ["영업활동현금흐름", "영업활동으로인한현금흐름"],
    "debt_repayment": ["차입금의상환", "차입금의 상환", "사채의상환"],
}


@dataclass
class AnnualFinancial:
    fiscal_year: int
    revenue: Optional[float] = None
    gross_profit: Optional[float] = None
    operating_income: Optional[float] = None
    rd_expense: Optional[float] = None
    capex: Optional[float] = None
    depreciation: Optional[float] = None
    dividends: Optional[float] = None
    buybacks: Optional[float] = None
    contract_liabilities: Optional[float] = None
    goodwill: Optional[float] = None
    current_assets: Optional[float] = None
    total_liabilities: Optional[float] = None
    cash_and_equivalents: Optional[float] = None
    inventory: Optional[float] = None
    current_liabilities: Optional[float] = None
    operating_cash_flow: Optional[float] = None
    debt_repayment: Optional[float] = None


@dataclass
class FinancialSeries:
    ticker: str
    source: str
    annual: List[AnnualFinancial] = field(default_factory=list)
    collected_at: Optional[datetime] = None


class FinancialCrawler:
    def __init__(self) -> None:
        self._cik_map: Optional[Dict[str, str]] = None
        self._corp_map: Optional[Dict[str, str]] = None

    @staticmethod
    def _dart_account_matches(
        account_nm: str, field_name: str, names: List[str]
    ) -> bool:
        normalized = account_nm.replace(" ", "")
        normalized_names = [name.replace(" ", "") for name in names]
        if field_name in DART_EXACT_MATCH_FIELDS:
            return normalized in normalized_names
        return any(name in normalized for name in normalized_names)

    @staticmethod
    def _safe_float(value: Any) -> Optional[float]:
        try:
            if value is None:
                return None
            if hasattr(value, "item"):
                value = value.item()
            val = float(value)
            if val != val:
                return None
            return val
        except (TypeError, ValueError):
            return None

    def fetch_annual_financials(self, ticker: str) -> FinancialSeries:
        if is_kr_ticker(ticker):
            series = self._fetch_kr(ticker)
            if series.annual:
                return series
            return self._fetch_yfinance(ticker, suffix=".KS")

        series = self._fetch_us_sec(ticker)
        if series.annual:
            return series
        return self._fetch_yfinance(ticker)

    def _fetch_us_sec(self, ticker: str) -> FinancialSeries:
        cik = self._resolve_cik(ticker)
        if not cik:
            return FinancialSeries(ticker=ticker, source="sec_edgar")

        pace("dart")
        try:
            resp = requests.get(
                SEC_FACTS_URL.format(cik=cik),
                headers={"User-Agent": SEC_USER_AGENT, "Accept": "application/json"},
                timeout=30,
            )
            if resp.status_code != 200:
                return FinancialSeries(ticker=ticker, source="sec_edgar")
            data = resp.json()
        except Exception:
            return FinancialSeries(ticker=ticker, source="sec_edgar")

        year_data: Dict[int, Dict[str, float]] = {}
        facts = data.get("facts", {})
        us_gaap = facts.get("us-gaap", {})
        ifrs = facts.get("ifrs-full", {})

        for field_name, concepts in SEC_CONCEPTS.items():
            for concept in concepts:
                concept_data = us_gaap.get(concept) or ifrs.get(concept)
                if not concept_data:
                    continue
                for unit_values in concept_data.get("units", {}).values():
                    for entry in unit_values:
                        if entry.get("fp") not in ("FY", "CY"):
                            continue
                        form = entry.get("form", "")
                        if form and form not in ("10-K", "20-F", "40-F"):
                            continue
                        fy = entry.get("fy")
                        if not fy:
                            continue
                        val = self._safe_float(entry.get("val"))
                        if val is None:
                            continue
                        if field_name in ("dividends", "buybacks", "capex", "debt_repayment"):
                            val = abs(val)
                        bucket = year_data.setdefault(int(fy), {})
                        if field_name not in bucket:
                            bucket[field_name] = val

        annual = self._build_annual_list(year_data)
        return FinancialSeries(
            ticker=ticker,
            source="sec_edgar",
            annual=annual,
            collected_at=datetime.now(timezone.utc),
        )

    def _fetch_kr(self, ticker: str) -> FinancialSeries:
        if not DART_API_KEY:
            return FinancialSeries(ticker=ticker, source="dart")

        corp_code = self._resolve_corp_code(ticker)
        if not corp_code:
            return FinancialSeries(ticker=ticker, source="dart")

        current_year = datetime.now().year
        year_data: Dict[int, Dict[str, float]] = {}

        for year in range(current_year - 1, current_year - 6, -1):
            pace("dart")
            try:
                resp = requests.get(
                    DART_FINANCIALS_URL,
                    params={
                        "crtfc_key": DART_API_KEY,
                        "corp_code": corp_code,
                        "bsns_year": str(year),
                        "reprt_code": "11011",
                        "fs_div": "CFS",
                    },
                    timeout=30,
                )
                if resp.status_code != 200:
                    continue
                payload = resp.json()
                if payload.get("status") != "000":
                    continue
                for item in payload.get("list", []):
                    account_nm = (item.get("account_nm") or "").replace(" ", "")
                    val = self._safe_float(item.get("thstrm_amount"))
                    if val is None:
                        continue
                    for field_name, names in DART_ACCOUNT_MAP.items():
                        if self._dart_account_matches(account_nm, field_name, names):
                            if field_name in ("dividends", "buybacks", "capex", "debt_repayment"):
                                val = abs(val)
                            if field_name == "capex" and field_name in year_data.get(year, {}):
                                year_data.setdefault(year, {})[field_name] = (
                                    year_data[year].get(field_name, 0) + val
                                )
                            else:
                                year_data.setdefault(year, {})[field_name] = val
                            break
            except Exception:
                continue

        annual = self._build_annual_list(year_data)
        return FinancialSeries(
            ticker=ticker,
            source="dart",
            annual=annual,
            collected_at=datetime.now(timezone.utc),
        )

    def _fetch_yfinance(self, ticker: str, suffix: str = "") -> FinancialSeries:
        symbol = f"{ticker}{suffix}" if suffix else ticker
        financials, cashflow, balance = fetch_financial_statements(symbol)
        if financials is None and cashflow is None and balance is None:
            return FinancialSeries(ticker=ticker, source="yfinance")

        year_data: Dict[int, Dict[str, float]] = {}

        def extract_from_df(df, field_name: str) -> None:
            if df is None or df.empty:
                return
            for row_name in YF_FIELD_MAP.get(field_name, []):
                if row_name not in df.index:
                    continue
                for col in df.columns:
                    year = col.year if hasattr(col, "year") else None
                    if not year:
                        continue
                    val = self._safe_float(df.loc[row_name, col])
                    if val is None:
                        continue
                    if field_name in ("dividends", "buybacks", "capex", "debt_repayment"):
                        val = abs(val)
                    year_data.setdefault(year, {})[field_name] = val
                break

        balance_fields = {
            "current_assets",
            "total_liabilities",
            "cash_and_equivalents",
            "inventory",
            "current_liabilities",
        }
        for field_name in YF_FIELD_MAP:
            extract_from_df(financials, field_name)
            extract_from_df(cashflow, field_name)
            if field_name in balance_fields:
                extract_from_df(balance, field_name)

        if balance is not None and not balance.empty:
            for col in balance.columns:
                year = col.year if hasattr(col, "year") else None
                if not year:
                    continue
                for row_name in ["Goodwill"]:
                    if row_name in balance.index:
                        val = self._safe_float(balance.loc[row_name, col])
                        if val is not None:
                            year_data.setdefault(year, {})["goodwill"] = val

        annual = self._build_annual_list(year_data)
        return FinancialSeries(
            ticker=ticker,
            source="yfinance",
            annual=annual,
            collected_at=datetime.now(timezone.utc),
        )

    def _build_annual_list(self, year_data: Dict[int, Dict[str, float]]) -> List[AnnualFinancial]:
        years = sorted(year_data.keys(), reverse=True)
        if not years:
            return []
            
        # Find the latest year that actually has meaningful fundamental data
        latest_year = None
        for y in years:
            d = year_data[y]
            if d.get("revenue") or d.get("current_assets") or d.get("total_liabilities") or d.get("operating_cash_flow"):
                latest_year = y
                break
                
        if latest_year is None:
            latest_year = years[0]

        target_years = list(range(latest_year - 4, latest_year + 1))
        
        result: List[AnnualFinancial] = []
        for year in target_years:
            d = year_data.get(year, {})
            result.append(
                AnnualFinancial(
                    fiscal_year=year,
                    revenue=d.get("revenue"),
                    gross_profit=d.get("gross_profit"),
                    operating_income=d.get("operating_income"),
                    rd_expense=d.get("rd_expense"),
                    capex=d.get("capex"),
                    depreciation=d.get("depreciation"),
                    dividends=d.get("dividends"),
                    buybacks=d.get("buybacks"),
                    contract_liabilities=d.get("contract_liabilities"),
                    goodwill=d.get("goodwill"),
                    current_assets=d.get("current_assets"),
                    total_liabilities=d.get("total_liabilities"),
                    cash_and_equivalents=d.get("cash_and_equivalents"),
                    inventory=d.get("inventory"),
                    current_liabilities=d.get("current_liabilities"),
                    operating_cash_flow=d.get("operating_cash_flow"),
                    debt_repayment=d.get("debt_repayment"),
                )
            )
        return sorted(result, key=lambda x: x.fiscal_year)

    def _resolve_cik(self, ticker: str) -> Optional[str]:
        if self._cik_map is None:
            self._cik_map = self._load_cik_map()
        return self._cik_map.get(ticker.upper())

    def _load_cik_map(self) -> Dict[str, str]:
        cache_file = CACHE_DIR / "sec_company_tickers.json"
        if cache_file.exists():
            age = time.time() - cache_file.stat().st_mtime
            if age < 86400:
                import json
                data = json.loads(cache_file.read_text(encoding="utf-8"))
                return self._parse_cik_json(data)

        pace("dart")
        try:
            resp = requests.get(
                SEC_TICKERS_URL,
                headers={"User-Agent": SEC_USER_AGENT},
                timeout=30,
            )
            resp.raise_for_status()
            cache_file.write_text(resp.text, encoding="utf-8")
            return self._parse_cik_json(resp.json())
        except Exception:
            return {}

    @staticmethod
    def _parse_cik_json(data: Any) -> Dict[str, str]:
        result: Dict[str, str] = {}
        items = data.values() if isinstance(data, dict) else data
        for item in items:
            if not isinstance(item, dict):
                continue
            t = str(item.get("ticker", "")).upper()
            cik = str(item.get("cik_str", "")).zfill(10)
            if t and cik:
                result[t] = cik
        return result

    def _resolve_corp_code(self, ticker: str) -> Optional[str]:
        if self._corp_map is None:
            self._corp_map = self._load_corp_map()
        normalized = ticker.zfill(6)
        return self._corp_map.get(normalized)

    def _load_corp_map(self) -> Dict[str, str]:
        if not DART_API_KEY:
            return {}

        cache_file = CACHE_DIR / "dart_corp_codes.xml"
        xml_bytes: Optional[bytes] = None

        if cache_file.exists():
            age = time.time() - cache_file.stat().st_mtime
            if age < 86400:
                xml_bytes = cache_file.read_bytes()

        if xml_bytes is None:
            pace("dart")
            try:
                resp = requests.get(
                    DART_CORP_CODE_URL,
                    params={"crtfc_key": DART_API_KEY},
                    timeout=60,
                )
                resp.raise_for_status()
                with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
                    xml_name = [n for n in zf.namelist() if n.endswith(".xml")][0]
                    xml_bytes = zf.read(xml_name)
                cache_file.write_bytes(xml_bytes)
            except Exception:
                return {}

        result: Dict[str, str] = {}
        try:
            root = ET.fromstring(xml_bytes)
            for item in root.findall("list"):
                stock_code = (item.findtext("stock_code") or "").strip()
                corp_code = (item.findtext("corp_code") or "").strip()
                if stock_code and corp_code:
                    result[stock_code] = corp_code
        except Exception:
            return {}
        return result
