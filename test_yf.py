import yfinance as yf
tk = yf.Ticker('005930.KS')
bs = tk.balance_sheet
with open("C:/hjoon/programming/git/trading-helper/test_yf.txt", "w", encoding="utf-8") as f:
    f.write(str(bs.index.tolist()))
