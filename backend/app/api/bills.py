"""API endpoints for bill (accounts payable) management."""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from datetime import date
from pydantic import BaseModel, Field, field_validator
import logging

from app.db import get_db
from app.models.customer import Customer
from app.models.account import Account
from app.models.bill import Bill, BillItem, BillPayment
from app.services.journal_service import create_je_for_bill_received, create_je_for_bill_payment

logger = logging.getLogger(__name__)
router = APIRouter()

VALID_STATUSES = {"draft", "received", "paid", "overdue"}


# ── Schemas ──

class BillItemCreate(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)
    quantity: float = Field(..., gt=0, lt=1_000_000)
    unit_price: float = Field(..., gt=0, lt=1_000_000_000)
    account_id: Optional[int] = None  # expense account for this line


class BillCreate(BaseModel):
    vendor_id: int
    bill_date: date
    due_date: date
    apply_gst: bool = False
    notes: Optional[str] = Field(None, max_length=2000)
    expense_account_id: Optional[int] = None
    items: list[BillItemCreate] = Field(..., min_length=1)

    @field_validator("due_date")
    @classmethod
    def due_date_not_before_bill(cls, v, info):
        bill_date = info.data.get("bill_date")
        if bill_date and v < bill_date:
            raise ValueError("Due date cannot be before bill date")
        return v


class BillUpdate(BaseModel):
    vendor_id: Optional[int] = None
    bill_date: Optional[date] = None
    due_date: Optional[date] = None
    apply_gst: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=2000)
    expense_account_id: Optional[int] = None
    items: Optional[list[BillItemCreate]] = None


class BillPaymentCreate(BaseModel):
    payment_date: date
    amount: float = Field(..., gt=0, lt=1_000_000_000)
    payment_method: str = Field(default="bank_transfer", max_length=50)
    reference: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=2000)


class StatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v not in VALID_STATUSES:
            raise ValueError(f"Invalid status. Allowed: {', '.join(VALID_STATUSES)}")
        return v


# ── Helpers ──

def _next_bill_number(db: Session) -> str:
    last = db.query(Bill).order_by(Bill.id.desc()).first()
    if last:
        try:
            last_num = int(last.bill_number.split("-")[1])
        except (IndexError, ValueError):
            last_num = 1000
        return f"BILL-{last_num + 1}"
    return "BILL-1001"


def _calc_totals(items: list[BillItemCreate], apply_gst: bool):
    subtotal = sum(round(i.quantity * i.unit_price, 2) for i in items)
    gst_rate = 0.05 if apply_gst else 0.0
    gst_amount = round(subtotal * gst_rate, 2)
    total = round(subtotal + gst_amount, 2)
    return subtotal, gst_rate, gst_amount, total


def _serialize_bill(bill: Bill, include_details: bool = False) -> dict:
    data = {
        "id": bill.id,
        "bill_number": bill.bill_number,
        "vendor_id": bill.vendor_id,
        "vendor_name": bill.vendor.name if bill.vendor else None,
        "bill_date": bill.bill_date.isoformat() if bill.bill_date else None,
        "due_date": bill.due_date.isoformat() if bill.due_date else None,
        "status": bill.status,
        "subtotal": bill.subtotal,
        "gst_rate": bill.gst_rate,
        "gst_amount": bill.gst_amount,
        "total": bill.total,
        "amount_paid": bill.amount_paid,
        "balance_due": round(bill.total - bill.amount_paid, 2),
        "expense_account_id": bill.expense_account_id,
        "notes": bill.notes,
        "created_at": bill.created_at.isoformat() if bill.created_at else None,
    }
    if include_details:
        data["items"] = [
            {
                "id": item.id,
                "description": item.description,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "amount": item.amount,
                "account_id": item.account_id,
            }
            for item in (bill.items or [])
        ]
        data["payments"] = [
            {
                "id": p.id,
                "payment_date": p.payment_date.isoformat() if p.payment_date else None,
                "amount": p.amount,
                "payment_method": p.payment_method,
                "reference": p.reference,
                "notes": p.notes,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in (bill.payments or [])
        ]
        if bill.vendor:
            data["vendor"] = {
                "id": bill.vendor.id,
                "name": bill.vendor.name,
                "email": bill.vendor.email,
                "phone": bill.vendor.phone,
                "address_line1": bill.vendor.address_line1,
                "address_line2": bill.vendor.address_line2,
                "city": bill.vendor.city,
                "province": bill.vendor.province,
                "postal_code": bill.vendor.postal_code,
            }
    return data


# ── Endpoints ──

@router.post("/")
async def create_bill(data: BillCreate, db: Session = Depends(get_db)):
    # Verify vendor exists
    vendor = db.query(Customer).filter(Customer.id == data.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=400, detail="Vendor not found")

    # Verify expense account if provided
    if data.expense_account_id:
        acct = db.query(Account).filter(Account.id == data.expense_account_id).first()
        if not acct:
            raise HTTPException(status_code=400, detail="Expense account not found")

    # Verify item-level accounts if provided
    for item_data in data.items:
        if item_data.account_id:
            acct = db.query(Account).filter(Account.id == item_data.account_id).first()
            if not acct:
                raise HTTPException(status_code=400, detail=f"Account {item_data.account_id} not found")

    subtotal, gst_rate, gst_amount, total = _calc_totals(data.items, data.apply_gst)

    bill = Bill(
        bill_number=_next_bill_number(db),
        vendor_id=data.vendor_id,
        bill_date=data.bill_date,
        due_date=data.due_date,
        status="draft",
        subtotal=subtotal,
        gst_rate=gst_rate,
        gst_amount=gst_amount,
        total=total,
        amount_paid=0.0,
        expense_account_id=data.expense_account_id,
        notes=data.notes,
    )
    db.add(bill)
    db.flush()  # get bill.id for items

    for item_data in data.items:
        item = BillItem(
            bill_id=bill.id,
            description=item_data.description,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            amount=round(item_data.quantity * item_data.unit_price, 2),
            account_id=item_data.account_id,
        )
        db.add(item)

    db.commit()
    db.refresh(bill)
    return {"id": bill.id, "bill_number": bill.bill_number, "message": "Bill created"}


@router.get("/")
async def list_bills(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    vendor_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Bill).options(joinedload(Bill.vendor))

    if status:
        if status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status filter")
        query = query.filter(Bill.status == status)
    if vendor_id:
        query = query.filter(Bill.vendor_id == vendor_id)

    total = query.count()
    bills = query.order_by(Bill.created_at.desc()).offset(skip).limit(min(limit, 100)).all()

    return {
        "total": total,
        "bills": [_serialize_bill(b) for b in bills],
    }


@router.get("/{bill_id}")
async def get_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = (
        db.query(Bill)
        .options(joinedload(Bill.vendor), joinedload(Bill.items), joinedload(Bill.payments))
        .filter(Bill.id == bill_id)
        .first()
    )
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return _serialize_bill(bill, include_details=True)


@router.patch("/{bill_id}")
async def update_bill(bill_id: int, data: BillUpdate, db: Session = Depends(get_db)):
    bill = (
        db.query(Bill)
        .options(joinedload(Bill.items))
        .filter(Bill.id == bill_id)
        .first()
    )
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    if bill.status not in ("draft", "received"):
        raise HTTPException(status_code=400, detail="Only draft or received bills can be edited")

    if data.vendor_id is not None:
        vendor = db.query(Customer).filter(Customer.id == data.vendor_id).first()
        if not vendor:
            raise HTTPException(status_code=400, detail="Vendor not found")
        bill.vendor_id = data.vendor_id

    if data.expense_account_id is not None:
        if data.expense_account_id != 0:
            acct = db.query(Account).filter(Account.id == data.expense_account_id).first()
            if not acct:
                raise HTTPException(status_code=400, detail="Expense account not found")
            bill.expense_account_id = data.expense_account_id
        else:
            bill.expense_account_id = None

    if data.bill_date is not None:
        bill.bill_date = data.bill_date
    if data.due_date is not None:
        bill.due_date = data.due_date
    if data.notes is not None:
        bill.notes = data.notes

    # Recalculate if items or GST changed
    apply_gst = data.apply_gst if data.apply_gst is not None else (bill.gst_rate > 0)

    if data.items is not None:
        # Verify item-level accounts
        for item_data in data.items:
            if item_data.account_id:
                acct = db.query(Account).filter(Account.id == item_data.account_id).first()
                if not acct:
                    raise HTTPException(status_code=400, detail=f"Account {item_data.account_id} not found")

        # Replace all items
        for old_item in bill.items:
            db.delete(old_item)
        db.flush()

        for item_data in data.items:
            item = BillItem(
                bill_id=bill.id,
                description=item_data.description,
                quantity=item_data.quantity,
                unit_price=item_data.unit_price,
                amount=round(item_data.quantity * item_data.unit_price, 2),
                account_id=item_data.account_id,
            )
            db.add(item)

        subtotal, gst_rate, gst_amount, total = _calc_totals(data.items, apply_gst)
        bill.subtotal = subtotal
        bill.gst_rate = gst_rate
        bill.gst_amount = gst_amount
        bill.total = total
    elif data.apply_gst is not None:
        # Only GST toggle changed, recalculate with existing items
        existing_items = [
            BillItemCreate(description=i.description, quantity=i.quantity, unit_price=i.unit_price, account_id=i.account_id)
            for i in bill.items
        ]
        subtotal, gst_rate, gst_amount, total = _calc_totals(existing_items, apply_gst)
        bill.subtotal = subtotal
        bill.gst_rate = gst_rate
        bill.gst_amount = gst_amount
        bill.total = total

    db.commit()
    return {"message": "Bill updated"}


@router.patch("/{bill_id}/status")
async def update_bill_status(bill_id: int, data: StatusUpdate, db: Session = Depends(get_db)):
    bill = (
        db.query(Bill)
        .options(joinedload(Bill.items))
        .filter(Bill.id == bill_id)
        .first()
    )
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    old_status = bill.status
    bill.status = data.status

    # Auto-create journal entry when bill becomes "received"
    if data.status == "received" and old_status == "draft":
        create_je_for_bill_received(db, bill)

    db.commit()
    return {"message": f"Bill marked as {data.status}"}


@router.delete("/{bill_id}")
async def delete_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    if bill.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft bills can be deleted")

    db.delete(bill)
    db.commit()
    return {"message": "Bill deleted"}


@router.post("/{bill_id}/payments")
async def record_bill_payment(bill_id: int, data: BillPaymentCreate, db: Session = Depends(get_db)):
    bill = (
        db.query(Bill)
        .options(joinedload(Bill.items))
        .filter(Bill.id == bill_id)
        .first()
    )
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    if bill.status not in ("received", "overdue"):
        raise HTTPException(status_code=400, detail="Payments can only be recorded for received or overdue bills")

    balance_due = round(bill.total - bill.amount_paid, 2)
    if data.amount > balance_due:
        raise HTTPException(status_code=400, detail=f"Payment amount ({data.amount}) exceeds balance due ({balance_due})")

    payment = BillPayment(
        bill_id=bill.id,
        payment_date=data.payment_date,
        amount=round(data.amount, 2),
        payment_method=data.payment_method,
        reference=data.reference,
        notes=data.notes,
    )
    db.add(payment)
    db.flush()

    # Update bill amount_paid and status
    bill.amount_paid = round(bill.amount_paid + payment.amount, 2)
    if bill.amount_paid >= bill.total:
        bill.status = "paid"

    # Create journal entry: Dr. AP → Cr. Bank
    create_je_for_bill_payment(db, bill, payment)

    db.commit()
    db.refresh(payment)
    return {
        "id": payment.id,
        "amount": payment.amount,
        "bill_status": bill.status,
        "amount_paid": bill.amount_paid,
        "balance_due": round(bill.total - bill.amount_paid, 2),
        "message": "Payment recorded",
    }
