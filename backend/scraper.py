import requests
from bs4 import BeautifulSoup
import pandas as pd

# Target: finance.yahoo.com most active stocks (public, no auth)
SCRAPE_URL = "https://finance.yahoo.com/most-active/"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

def scrape_top_companies(limit: int = 10) -> pd.DataFrame:
    """
    Scrapes Yahoo Finance 'Most Active' page and returns a DataFrame
    with the top `limit` companies and their basic indicators.
    """
    response = requests.get(SCRAPE_URL, headers=HEADERS, timeout=10)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # Yahoo Finance renders a table — find all rows
    rows = soup.select("table tbody tr")

    records = []
    for row in rows[:limit]:
        cols = row.find_all("td")
        if len(cols) < 6:
            continue
        records.append({
            "ticker":        cols[0].get_text(strip=True),
            "name":          cols[1].get_text(strip=True),
            "price":         cols[2].get_text(strip=True),
            "change":        cols[3].get_text(strip=True),
            "change_pct":    cols[4].get_text(strip=True),
            "volume":        cols[5].get_text(strip=True),
        })

    df = pd.DataFrame(records)

    # Clean numeric columns
    df["price"] = pd.to_numeric(
        df["price"].str.replace(",", ""), errors="coerce"
    )
    df["change_pct_num"] = pd.to_numeric(
        df["change_pct"].str.replace("%", "").str.replace("+", ""),
        errors="coerce"
    )

    # Selection indicator: rank by absolute % change (most volatile = most interesting)
    df["indicator_score"] = df["change_pct_num"].abs()
    df = df.sort_values("indicator_score", ascending=False).head(limit)
    df = df.reset_index(drop=True)

    return df
