from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from datetime import date, datetime
from typing import List

from models.order import Order, OrderItem
from models.menu import MenuItem
from models.ingredient import Ingredient
from schemas.reports import DailySummary, TopItem, PaymentBreakdown, HourlySales


def get_daily_summary(db: Session, target_date: date = None) -> DailySummary:
    if target_date is None:
        target_date = date.today()

    orders = (
        db.query(Order)
        .filter(
            cast(Order.created_at, Date) == target_date,
            Order.status == "completed",
        )
        .all()
    )

    gross_sales = sum(float(o.total) for o in orders)
    total_orders = len(orders)
    avg_order_value = gross_sales / total_orders if total_orders else 0

    # Payment breakdown
    breakdown = {"cash": 0.0, "gcash": 0.0, "maya": 0.0}
    for o in orders:
        method = o.payment_method.lower()
        if method in breakdown:
            breakdown[method] += float(o.total)

    # Top items by revenue
    item_stats: dict[int, dict] = {}
    for order in orders:
        for oi in order.items:
            if oi.menu_item_id not in item_stats:
                mi = db.query(MenuItem).filter(MenuItem.id == oi.menu_item_id).first()
                item_stats[oi.menu_item_id] = {
                    "menu_item_id": oi.menu_item_id,
                    "name": oi.name,
                    "emoji": mi.emoji if mi else "🍽️",
                    "qty_sold": 0,
                    "revenue": 0.0,
                }
            item_stats[oi.menu_item_id]["qty_sold"] += oi.qty
            item_stats[oi.menu_item_id]["revenue"] += float(oi.subtotal)

    top_items = sorted(item_stats.values(), key=lambda x: x["revenue"], reverse=True)[:5]

    low_stock_count = db.query(Ingredient).filter(
        Ingredient.qty <= Ingredient.low_threshold
    ).count()

    return DailySummary(
        date=str(target_date),
        gross_sales=gross_sales,
        total_orders=total_orders,
        avg_order_value=round(avg_order_value, 2),
        top_items=[TopItem(**i) for i in top_items],
        payment_breakdown=PaymentBreakdown(**breakdown),
        low_stock_count=low_stock_count,
    )


def get_hourly_sales(db: Session, target_date: date = None) -> List[HourlySales]:
    if target_date is None:
        target_date = date.today()

    orders = (
        db.query(Order)
        .filter(
            cast(Order.created_at, Date) == target_date,
            Order.status == "completed",
        )
        .all()
    )

    hourly: dict[int, dict] = {h: {"hour": h, "total": 0.0, "orders": 0} for h in range(24)}
    for o in orders:
        h = o.created_at.hour
        hourly[h]["total"] += float(o.total)
        hourly[h]["orders"] += 1

    return [HourlySales(**v) for v in hourly.values()]
