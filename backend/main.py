import io
import json

import pandas as pd
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from scraper import scrape_top_companies
from finance import enrich_with_yfinance, get_price_history, get_comparison_data
from models import Company, ComparisonItem
# ... tus imports actuales
from sqlalchemy.orm import Session
from models import SessionLocal, CompanyDB, Company, ComparisonItem

# Dependencia para la DB
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_df() -> pd.DataFrame:
    db = SessionLocal()
    # 1. Intentamos leer de la DB
    companies_db = db.query(CompanyDB).all()
    
    if not companies_db: # Si la DB está vacía
        print("[main] DB vacía — ejecutando scraper...")
        df = scrape_top_companies(limit=10)
        df = enrich_with_yfinance(df)
        
        # 2. Guardar en SQLite
        for _, row in df.iterrows():
            new_company = CompanyDB(
                ticker=row['ticker'],
                name=row.get('name'),
                price=row.get('price'),
                change_percent=row.get('change_percent'),
                sector=row.get('sector'),
                market_cap=row.get('market_cap')
            )
            db.merge(new_company) # merge evita errores si el ticker ya existe
        db.commit()
        db.close()
        return df
    
    db.close()
    # 3. Si había datos, convertimos de SQL a DataFrame de Pandas
    return pd.read_sql_table("companies", engine)

# --- Actualiza tus endpoints ---
app = FastAPI(title="Financial Dashboard API", version="1.0.0")

# ── Entry point — siempre inicia en 0.0.0.0 ───────────────────────────────
# Usar: python main.py  O  uvicorn main:app --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory cache ────────────────────────────────────────────────────────
_cache: dict = {"df": None}


def get_df() -> pd.DataFrame:
    if _cache["df"] is None:
        print("[main] cache vacío — ejecutando scraper + enriquecimiento...")
        df = scrape_top_companies(limit=10)
        df = enrich_with_yfinance(df)
        _cache["df"] = df
        print(f"[main] cache listo con {len(df)} empresas")
    return _cache["df"]


# ── Endpoints ──────────────────────────────────────────────────────────────


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/companies", response_model=list[Company])
def list_companies():
    df = get_df()
    # Convertimos NaN a None para que JSON no falle
    df_clean = df.where(pd.notna(df), other=None)
    return df_clean.to_dict(orient="records")


@app.get("/prices/{ticker}")
def price_history(
    ticker: str,
    period: str   = Query(default="1mo", enum=["5d", "1mo", "3mo", "6mo", "1y"]),
    interval: str = Query(default="1d",  enum=["1d", "1wk"]),
):
    """Historial OHLCV para cualquier ticker — no requiere /companies primero."""
    t = ticker.upper()
    history = get_price_history([t], period=period, interval=interval)
    data    = history.get(t)
    if data is None or data.empty:
        raise HTTPException(status_code=404, detail=f"No se encontraron datos para '{ticker}'. Verifica el símbolo.")
    return data.to_dict(orient="records")


@app.get("/compare", response_model=list[ComparisonItem])
def compare_companies(
    period: str = Query(default="1mo", enum=["5d", "1mo", "3mo", "6mo", "1y"]),
):
    """Comparación de cambio % de precio entre todas las empresas cacheadas."""
    df      = get_df()
    tickers = df["ticker"].tolist()
    return get_comparison_data(tickers, period=period)


@app.get("/export-csv")
def export_csv():
    """Descarga el DataFrame enriquecido como archivo CSV."""
    df     = get_df()
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
    db = SessionLocal()
    db.query(CompanyDB).delete() # Borramos lo viejo
    db.commit()
    db.close()
    
    df = get_df() # Esto disparará el scraper de nuevo y guardará en DB
    return {"status": "actualizado", "count": len(df)}