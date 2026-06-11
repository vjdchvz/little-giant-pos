from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from db.database import get_db
from services.ai_service import chat, generate_eod_report

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    history: List[dict] = []


class ChatResponse(BaseModel):
    response: str


class EODResponse(BaseModel):
    report: str


@router.post("/chat", response_model=ChatResponse)
def ai_chat(body: ChatRequest, db: Session = Depends(get_db)):
    response = chat(body.message, body.history, db)
    return ChatResponse(response=response)


@router.post("/eod-report", response_model=EODResponse)
def eod_report(db: Session = Depends(get_db)):
    report = generate_eod_report(db)
    return EODResponse(report=report)
