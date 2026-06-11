from pydantic import BaseModel
from typing import List, Optional


class TopItem(BaseModel):
    menu_item_id: int
    name: str
    emoji: str
    qty_sold: int
    revenue: float


class PaymentBreakdown(BaseModel):
    cash: float
    gcash: float
    maya: float


class DailySummary(BaseModel):
    date: str
    gross_sales: float
    total_orders: int
    avg_order_value: float
    top_items: List[TopItem]
    payment_breakdown: PaymentBreakdown
    low_stock_count: int


class HourlySales(BaseModel):
    hour: int
    total: float
    orders: int
