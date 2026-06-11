from pydantic import BaseModel
from typing import Optional


class IngredientOut(BaseModel):
    id: int
    name: str
    unit: str
    qty: float
    max_qty: float
    low_threshold: float
    cost_per_unit: float
    stock_pct: float
    is_low: bool

    class Config:
        from_attributes = True


class RestockRequest(BaseModel):
    qty: float
    note: Optional[str] = None


class WasteRequest(BaseModel):
    qty: float
    reason: str


class AdjustRequest(BaseModel):
    qty: float
    note: str
