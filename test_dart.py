import sys
import os
from pathlib import Path
from dotenv import load_dotenv
import requests

load_dotenv(Path("C:/hjoon/programming/git/trading-helper/.env"))

key = os.getenv("DART_API_KEY")
url = f"https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key={key}&corp_code=00126380&bsns_year=2023&reprt_code=11011&fs_div=CFS"
resp = requests.get(url).json()

with open("C:/hjoon/programming/git/trading-helper/test_dart.txt", "w", encoding="utf-8") as f:
    f.write(str(resp))
