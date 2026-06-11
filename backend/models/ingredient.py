from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.database import Base


class Ingredient(Base):
    __tablename__ = "ingredients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    unit = Column(String(50), nullable=False)
    qty = Column(Numeric(10, 2), default=0)
    max_qty = Column(Numeric(10, 2), default=0)
    low_threshold = Column(Numeric(10, 2), default=0)
    cost_per_unit = Column(Numeric(10, 2), default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    recipes = relationship("Recipe", back_populates="ingredient")
    stock_movements = relationship("StockMovement", back_populates="ingredient")
    waste_logs = relationship("WasteLog", back_populates="ingredient")


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id", ondelete="CASCADE"), nullable=False)
    ingredient_id = Column(Integer, ForeignKey("ingredients.id", ondelete="CASCADE"), nullable=False)
    qty_per_order = Column(Numeric(10, 3), nullable=False)

    menu_item = relationship("MenuItem", back_populates="recipes")
    ingredient = relationship("Ingredient", back_populates="recipes")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    ingredient_id = Column(Integer, ForeignKey("ingredients.id"), nullable=False)
    type = Column(String(30), nullable=False)  # restock, sale_deduction, waste, adjustment
    qty_change = Column(Numeric(10, 2), nullable=False)
    qty_before = Column(Numeric(10, 2), nullable=False)
    qty_after = Column(Numeric(10, 2), nullable=False)
    reference_id = Column(Integer, nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ingredient = relationship("Ingredient", back_populates="stock_movements")


class WasteLog(Base):
    __tablename__ = "waste_logs"

    id = Column(Integer, primary_key=True, index=True)
    ingredient_id = Column(Integer, ForeignKey("ingredients.id"), nullable=False)
    qty = Column(Numeric(10, 2), nullable=False)
    reason = Column(Text, nullable=True)
    logged_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ingredient = relationship("Ingredient", back_populates="waste_logs")
