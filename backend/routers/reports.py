from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date
from typing import List, Optional

from db.database import get_db
from schemas.reports import DailySummary, HourlySales
from services.report_service import get_daily_summary, get_hourly_sales

router = APIRouter()


@router.get("/daily", response_model=DailySummary)
def daily_report(target_date: Optional[str] = Query(None, alias="date"), db: Session = Depends(get_db)):
    parsed = date.fromisoformat(target_date) if target_date else None
    return get_daily_summary(db, parsed)


@router.get("/hourly", response_model=List[HourlySales])
def hourly_report(target_date: Optional[str] = Query(None, alias="date"), db: Session = Depends(get_db)):
    parsed = date.fromisoformat(target_date) if target_date else None
    return get_hourly_sales(db, parsed)
