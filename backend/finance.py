import yfinance as yf
import pandas as pd


def enrich_with_yfinance(df: pd.DataFrame) -> pd.DataFrame:
    """
    Enriches the DataFrame with yfinance data.
    Also fills missing price from yfinance so the scraper
    column index never matters for price.
    """
    enriched_rows = []

    for _, row in df.iterrows():
        ticker = row["ticker"]
        extra = {
            "market_cap":  None,
            "sector":      None,
            "pe_ratio":    None,
            "week52_high": None,
            "week52_low":  None,
            "beta":        None,
        }
        try:
            info = yf.Ticker(ticker).info
            extra = {
                "market_cap":  info.get("marketCap"),
                "sector":      info.get("sector", "N/A"),
                "pe_ratio":    info.get("trailingPE"),
                "week52_high": info.get("fiftyTwoWeekHigh"),
                "week52_low":  info.get("fiftyTwoWeekLow"),
                "beta":        info.get("beta"),
            }

            # Fill price from yfinance if scraper returned None
            scraped_price = row.get("price")
            if scraped_price is None or (isinstance(scraped_price, float) and pd.isna(scraped_price)):
                yf_price = (
                    info.get("currentPrice")
                    or info.get("regularMarketPrice")
                    or info.get("previousClose")
                )
                extra["price"] = float(yf_price) if yf_price else None
            else:
                extra["price"] = float(scraped_price)

            print(f"[finance] {ticker}: price={extra['price']}, sector={extra['sector']}")
        except Exception as e:
            print(f"[finance] WARNING: could not enrich {ticker}: {e}")
            extra["price"] = row.get("price")

        # Merge — extra fields override row fields when present
        merged = {**row.to_dict(), **extra}
        enriched_rows.append(merged)

    return pd.DataFrame(enriched_rows)


def get_price_history(tickers: list, period: str = "1mo", interval: str = "1d") -> dict:
    result = {}
    for ticker in tickers:
        try:
            hist = yf.Ticker(ticker).history(period=period, interval=interval)
            if hist.empty:
                print(f"[finance] WARNING: empty history for {ticker}")
                result[ticker] = pd.DataFrame()
                continue
            hist = hist.reset_index()
            hist["Date"] = hist["Date"].astype(str).str[:10]
            result[ticker] = hist[["Date", "Open", "High", "Low", "Close", "Volume"]]
            print(f"[finance] history {ticker}: {len(hist)} rows ({period}/{interval})")
        except Exception as e:
            print(f"[finance] WARNING: history failed for {ticker}: {e}")
            result[ticker] = pd.DataFrame()
    return result


def get_comparison_data(tickers: list, period: str = "1mo") -> list:
    rows = []
    for ticker in tickers:
        try:
            hist = yf.Ticker(ticker).history(period=period)
            if hist.empty or len(hist) < 2:
                continue
            start = hist["Close"].iloc[0]
            end   = hist["Close"].iloc[-1]
            rows.append({
                "ticker":      ticker,
                "start_price": round(float(start), 2),
                "end_price":   round(float(end), 2),
                "pct_change":  round(((end - start) / start) * 100, 2),
                "period":      period,
            })
        except Exception as e:
            print(f"[finance] WARNING: comparison failed for {ticker}: {e}")
    return rows
