from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from .win_asyncio import apply_windows_asyncio_compat

apply_windows_asyncio_compat()

from .logging_config import configure_logging, request_logging_middleware

configure_logging()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import stocks, news, report, watchlist, recent_views

app = FastAPI(title="StockInsight AI API")
app.middleware("http")(request_logging_middleware())

# CORS Settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with actual frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to StockInsight AI API"}

# Include Routers
app.include_router(stocks.router, prefix="/api/stocks", tags=["stocks"])
app.include_router(news.router, prefix="/api/news", tags=["news"])
app.include_router(report.router, prefix="/api/report", tags=["report"])
app.include_router(watchlist.router, prefix="/api/watchlist", tags=["watchlist"])
app.include_router(recent_views.router, prefix="/api/recent-views", tags=["recent-views"])
