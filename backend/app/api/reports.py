"""
API endpoints for financial reports and analytics.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import datetime, date
from typing import Optional
from collections import defaultdict

from app.db import get_db
from app.models.transaction import Transaction
from app.models.document import Document

router = APIRouter()


@router.get("/profit-loss")
async def profit_and_loss(
    start_date: date = Query(..., description="Start date for the report"),
    end_date: date = Query(..., description="End date for the report"),
    db: Session = Depends(get_db)
):
    """
    Generate Profit & Loss (Income Statement) report.
    Shows revenue, expenses, and net income for a period.
    """
    # Query transactions within date range
    transactions = db.query(Transaction).filter(
        Transaction.transaction_date >= datetime.combine(start_date, datetime.min.time()),
        Transaction.transaction_date <= datetime.combine(end_date, datetime.max.time())
    ).all()

    # Categorize transactions
    revenue = 0.0
    expenses_by_category = defaultdict(float)
    total_expenses = 0.0
    total_tax_paid = 0.0

    for t in transactions:
        if t.category == "revenue":
            revenue += t.amount
        elif t.category == "expense":
            expenses_by_category[t.subcategory or "Other"] += t.amount
            total_expenses += t.amount
            if t.tax_amount:
                total_tax_paid += t.tax_amount

    net_income = revenue - total_expenses

    return {
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
        },
        "revenue": {
            "total": round(revenue, 2),
        },
        "expenses": {
            "by_category": {k: round(v, 2) for k, v in expenses_by_category.items()},
            "total": round(total_expenses, 2),
        },
        "taxes": {
            "total_tax_paid": round(total_tax_paid, 2),
        },
        "net_income": round(net_income, 2),
        "profit_margin": round((net_income / revenue * 100) if revenue > 0 else 0, 2),
    }


@router.get("/expenses-by-category")
async def expenses_by_category(
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db)
):
    """Get expenses broken down by category for a date range."""
    result = db.query(
        Transaction.subcategory,
        func.sum(Transaction.amount).label("total"),
        func.count(Transaction.id).label("count")
    ).filter(
        Transaction.category == "expense",
        Transaction.transaction_date >= datetime.combine(start_date, datetime.min.time()),
        Transaction.transaction_date <= datetime.combine(end_date, datetime.max.time())
    ).group_by(Transaction.subcategory).all()

    categories = [
        {
            "category": r.subcategory or "Uncategorized",
            "total": round(r.total, 2),
            "count": r.count,
        }
        for r in result
    ]

    total = sum(c["total"] for c in categories)

    # Add percentage
    for c in categories:
        c["percentage"] = round((c["total"] / total * 100) if total > 0 else 0, 2)

    return {
        "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "categories": sorted(categories, key=lambda x: x["total"], reverse=True),
        "total": round(total, 2),
    }


@router.get("/tax-summary")
async def tax_summary(
    year: int = Query(..., description="Tax year"),
    db: Session = Depends(get_db)
):
    """
    Generate tax summary for Canadian tax filing.
    Shows GST/HST collected and paid, income, deductible expenses.
    """
    start_date = datetime(year, 1, 1)
    end_date = datetime(year, 12, 31, 23, 59, 59)

    transactions = db.query(Transaction).filter(
        Transaction.transaction_date >= start_date,
        Transaction.transaction_date <= end_date
    ).all()

    # Calculate tax figures
    gst_hst_collected = 0.0  # On sales
    gst_hst_paid = 0.0  # On purchases
    total_revenue = 0.0
    total_deductible_expenses = 0.0
    total_non_deductible = 0.0

    for t in transactions:
        if t.category == "revenue":
            total_revenue += t.amount
            if t.tax_amount:
                gst_hst_collected += t.tax_amount
        elif t.category == "expense":
            if t.tax_deductible:
                total_deductible_expenses += t.amount
            else:
                total_non_deductible += t.amount

            if t.tax_amount:
                gst_hst_paid += t.tax_amount

    net_gst_hst = gst_hst_collected - gst_hst_paid
    taxable_income = total_revenue - total_deductible_expenses

    return {
        "tax_year": year,
        "revenue": {
            "total": round(total_revenue, 2),
        },
        "expenses": {
            "deductible": round(total_deductible_expenses, 2),
            "non_deductible": round(total_non_deductible, 2),
            "total": round(total_deductible_expenses + total_non_deductible, 2),
        },
        "gst_hst": {
            "collected": round(gst_hst_collected, 2),
            "paid": round(gst_hst_paid, 2),
            "net_owing": round(net_gst_hst, 2),
            "note": "Positive means you owe CRA, negative means you get a refund"
        },
        "taxable_income": round(taxable_income, 2),
    }


@router.get("/monthly-summary")
async def monthly_summary(
    year: int = Query(...),
    db: Session = Depends(get_db)
):
    """Get monthly revenue and expenses summary for a year."""
    start_date = datetime(year, 1, 1)
    end_date = datetime(year, 12, 31, 23, 59, 59)

    # Get all transactions for the year
    transactions = db.query(Transaction).filter(
        Transaction.transaction_date >= start_date,
        Transaction.transaction_date <= end_date
    ).all()

    # Group by month
    monthly_data = defaultdict(lambda: {"revenue": 0.0, "expenses": 0.0})

    for t in transactions:
        month = t.transaction_date.month
        if t.category == "revenue":
            monthly_data[month]["revenue"] += t.amount
        elif t.category == "expense":
            monthly_data[month]["expenses"] += t.amount

    # Format response
    months = []
    for m in range(1, 13):
        data = monthly_data[m]
        net = data["revenue"] - data["expenses"]
        months.append({
            "month": m,
            "month_name": datetime(year, m, 1).strftime("%B"),
            "revenue": round(data["revenue"], 2),
            "expenses": round(data["expenses"], 2),
            "net_income": round(net, 2),
        })

    total_revenue = sum(m["revenue"] for m in months)
    total_expenses = sum(m["expenses"] for m in months)

    return {
        "year": year,
        "months": months,
        "totals": {
            "revenue": round(total_revenue, 2),
            "expenses": round(total_expenses, 2),
            "net_income": round(total_revenue - total_expenses, 2),
        }
    }


@router.get("/dashboard")
async def dashboard_stats(db: Session = Depends(get_db)):
    """
    Get key dashboard statistics and metrics.
    """
    # Get current month stats
    now = datetime.now()
    month_start = datetime(now.year, now.month, 1)

    # Total documents
    total_documents = db.query(func.count(Document.id)).scalar()
    pending_review = db.query(func.count(Document.id)).filter(
        Document.processing_status == "review_needed"
    ).scalar()

    # This month's transactions
    month_transactions = db.query(Transaction).filter(
        Transaction.transaction_date >= month_start
    ).all()

    month_revenue = sum(t.amount for t in month_transactions if t.category == "revenue")
    month_expenses = sum(t.amount for t in month_transactions if t.category == "expense")

    # Recent documents
    recent_docs = db.query(Document).order_by(
        Document.created_at.desc()
    ).limit(5).all()

    return {
        "documents": {
            "total": total_documents,
            "pending_review": pending_review,
        },
        "this_month": {
            "revenue": round(month_revenue, 2),
            "expenses": round(month_expenses, 2),
            "net_income": round(month_revenue - month_expenses, 2),
        },
        "recent_uploads": [
            {
                "id": doc.id,
                "filename": doc.original_filename,
                "type": doc.document_type,
                "amount": doc.amount,
                "status": doc.processing_status,
                "created_at": doc.created_at.isoformat(),
            }
            for doc in recent_docs
        ],
    }
