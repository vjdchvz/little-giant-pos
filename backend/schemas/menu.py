from pydantic import BaseModel
from typing import Optional


class CategoryOut(BaseModel):
    id: int
    name: str
    sort_order: int

    class Config:
        from_attributes = True


class MenuItemOut(BaseModel):
    id: int
    name: str
    category_id: Optional[int]
    category_name: Optional[str] = None
    price: float
    emoji: str
    description: Optional[str] = None
    is_available: bool
    servings_left: Optional[int] = None

    class Config:
        from_attributes = True


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    emoji: Optional[str] = None
    description: Optional[str] = None
    is_available: Optional[bool] = None
