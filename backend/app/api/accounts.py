"""API endpoints for Chart of Accounts management."""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func as sqla_func
from typing import Optional
from pydantic import BaseModel, Field

from app.db import get_db
from app.models.account import Account
from app.models.journal_entry import JournalEntryLine, JournalEntry
from app.services.coa_seed import seed_chart_of_accounts

router = APIRouter()


# ── Schemas ──

class AccountCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=255)
    account_type: str = Field(..., min_length=1, max_length=20)
    sub_type: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    parent_account_id: Optional[int] = None
    tax_code: Optional[str] = Field(None, max_length=20)
    normal_balance: Optional[str] = "debit"


class AccountUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    sub_type: Optional[str] = Field(None, max_length=50)
    tax_code: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None


# ── Helpers ──

def _account_balance(db: Session, account_id: int) -> float:
    """Calculate account balance from journal entry lines."""
    result = db.query(
        sqla_func.coalesce(sqla_func.sum(JournalEntryLine.debit), 0).label("total_debit"),
        sqla_func.coalesce(sqla_func.sum(JournalEntryLine.credit), 0).label("total_credit"),
    ).join(JournalEntry).filter(
        JournalEntryLine.account_id == account_id,
        JournalEntry.is_posted == True,
    ).first()

    total_debit = result.total_debit or 0
    total_credit = result.total_credit or 0

    # For asset/expense accounts: balance = debits - credits
    # For liability/equity/revenue accounts: balance = credits - debits
    account = db.query(Account).filter(Account.id == account_id).first()
    if account and account.normal_balance == "credit":
        return total_credit - total_debit
    return total_debit - total_credit


def _serialize_account(account: Account, balance: float = None) -> dict:
    return {
        "id": account.id,
        "code": account.code,
        "name": account.name,
        "account_type": account.account_type,
        "sub_type": account.sub_type,
        "description": account.description,
        "parent_account_id": account.parent_account_id,
        "is_active": account.is_active,
        "is_system": account.is_system,
        "tax_code": account.tax_code,
        "normal_balance": account.normal_balance,
        "balance": balance,
    }


# ── Endpoints ──

@router.get("/")
async def list_accounts(
    account_type: Optional[str] = None,
    active_only: bool = True,
    with_balances: bool = False,
    db: Session = Depends(get_db),
):
    """List all accounts, optionally filtered by type."""
    query = db.query(Account)
    if account_type:
        query = query.filter(Account.account_type == account_type)
    if active_only:
        query = query.filter(Account.is_active == True)

    accounts = query.order_by(Account.code).all()

    result = []
    for acct in accounts:
        balance = _account_balance(db, acct.id) if with_balances else None
        result.append(_serialize_account(acct, balance))

    return {"total": len(result), "accounts": result}


@router.get("/{account_id}")
async def get_account(account_id: int, db: Session = Depends(get_db)):
    """Get a single account with its current balance."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    balance = _account_balance(db, account.id)
    return _serialize_account(account, balance)


@router.post("/")
async def create_account(data: AccountCreate, db: Session = Depends(get_db)):
    """Create a new account."""
    valid_types = {"asset", "liability", "equity", "revenue", "expense"}
    if data.account_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid account_type. Must be one of: {', '.join(valid_types)}")

    existing = db.query(Account).filter(Account.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Account code {data.code} already exists")

    if data.parent_account_id:
        parent = db.query(Account).filter(Account.id == data.parent_account_id).first()
        if not parent:
            raise HTTPException(status_code=400, detail="Parent account not found")

    account = Account(
        code=data.code,
        name=data.name,
        account_type=data.account_type,
        sub_type=data.sub_type,
        description=data.description,
        parent_account_id=data.parent_account_id,
        tax_code=data.tax_code,
        normal_balance=data.normal_balance or ("credit" if data.account_type in ("liability", "equity", "revenue") else "debit"),
        is_system=False,
        is_active=True,
    )
    db.add(account)
    db.commit()
    db.refresh(account)

    return {"id": account.id, "message": "Account created"}


@router.patch("/{account_id}")
async def update_account(account_id: int, data: AccountUpdate, db: Session = Depends(get_db)):
    """Update an account."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if data.name is not None:
        account.name = data.name
    if data.description is not None:
        account.description = data.description
    if data.sub_type is not None:
        account.sub_type = data.sub_type
    if data.tax_code is not None:
        account.tax_code = data.tax_code
    if data.is_active is not None:
        account.is_active = data.is_active

    db.commit()
    return {"message": "Account updated"}


@router.delete("/{account_id}")
async def delete_account(account_id: int, db: Session = Depends(get_db)):
    """Delete (deactivate) an account. System accounts cannot be deleted."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.is_system:
        raise HTTPException(status_code=400, detail="System accounts cannot be deleted")

    # Check if account has journal entries
    has_entries = db.query(JournalEntryLine).filter(JournalEntryLine.account_id == account_id).first()
    if has_entries:
        # Soft delete — deactivate instead
        account.is_active = False
        db.commit()
        return {"message": "Account deactivated (has existing journal entries)"}

    db.delete(account)
    db.commit()
    return {"message": "Account deleted"}


@router.post("/seed")
async def seed_accounts(db: Session = Depends(get_db)):
    """Seed default chart of accounts. Idempotent."""
    created = seed_chart_of_accounts(db)
    return {"message": f"{created} accounts created", "created": created}


@router.get("/{account_id}/ledger")
async def get_account_ledger(
    account_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Get all journal entry lines for an account (general ledger view)."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    query = (
        db.query(JournalEntryLine)
        .join(JournalEntry)
        .filter(JournalEntryLine.account_id == account_id, JournalEntry.is_posted == True)
        .order_by(JournalEntry.entry_date.desc(), JournalEntry.id.desc())
    )

    total = query.count()
    lines = query.offset(skip).limit(min(limit, 200)).all()

    return {
        "account": _serialize_account(account, _account_balance(db, account_id)),
        "total": total,
        "entries": [
            {
                "id": line.id,
                "journal_entry_id": line.journal_entry_id,
                "date": line.journal_entry.entry_date.isoformat(),
                "description": line.description or line.journal_entry.description,
                "reference": line.journal_entry.reference,
                "entry_type": line.journal_entry.entry_type,
                "debit": line.debit,
                "credit": line.credit,
            }
            for line in lines
        ],
    }
