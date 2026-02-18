"""
API endpoints for transaction management.
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, date
from pydantic import BaseModel

from app.db import get_db
from app.models.transaction import Transaction
from app.models.document import Document

router = APIRouter()


class TransactionCreate(BaseModel):
    """Schema for creating a new transaction."""
    transaction_date: date
    description: str
    amount: float
    category: str
    subcategory: Optional[str] = None
    counterparty_name: Optional[str] = None
    tax_amount: Optional[float] = 0.0
    tax_rate: Optional[float] = None
    payment_method: Optional[str] = "cash"
    document_id: Optional[int] = None


@router.post("/")
async def create_transaction(
    transaction_data: TransactionCreate,
    db: Session = Depends(get_db)
):
    """Create a new transaction manually."""
    transaction = Transaction(
        transaction_date=datetime.combine(transaction_data.transaction_date, datetime.min.time()),
        description=transaction_data.description,
        amount=transaction_data.amount,
        category=transaction_data.category,
        subcategory=transaction_data.subcategory,
        counterparty_name=transaction_data.counterparty_name,
        tax_amount=transaction_data.tax_amount or 0.0,
        tax_rate=transaction_data.tax_rate,
        payment_method=transaction_data.payment_method,
        document_id=transaction_data.document_id,
        created_by="manual_entry",
    )

    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    return {
        "id": transaction.id,
        "message": "Transaction created successfully",
        "transaction": transaction
    }


@router.get("/")
async def list_transactions(
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """List all transactions with optional filtering."""
    query = db.query(Transaction)

    if category:
        query = query.filter(Transaction.category == category)

    if start_date:
        query = query.filter(Transaction.transaction_date >= datetime.combine(start_date, datetime.min.time()))

    if end_date:
        query = query.filter(Transaction.transaction_date <= datetime.combine(end_date, datetime.max.time()))

    transactions = query.order_by(Transaction.transaction_date.desc()).offset(skip).limit(limit).all()

    return {
        "total": query.count(),
        "transactions": [
            {
                "id": t.id,
                "date": t.transaction_date.date().isoformat(),
                "description": t.description,
                "amount": t.amount,
                "category": t.category,
                "subcategory": t.subcategory,
                "counterparty": t.counterparty_name,
                "tax_amount": t.tax_amount,
                "payment_method": t.payment_method,
                "created_by": t.created_by,
            }
            for t in transactions
        ]
    }


@router.get("/{transaction_id}")
async def get_transaction(transaction_id: int, db: Session = Depends(get_db)):
    """Get detailed information about a specific transaction."""
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Get linked document if any
    document = None
    if transaction.document_id:
        document = db.query(Document).filter(Document.id == transaction.document_id).first()

    return {
        "id": transaction.id,
        "transaction_date": transaction.transaction_date.isoformat(),
        "description": transaction.description,
        "amount": transaction.amount,
        "currency": transaction.currency,
        "category": transaction.category,
        "subcategory": transaction.subcategory,
        "counterparty_name": transaction.counterparty_name,
        "counterparty_type": transaction.counterparty_type,
        "tax_amount": transaction.tax_amount,
        "tax_rate": transaction.tax_rate,
        "tax_type": transaction.tax_type,
        "tax_deductible": transaction.tax_deductible,
        "payment_method": transaction.payment_method,
        "payment_status": transaction.payment_status,
        "created_by": transaction.created_by,
        "review_status": transaction.review_status,
        "created_at": transaction.created_at.isoformat(),
        "document": {
            "id": document.id,
            "filename": document.original_filename,
        } if document else None,
    }


@router.patch("/{transaction_id}")
async def update_transaction(
    transaction_id: int,
    transaction_data: TransactionCreate,
    db: Session = Depends(get_db)
):
    """Update an existing transaction."""
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Update fields
    transaction.transaction_date = datetime.combine(transaction_data.transaction_date, datetime.min.time())
    transaction.description = transaction_data.description
    transaction.amount = transaction_data.amount
    transaction.category = transaction_data.category
    transaction.subcategory = transaction_data.subcategory
    transaction.counterparty_name = transaction_data.counterparty_name
    transaction.tax_amount = transaction_data.tax_amount or 0.0
    transaction.tax_rate = transaction_data.tax_rate
    transaction.payment_method = transaction_data.payment_method

    db.commit()

    return {"message": "Transaction updated successfully"}


@router.delete("/{transaction_id}")
async def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    """Delete a transaction."""
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    db.delete(transaction)
    db.commit()

    return {"message": "Transaction deleted successfully"}


@router.post("/{transaction_id}/approve")
async def approve_transaction(
    transaction_id: int,
    db: Session = Depends(get_db)
):
    """Approve a transaction for accounting sync."""
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    transaction.review_status = "approved"
    transaction.reviewed_by = "user"  # In real app, use authenticated user

    db.commit()

    return {"message": "Transaction approved"}
