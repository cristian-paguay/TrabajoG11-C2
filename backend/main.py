import io
import json
from functools import lru_cache

import pandas as pd
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from scraper import scrape_top_companies
from finance import enrich_with_yfinance, get_price_history, get_comparison_data
from models import Company, ComparisonItem

app = FastAPI(title="Financial Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory cache — replaced on /refresh
_cache: dict = {"df": None}


def get_df() -> pd.DataFrame:
    if _cache["df"] is None:
        df = scrape_top_companies(limit=10)
        df = enrich_with_yfinance(df)
        _cache["df"] = df
    return _cache["df"]


# ── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/companies", response_model=list[Company])
def list_companies():
    """Returns the top 10 scraped and enriched companies."""
    df = get_df()
    return json.loads(df.to_json(orient="records"))


@app.get("/prices/{ticker}")
def price_history(
    ticker: str,
    period: str = Query(default="1mo", enum=["5d","1mo","3mo","6mo","1y"]),
    interval: str = Query(default="1d", enum=["1d","1wk"]),
):
    """OHLCV history for a single ticker."""
    history = get_price_history([ticker], period=period, interval=interval)
    if ticker not in history or history[ticker].empty:
        raise HTTPException(status_code=404, detail=f"No data for {ticker}")
    return history[ticker].to_dict(orient="records")


@app.get("/compare", response_model=list[ComparisonItem])
def compare_companies(
    period: str = Query(default="1mo", enum=["5d","1mo","3mo","6mo","1y"]),
):
    """% price change comparison across all 10 companies."""
    df = get_df()
    tickers = df["ticker"].tolist()
    return get_comparison_data(tickers, period=period)


@app.get("/export-csv")
def export_csv():
    """
    Download the enriched company DataFrame as a CSV file.
    Also used by the frontend download button.
    """
    df = get_df()
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    stream.seek(0)
    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=companies.csv"},
    )


@app.post("/refresh")
def refresh_data():
    """Force re-scrape and re-enrich. Clears the in-memory cache."""
    _cache["df"] = None
    get_df()  # eager reload
    return {"status": "refreshed", "count": len(_cache["df"])}


@app.get("/health")
def health():
    return {"status": "ok"}
