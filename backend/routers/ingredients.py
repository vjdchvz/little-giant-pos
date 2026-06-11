from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from db.database import get_db
from models.ingredient import Ingredient, StockMovement, WasteLog
from schemas.ingredient import IngredientOut, RestockRequest, WasteRequest, AdjustRequest

router = APIRouter()


def to_out(ing: Ingredient) -> IngredientOut:
    qty = float(ing.qty)
    max_qty = float(ing.max_qty)
    low_threshold = float(ing.low_threshold)
    stock_pct = (qty / max_qty * 100) if max_qty > 0 else 0
    return IngredientOut(
        id=ing.id,
        name=ing.name,
        unit=ing.unit,
        qty=qty,
        max_qty=max_qty,
        low_threshold=low_threshold,
        cost_per_unit=float(ing.cost_per_unit),
        stock_pct=round(stock_pct, 1),
        is_low=qty <= low_threshold,
    )


@router.get("", response_model=List[IngredientOut])
def list_ingredients(db: Session = Depends(get_db)):
    ings = db.query(Ingredient).order_by(Ingredient.name).all()
    return [to_out(i) for i in ings]


@router.post("/{ing_id}/restock", response_model=IngredientOut)
def restock(ing_id: int, body: RestockRequest, db: Session = Depends(get_db)):
    ing = db.query(Ingredient).filter(Ingredient.id == ing_id).with_for_update().first()
    if not ing:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    qty_before = float(ing.qty)
    qty_after = qty_before + body.qty
    ing.qty = qty_after
    db.add(StockMovement(
        ingredient_id=ing.id, type="restock",
        qty_change=body.qty, qty_before=qty_before, qty_after=qty_after,
        note=body.note,
    ))
    db.commit()
    db.refresh(ing)
    return to_out(ing)


@router.post("/{ing_id}/waste", response_model=IngredientOut)
def log_waste(ing_id: int, body: WasteRequest, db: Session = Depends(get_db)):
    ing = db.query(Ingredient).filter(Ingredient.id == ing_id).with_for_update().first()
    if not ing:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    qty_before = float(ing.qty)
    qty_after = max(qty_before - body.qty, 0)
    ing.qty = qty_after
    db.add(StockMovement(
        ingredient_id=ing.id, type="waste",
        qty_change=-body.qty, qty_before=qty_before, qty_after=qty_after,
        note=body.reason,
    ))
    db.add(WasteLog(ingredient_id=ing.id, qty=body.qty, reason=body.reason))
    db.commit()
    db.refresh(ing)
    return to_out(ing)


@router.post("/{ing_id}/adjust", response_model=IngredientOut)
def adjust(ing_id: int, body: AdjustRequest, db: Session = Depends(get_db)):
    ing = db.query(Ingredient).filter(Ingredient.id == ing_id).with_for_update().first()
    if not ing:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    qty_before = float(ing.qty)
    qty_after = body.qty  # absolute set
    change = qty_after - qty_before
    ing.qty = qty_after
    db.add(StockMovement(
        ingredient_id=ing.id, type="adjustment",
        qty_change=change, qty_before=qty_before, qty_after=qty_after,
        note=body.note,
    ))
    db.commit()
    db.refresh(ing)
    return to_out(ing)
