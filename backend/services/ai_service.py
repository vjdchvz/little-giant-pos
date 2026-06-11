import os
import anthropic
from sqlalchemy.orm import Session
from datetime import date

from services.report_service import get_daily_summary
from models.ingredient import Ingredient

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT_TEMPLATE = """You are the AI assistant for Little Giant POS, a food park stall in the Philippines.
You help the owner understand their business and make smart decisions.
Always respond in Taglish (mix of Filipino and English) — friendly, casual, and direct.
Keep responses short and practical. Use bullet points when listing items.
Use ₱ for peso amounts.

Current business context:
- Today's date: {today}
- Today's gross sales: ₱{gross_sales:,.2f}
- Total orders today: {total_orders}
- Average order value: ₱{avg_order_value:,.2f}
- Best seller: {best_seller}
- Low stock items ({low_stock_count}): {low_stock_items}
- Top 5 items by revenue: {top_items}
- Payment breakdown — Cash: ₱{cash:,.0f} | GCash: ₱{gcash:,.0f} | Maya: ₱{maya:,.0f}

Be specific, use the real numbers, and give actionable advice."""


def build_system_prompt(db: Session) -> str:
    summary = get_daily_summary(db)
    best_seller = summary.top_items[0].name if summary.top_items else "N/A"
    low_ings = db.query(Ingredient).filter(Ingredient.qty <= Ingredient.low_threshold).all()
    low_stock_list = ", ".join(f"{i.name} ({float(i.qty):.0f} {i.unit})" for i in low_ings) or "Wala"
    top_items_list = ", ".join(
        f"{i.emoji} {i.name} (₱{i.revenue:,.0f})" for i in summary.top_items
    ) or "Wala pa"

    return SYSTEM_PROMPT_TEMPLATE.format(
        today=str(date.today()),
        gross_sales=summary.gross_sales,
        total_orders=summary.total_orders,
        avg_order_value=summary.avg_order_value,
        best_seller=best_seller,
        low_stock_count=summary.low_stock_count,
        low_stock_items=low_stock_list,
        top_items=top_items_list,
        cash=summary.payment_breakdown.cash,
        gcash=summary.payment_breakdown.gcash,
        maya=summary.payment_breakdown.maya,
    )


def chat(message: str, history: list[dict], db: Session) -> str:
    system = build_system_prompt(db)

    messages = []
    for h in history[-10:]:  # limit context to last 10 turns
        if h["role"] in ("user", "assistant"):
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=512,
        system=system,
        messages=messages,
    )
    return response.content[0].text


def generate_eod_report(db: Session) -> str:
    system = build_system_prompt(db)
    prompt = (
        "Generate a concise End-of-Day (EOD) report para sa araw na ito. "
        "I-include ang: total sales, number of orders, best sellers, payment methods, "
        "at kung anong items ang nag-low stock. Mag-suggest ng actions para bukas."
    )
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=800,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text
