"""API endpoints for bank accounts and transaction imports."""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
from pydantic import BaseModel, Field
import logging

from app.db import get_db
from app.models.bank_account import BankAccount, BankTransaction
from app.models.account import Account
from app.services.bank_import import parse_bank_csv

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Schemas ──

class BankAccountCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    institution: Optional[str] = Field(None, max_length=100)
    account_number_last4: Optional[str] = Field(None, max_length=4)
    account_type: str = Field("chequing", pattern="^(chequing|savings|credit_card)$")
    currency: str = Field("CAD", max_length=3)
    gl_account_id: Optional[int] = None
    opening_balance: float = 0.0


class BankAccountUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    institution: Optional[str] = Field(None, max_length=100)
    account_number_last4: Optional[str] = Field(None, max_length=4)
    account_type: Optional[str] = None
    gl_account_id: Optional[int] = None
    is_active: Optional[bool] = None


# ── Helpers ──

def _serialize_bank_account(ba: BankAccount) -> dict:
    return {
        "id": ba.id,
        "name": ba.name,
        "institution": ba.institution,
        "account_number_last4": ba.account_number_last4,
        "account_type": ba.account_type,
        "currency": ba.currency,
        "gl_account_id": ba.gl_account_id,
        "gl_account_name": ba.gl_account.name if ba.gl_account else None,
        "opening_balance": ba.opening_balance,
        "current_balance": ba.current_balance,
        "is_active": ba.is_active,
        "created_at": ba.created_at.isoformat() if ba.created_at else None,
    }


def _serialize_bank_transaction(bt: BankTransaction) -> dict:
    return {
        "id": bt.id,
        "bank_account_id": bt.bank_account_id,
        "transaction_date": bt.transaction_date.isoformat() if bt.transaction_date else None,
        "description": bt.description,
        "amount": bt.amount,
        "balance": bt.balance,
        "reference": bt.reference,
        "category": bt.category,
        "is_reconciled": bt.is_reconciled,
        "journal_entry_id": bt.journal_entry_id,
        "created_at": bt.created_at.isoformat() if bt.created_at else None,
    }


def _recalculate_balance(db: Session, bank_account_id: int):
    """Recalculate current balance from opening balance + all transactions."""
    ba = db.query(BankAccount).filter(BankAccount.id == bank_account_id).first()
    if not ba:
        return
    total = db.query(
        __import__('sqlalchemy', fromlist=['func']).func.coalesce(
            __import__('sqlalchemy', fromlist=['func']).func.sum(BankTransaction.amount), 0
        )
    ).filter(BankTransaction.bank_account_id == bank_account_id).scalar()
    ba.current_balance = round(ba.opening_balance + (total or 0), 2)


# ── Endpoints ──

@router.post("/")
async def create_bank_account(data: BankAccountCreate, db: Session = Depends(get_db)):
    """Create a new bank account."""
    if data.gl_account_id:
        acct = db.query(Account).filter(Account.id == data.gl_account_id).first()
        if not acct:
            raise HTTPException(status_code=400, detail="GL account not found")

    ba = BankAccount(
        name=data.name,
        institution=data.institution,
        account_number_last4=data.account_number_last4,
        account_type=data.account_type,
        currency=data.currency,
        gl_account_id=data.gl_account_id,
        opening_balance=data.opening_balance,
        current_balance=data.opening_balance,
    )
    db.add(ba)
    db.commit()
    db.refresh(ba)
    return {"id": ba.id, "message": "Bank account created"}


@router.get("/")
async def list_bank_accounts(db: Session = Depends(get_db)):
    """List all bank accounts."""
    accounts = db.query(BankAccount).order_by(BankAccount.name).all()
    return {
        "accounts": [_serialize_bank_account(ba) for ba in accounts],
    }


@router.get("/{bank_account_id}")
async def get_bank_account(bank_account_id: int, db: Session = Depends(get_db)):
    """Get a specific bank account."""
    ba = db.query(BankAccount).filter(BankAccount.id == bank_account_id).first()
    if not ba:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return _serialize_bank_account(ba)


@router.patch("/{bank_account_id}")
async def update_bank_account(bank_account_id: int, data: BankAccountUpdate, db: Session = Depends(get_db)):
    """Update a bank account."""
    ba = db.query(BankAccount).filter(BankAccount.id == bank_account_id).first()
    if not ba:
        raise HTTPException(status_code=404, detail="Bank account not found")

    if data.name is not None:
        ba.name = data.name
    if data.institution is not None:
        ba.institution = data.institution
    if data.account_number_last4 is not None:
        ba.account_number_last4 = data.account_number_last4
    if data.account_type is not None:
        ba.account_type = data.account_type
    if data.gl_account_id is not None:
        acct = db.query(Account).filter(Account.id == data.gl_account_id).first()
        if not acct:
            raise HTTPException(status_code=400, detail="GL account not found")
        ba.gl_account_id = data.gl_account_id
    if data.is_active is not None:
        ba.is_active = data.is_active

    db.commit()
    return {"message": "Bank account updated"}


@router.post("/{bank_account_id}/import")
async def import_csv(
    bank_account_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Import transactions from a CSV bank statement."""
    ba = db.query(BankAccount).filter(BankAccount.id == bank_account_id).first()
    if not ba:
        raise HTTPException(status_code=404, detail="Bank account not found")

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    if len(content) > 5_000_000:  # 5MB limit
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    try:
        parsed = parse_bank_csv(content)
    except Exception as e:
        logger.error("CSV parse error: %s", e)
        raise HTTPException(status_code=400, detail="Failed to parse CSV file. Check the format.")

    if not parsed:
        raise HTTPException(status_code=400, detail="No transactions found in CSV. Check headers and date format.")

    # Dedup: get existing hashes for this account
    existing_hashes = set(
        h[0] for h in db.query(BankTransaction.import_hash)
        .filter(BankTransaction.bank_account_id == bank_account_id)
        .all()
    )

    imported = 0
    skipped = 0

    for txn in parsed:
        if txn["import_hash"] in existing_hashes:
            skipped += 1
            continue

        bt = BankTransaction(
            bank_account_id=bank_account_id,
            transaction_date=txn["transaction_date"],
            description=txn["description"],
            amount=txn["amount"],
            balance=txn.get("balance"),
            reference=txn.get("reference"),
            import_hash=txn["import_hash"],
        )
        db.add(bt)
        existing_hashes.add(txn["import_hash"])
        imported += 1

    # Recalculate balance
    db.flush()
    from sqlalchemy import func
    total = db.query(
        func.coalesce(func.sum(BankTransaction.amount), 0)
    ).filter(BankTransaction.bank_account_id == bank_account_id).scalar()
    ba.current_balance = round(ba.opening_balance + (total or 0), 2)

    db.commit()

    return {
        "message": f"Imported {imported} transactions, skipped {skipped} duplicates",
        "imported": imported,
        "skipped": skipped,
        "total_in_file": len(parsed),
        "new_balance": ba.current_balance,
    }


@router.get("/{bank_account_id}/transactions")
async def list_bank_transactions(
    bank_account_id: int,
    skip: int = 0,
    limit: int = 50,
    is_reconciled: Optional[bool] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """List transactions for a bank account."""
    ba = db.query(BankAccount).filter(BankAccount.id == bank_account_id).first()
    if not ba:
        raise HTTPException(status_code=404, detail="Bank account not found")

    query = db.query(BankTransaction).filter(BankTransaction.bank_account_id == bank_account_id)

    if is_reconciled is not None:
        query = query.filter(BankTransaction.is_reconciled == is_reconciled)
    if start_date:
        query = query.filter(BankTransaction.transaction_date >= start_date)
    if end_date:
        query = query.filter(BankTransaction.transaction_date <= end_date)

    total = query.count()
    transactions = (
        query.order_by(BankTransaction.transaction_date.desc(), BankTransaction.id.desc())
        .offset(skip)
        .limit(min(limit, 200))
        .all()
    )

    return {
        "total": total,
        "transactions": [_serialize_bank_transaction(bt) for bt in transactions],
    }


@router.patch("/{bank_account_id}/transactions/{transaction_id}/reconcile")
async def reconcile_transaction(
    bank_account_id: int,
    transaction_id: int,
    journal_entry_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Mark a bank transaction as reconciled, optionally linking to a journal entry."""
    bt = db.query(BankTransaction).filter(
        BankTransaction.id == transaction_id,
        BankTransaction.bank_account_id == bank_account_id,
    ).first()
    if not bt:
        raise HTTPException(status_code=404, detail="Transaction not found")

    bt.is_reconciled = True
    if journal_entry_id:
        bt.journal_entry_id = journal_entry_id

    db.commit()
    return {"message": "Transaction reconciled"}


@router.patch("/{bank_account_id}/transactions/{transaction_id}/unreconcile")
async def unreconcile_transaction(
    bank_account_id: int,
    transaction_id: int,
    db: Session = Depends(get_db),
):
    """Unmark a bank transaction as reconciled."""
    bt = db.query(BankTransaction).filter(
        BankTransaction.id == transaction_id,
        BankTransaction.bank_account_id == bank_account_id,
    ).first()
    if not bt:
        raise HTTPException(status_code=404, detail="Transaction not found")

    bt.is_reconciled = False
    bt.journal_entry_id = None
    db.commit()
    return {"message": "Transaction unreconciled"}
