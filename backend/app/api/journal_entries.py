"""API endpoints for journal entry management."""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from datetime import date
from pydantic import BaseModel, Field

from app.db import get_db
from app.models.account import Account
from app.models.journal_entry import JournalEntry, JournalEntryLine
from app.services.journal_service import (
    create_manual_journal_entry,
    migrate_existing_transactions,
    validate_journal_entry_balance,
)

router = APIRouter()


# ── Schemas ──

class JournalLineCreate(BaseModel):
    account_id: int
    description: Optional[str] = Field(None, max_length=500)
    debit: float = Field(0.0, ge=0)
    credit: float = Field(0.0, ge=0)


class JournalEntryCreate(BaseModel):
    entry_date: date
    description: str = Field(..., min_length=1, max_length=500)
    notes: Optional[str] = None
    lines: list[JournalLineCreate] = Field(..., min_length=2)


# ── Helpers ──

def _serialize_entry(je: JournalEntry, include_lines: bool = False) -> dict:
    total_debit = sum(l.debit for l in je.lines) if je.lines else 0
    total_credit = sum(l.credit for l in je.lines) if je.lines else 0

    data = {
        "id": je.id,
        "entry_date": je.entry_date.isoformat(),
        "description": je.description,
        "reference": je.reference,
        "entry_type": je.entry_type,
        "transaction_id": je.transaction_id,
        "invoice_id": je.invoice_id,
        "is_posted": je.is_posted,
        "notes": je.notes,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "created_at": je.created_at.isoformat() if je.created_at else None,
    }

    if include_lines:
        data["lines"] = [
            {
                "id": line.id,
                "account_id": line.account_id,
                "account_code": line.account.code if line.account else None,
                "account_name": line.account.name if line.account else None,
                "description": line.description,
                "debit": line.debit,
                "credit": line.credit,
            }
            for line in (je.lines or [])
        ]

    return data


# ── Endpoints ──

@router.get("/")
async def list_journal_entries(
    skip: int = 0,
    limit: int = 50,
    entry_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    account_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """List journal entries with optional filtering."""
    query = db.query(JournalEntry).options(joinedload(JournalEntry.lines).joinedload(JournalEntryLine.account))

    if entry_type:
        query = query.filter(JournalEntry.entry_type == entry_type)
    if start_date:
        query = query.filter(JournalEntry.entry_date >= start_date)
    if end_date:
        query = query.filter(JournalEntry.entry_date <= end_date)
    if account_id:
        query = query.join(JournalEntryLine).filter(JournalEntryLine.account_id == account_id)

    # Get total before pagination
    total = query.count()
    entries = query.order_by(JournalEntry.entry_date.desc(), JournalEntry.id.desc()).offset(skip).limit(min(limit, 100)).all()

    return {
        "total": total,
        "entries": [_serialize_entry(je, include_lines=True) for je in entries],
    }


@router.get("/{entry_id}")
async def get_journal_entry(entry_id: int, db: Session = Depends(get_db)):
    """Get a single journal entry with all lines."""
    je = (
        db.query(JournalEntry)
        .options(joinedload(JournalEntry.lines).joinedload(JournalEntryLine.account))
        .filter(JournalEntry.id == entry_id)
        .first()
    )
    if not je:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return _serialize_entry(je, include_lines=True)


@router.post("/")
async def create_journal_entry(data: JournalEntryCreate, db: Session = Depends(get_db)):
    """Create a manual journal entry."""
    # Validate all account IDs exist
    lines_data = []
    for line in data.lines:
        account = db.query(Account).filter(Account.id == line.account_id, Account.is_active == True).first()
        if not account:
            raise HTTPException(status_code=400, detail=f"Account ID {line.account_id} not found or inactive")
        if line.debit == 0 and line.credit == 0:
            raise HTTPException(status_code=400, detail="Each line must have a debit or credit amount")
        if line.debit > 0 and line.credit > 0:
            raise HTTPException(status_code=400, detail="A line cannot have both debit and credit")
        lines_data.append({
            "account_id": line.account_id,
            "description": line.description,
            "debit": line.debit,
            "credit": line.credit,
        })

    if not validate_journal_entry_balance(lines_data):
        raise HTTPException(status_code=400, detail="Journal entry is not balanced: total debits must equal total credits")

    try:
        je = create_manual_journal_entry(db, data.entry_date, data.description, lines_data, data.notes)
        db.commit()
        db.refresh(je)
        return {"id": je.id, "message": "Journal entry created"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{entry_id}")
async def delete_journal_entry(entry_id: int, db: Session = Depends(get_db)):
    """Delete a journal entry. Only manual entries can be deleted."""
    je = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not je:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    if je.entry_type != "manual":
        raise HTTPException(status_code=400, detail="Only manual journal entries can be deleted")

    db.delete(je)
    db.commit()
    return {"message": "Journal entry deleted"}


@router.post("/migrate")
async def migrate_transactions(db: Session = Depends(get_db)):
    """One-time migration: create journal entries for existing transactions. Idempotent."""
    created = migrate_existing_transactions(db)
    return {"message": f"Migration complete. {created} journal entries created.", "created": created}
