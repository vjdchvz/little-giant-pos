from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class CartItemIn(BaseModel):
    menu_item_id: int
    name: str
    price: float
    emoji: str
    qty: int
    subtotal: float
    notes: Optional[str] = None


class OrderCreate(BaseModel):
    items: List[CartItemIn]
    payment_method: str = "cash"
    discount: float = 0
    cashier_name: Optional[str] = None
    notes: Optional[str] = None


class OrderItemOut(BaseModel):
    id: int
    order_id: int
    menu_item_id: int
    name: str
    price: float
    qty: int
    subtotal: float
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    id: int
    order_number: str
    status: str
    payment_method: str
    subtotal: float
    discount: float
    total: float
    cashier_name: Optional[str] = None
    notes: Optional[str] = None
    items: List[OrderItemOut] = []
    created_at: datetime

    class Config:
        from_attributes = True


class VoidRequest(BaseModel):
    reason: str
