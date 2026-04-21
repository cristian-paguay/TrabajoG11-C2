import requests
from bs4 import BeautifulSoup
import pandas as pd
import re

SCRAPE_URL = "https://finance.yahoo.com/most-active/"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def _clean_number(val: str) -> float | None:
    """Strip $, commas, +, % and any whitespace then parse as float."""
    if not val:
        return None
    cleaned = re.sub(r'[$,+%\s]', '', str(val))
    try:
        return float(cleaned)
    except ValueError:
        return None


def scrape_top_companies(limit: int = 10) -> pd.DataFrame:
    response = requests.get(SCRAPE_URL, headers=HEADERS, timeout=15)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    rows = soup.select("table tbody tr")
    if not rows:
        return _scrape_fallback(soup, limit)

    records = []
    for row in rows[:limit * 2]:
        cols = row.find_all("td")
        if len(cols) < 6:
            continue
        price_raw      = cols[2].get_text(strip=True)
        change_pct_raw = cols[4].get_text(strip=True)
        records.append({
            "ticker":        cols[0].get_text(strip=True),
            "name":          cols[1].get_text(strip=True),
            "price":         _clean_number(price_raw),
            "change":        cols[3].get_text(strip=True),
            "change_pct":    change_pct_raw,
            "change_pct_num": _clean_number(change_pct_raw),
            "volume":        cols[5].get_text(strip=True),
        })

    df = pd.DataFrame(records)
    if df.empty:
        raise ValueError("Scraper returned 0 rows — Yahoo Finance may have changed its HTML structure.")

    df["indicator_score"] = df["change_pct_num"].abs()
    df = df.sort_values("indicator_score", ascending=False).head(limit)
    df = df.reset_index(drop=True)

    print(f"[scraper] {len(df)} empresas: {df['ticker'].tolist()}")
    print(f"[scraper] precios: {df['price'].tolist()}")
    return df


def _scrape_fallback(soup: BeautifulSoup, limit: int) -> pd.DataFrame:
    tickers = [el.get_text(strip=True) for el in soup.select("[data-field='symbol']")]
    names   = [el.get_text(strip=True) for el in soup.select("[data-field='longName']")]
    prices  = [el.get_text(strip=True) for el in soup.select("[data-field='regularMarketPrice']")]
    changes = [el.get_text(strip=True) for el in soup.select("[data-field='regularMarketChangePercent']")]

    count = min(len(tickers), len(prices), len(changes), limit)
    if count == 0:
        raise ValueError("Fallback scraper also returned 0 rows.")

    records = []
    for i in range(count):
        chg = changes[i] if i < len(changes) else ''
        records.append({
            "ticker":         tickers[i],
            "name":           names[i] if i < len(names) else '',
            "price":          _clean_number(prices[i]),
            "change":         '',
            "change_pct":     chg,
            "change_pct_num": _clean_number(chg),
            "volume":         '',
        })

    df = pd.DataFrame(records)
    df["indicator_score"] = df["change_pct_num"].abs()
    df = df.sort_values("indicator_score", ascending=False).head(limit)
    df = df.reset_index(drop=True)

    print(f"[scraper:fallback] {len(df)} empresas: {df['ticker'].tolist()}")
    return df
