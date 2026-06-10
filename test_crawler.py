import sys
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path("C:/hjoon/programming/git/trading-helper/.env"))

# Add backend/src to path
sys.path.append(str(Path("C:/hjoon/programming/git/trading-helper/backend/src")))

from backend.services.financial_crawler import FinancialCrawler

c = FinancialCrawler()
res = c.fetch_annual_financials("005930")
with open("C:/hjoon/programming/git/trading-helper/test_out.txt", "w", encoding="utf-8") as f:
    for a in res.annual:
        f.write(str(a) + "\n")
