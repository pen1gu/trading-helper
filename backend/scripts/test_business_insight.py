import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from backend.services.business_analyzer import fetch_and_analyze
from backend.services.financial_crawler import FinancialCrawler


def main() -> None:
    crawler = FinancialCrawler()
    for ticker in ["AAPL", "005930", "JPM"]:
        series = crawler.fetch_annual_financials(ticker)
        print(f"\n=== {ticker} ({series.source}) ===")
        print(f"years: {[a.fiscal_year for a in series.annual]}")
        if series.annual:
            latest = series.annual[-1]
            print(
                f"latest {latest.fiscal_year}: rev={latest.revenue} "
                f"rd={latest.rd_expense} capex={latest.capex}"
            )

        result = fetch_and_analyze(ticker)
        print(f"status={result.get('status')}")
        if result.get("moat_proxy"):
            print(f"  moat score={result['moat_proxy'].get('score')}")
        if result.get("rd_efficiency"):
            rd = result["rd_efficiency"]
            print(f"  rd score={rd.get('score')} intensity={rd.get('rd_intensity_pct')}")
        if result.get("capital_allocation"):
            cap = result["capital_allocation"]
            print(f"  capital score={cap.get('score')} profile={cap.get('profile')}")


if __name__ == "__main__":
    main()
