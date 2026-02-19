"""
Main FastAPI application for AI-Powered Accountant.
"""
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.db import init_db
from app.api.deps import get_current_user
import os

# Import routers
from app.api import auth, documents, transactions, reports, customers, invoices

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI-powered accounting system for Canadian businesses",
    docs_url=None,     # Disable Swagger UI in production
    redoc_url=None,    # Disable ReDoc in production
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "https://accounting.johnnytran.ca"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)

# Create upload directory if it doesn't exist
os.makedirs(settings.upload_dir, exist_ok=True)


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    init_db()
    print(f"✅ {settings.app_name} v{settings.app_version} started")


@app.get("/")
async def root():
    return {"status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# Auth routes (public)
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])

# Protected routes
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"], dependencies=[Depends(get_current_user)])
app.include_router(transactions.router, prefix="/api/transactions", tags=["Transactions"], dependencies=[Depends(get_current_user)])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"], dependencies=[Depends(get_current_user)])
app.include_router(customers.router, prefix="/api/customers", tags=["Customers"], dependencies=[Depends(get_current_user)])
app.include_router(invoices.router, prefix="/api/invoices", tags=["Invoices"], dependencies=[Depends(get_current_user)])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=settings.debug)
