from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException

from models.menu import MenuItem
from models.ingredient import Ingredient, Recipe, StockMovement
from models.order import Order, OrderItem
from schemas.order import OrderCreate


def generate_order_number(db: Session) -> str:
    count = db.query(Order).count()
    return f"LG-{count + 1:03d}"


def create_order(payload: OrderCreate, db: Session) -> Order:
    try:
        subtotal = sum(item.subtotal for item in payload.items)
        total = subtotal - payload.discount

        order = Order(
            order_number=generate_order_number(db),
            status="completed",
            payment_method=payload.payment_method,
            subtotal=subtotal,
            discount=payload.discount,
            total=total,
            cashier_name=payload.cashier_name,
            notes=payload.notes,
        )
        db.add(order)
        db.flush()  # get order.id without committing

        for cart_item in payload.items:
            order_item = OrderItem(
                order_id=order.id,
                menu_item_id=cart_item.menu_item_id,
                name=cart_item.name,
                price=cart_item.price,
                qty=cart_item.qty,
                subtotal=cart_item.subtotal,
                notes=cart_item.notes,
            )
            db.add(order_item)

            # Deduct ingredients per recipe
            recipes = (
                db.query(Recipe)
                .filter(Recipe.menu_item_id == cart_item.menu_item_id)
                .all()
            )
            for recipe in recipes:
                ingredient = (
                    db.query(Ingredient)
                    .filter(Ingredient.id == recipe.ingredient_id)
                    .with_for_update()  # row-level lock
                    .first()
                )
                if not ingredient:
                    continue

                total_deduct = float(recipe.qty_per_order) * cart_item.qty
                qty_before = float(ingredient.qty)
                qty_after = max(qty_before - total_deduct, 0)

                ingredient.qty = qty_after

                movement = StockMovement(
                    ingredient_id=ingredient.id,
                    type="sale_deduction",
                    qty_change=-total_deduct,
                    qty_before=qty_before,
                    qty_after=qty_after,
                    reference_id=order.id,
                    note=f"Order {order.order_number}",
                )
                db.add(movement)

        db.commit()
        db.refresh(order)
        return order

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Order creation failed: {str(e)}")
