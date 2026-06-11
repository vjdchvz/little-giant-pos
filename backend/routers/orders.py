from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from db.database import get_db
from models.order import Order
from schemas.order import OrderCreate, OrderOut, VoidRequest
from services.order_service import create_order

router = APIRouter()


@router.post("", response_model=OrderOut)
def place_order(payload: OrderCreate, db: Session = Depends(get_db)):
    return create_order(payload, db)


@router.get("/recent", response_model=List[OrderOut])
def get_recent_orders(limit: int = 20, db: Session = Depends(get_db)):
    return (
        db.query(Order)
        .filter(Order.status != "voided")
        .order_by(Order.created_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.patch("/{order_id}/void", response_model=OrderOut)
def void_order(order_id: int, body: VoidRequest, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status == "voided":
        raise HTTPException(status_code=400, detail="Order already voided")
    order.status = "voided"
    order.notes = f"VOID: {body.reason}"
    db.commit()
    db.refresh(order)
    return order
