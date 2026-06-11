from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import orders, menu, ingredients, ai, reports

app = FastAPI(
    title="Little Giant POS API",
    description="Backend API for Little Giant Food Stall POS",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(menu.router,        prefix="/api/menu",        tags=["Menu"])
app.include_router(orders.router,      prefix="/api/orders",      tags=["Orders"])
app.include_router(ingredients.router, prefix="/api/ingredients",  tags=["Ingredients"])
app.include_router(ai.router,          prefix="/api/ai",           tags=["AI Assistant"])
app.include_router(reports.router,     prefix="/api/reports",      tags=["Reports"])

@app.get("/")
def root():
    return {"app": "Little Giant POS", "version": "0.1.0", "status": "running"}
