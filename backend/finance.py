import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta


def enrich_with_yfinance(df: pd.DataFrame) -> pd.DataFrame:
    """
    Takes a DataFrame with a 'ticker' column and adds
    market cap, sector, P/E ratio, and 52-week range.
    """
    enriched_rows = []

    for _, row in df.iterrows():
        ticker = row["ticker"]
        try:
            info = yf.Ticker(ticker).info
            enriched_rows.append({
                **row.to_dict(),
                "market_cap":   info.get("marketCap"),
                "sector":       info.get("sector", "N/A"),
                "pe_ratio":     info.get("trailingPE"),
                "week52_high":  info.get("fiftyTwoWeekHigh"),
                "week52_low":   info.get("fiftyTwoWeekLow"),
                "beta":         info.get("beta"),
            })
        except Exception:
            enriched_rows.append(row.to_dict())

    return pd.DataFrame(enriched_rows)


def get_price_history(
    tickers: list[str],
    period: str = "1mo",   # 1d 5d 1mo 3mo 6mo 1y 2y 5y
    interval: str = "1d",
) -> dict[str, pd.DataFrame]:
    """
    Returns a dict of {ticker: DataFrame} with OHLCV history.
    """
    result = {}
    for ticker in tickers:
        try:
            hist = yf.Ticker(ticker).history(period=period, interval=interval)
            hist = hist.reset_index()
            hist["Date"] = hist["Date"].astype(str)
            result[ticker] = hist[["Date", "Open", "High", "Low", "Close", "Volume"]]
        except Exception:
            result[ticker] = pd.DataFrame()
    return result


def get_comparison_data(
    tickers: list[str], period: str = "1mo"
) -> list[dict]:
    """
    Returns % price change over the period for each ticker,
    normalised to 100 at start — useful for direct comparison.
    """
    rows = []
    for ticker in tickers:
        try:
            hist = yf.Ticker(ticker).history(period=period)
            if hist.empty:
                continue
            start_price = hist["Close"].iloc[0]
            end_price   = hist["Close"].iloc[-1]
            pct_change  = ((end_price - start_price) / start_price) * 100
            rows.append({
                "ticker":      ticker,
                "start_price": round(start_price, 2),
                "end_price":   round(end_price, 2),
                "pct_change":  round(pct_change, 2),
                "period":      period,
            })
        except Exception:
            continue
    return rows
