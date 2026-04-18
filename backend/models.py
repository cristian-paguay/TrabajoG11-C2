from pydantic import BaseModel
from typing import Optional


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
