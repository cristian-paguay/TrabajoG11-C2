from pydantic import BaseModel
from typing import Optional
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pydantic import BaseModel

# --- SQLALCHEMY (Base de datos) ---
DATABASE_URL = "sqlite:///./financial_data.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class CompanyDB(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, unique=True, index=True)
    name = Column(String)
    price = Column(Float)
    change_percent = Column(Float)
    market_cap = Column(String)
    sector = Column(String)
    # Añade aquí más columnas según lo que retorne tu scraper/enrich

# Crear las tablas
Base.metadata.create_all(bind=engine)

# --- PYDANTIC (Para la API - los que ya tenías) ---
class Company(BaseModel):
    ticker: str
    name: str | None
    price: float | None
    change_percent: float | None
    # ... tus otros campos
    class Config:
        from_attributes = True

class ComparisonItem(BaseModel):
    ticker: str
    change_percent: float

class Company(BaseModel):
    ticker:          str
    name:            str
    price:           Optional[float]
    change_pct:      str
    change_pct_num:  Optional[float]
    volume:          str
    indicator_score: Optional[float]
    market_cap:      Optional[float]
    sector:          Optional[str]
    pe_ratio:        Optional[float]
    week52_high:     Optional[float]
    week52_low:      Optional[float]
    beta:            Optional[float]


class ComparisonItem(BaseModel):
    ticker:      str
    start_price: float
    end_price:   float
    pct_change:  float
    period:      str
