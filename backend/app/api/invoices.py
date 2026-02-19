"""API endpoints for invoice management."""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from datetime import date
from pydantic import BaseModel, Field, field_validator
import logging

from app.db import get_db
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceItem
from app.services.pdf_generator import generate_invoice_pdf

logger = logging.getLogger(__name__)
router = APIRouter()

VALID_STATUSES = {"draft", "sent", "paid", "overdue"}


# ── Schemas ──

class InvoiceItemCreate(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)
    quantity: float = Field(..., gt=0, lt=1_000_000)
    unit_price: float = Field(..., gt=0, lt=1_000_000_000)


class InvoiceCreate(BaseModel):
    customer_id: int
    invoice_date: date
    due_date: date
    apply_gst: bool = False
    notes: Optional[str] = Field(None, max_length=2000)
    items: list[InvoiceItemCreate] = Field(..., min_length=1)

    @field_validator("due_date")
    @classmethod
    def due_date_not_before_invoice(cls, v, info):
        inv_date = info.data.get("invoice_date")
        if inv_date and v < inv_date:
            raise ValueError("Due date cannot be before invoice date")
        return v


class InvoiceUpdate(BaseModel):
    customer_id: Optional[int] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    apply_gst: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=2000)
    items: Optional[list[InvoiceItemCreate]] = None


class StatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v not in VALID_STATUSES:
            raise ValueError(f"Invalid status. Allowed: {', '.join(VALID_STATUSES)}")
        return v


# ── Helpers ──

def _next_invoice_number(db: Session) -> str:
    last = db.query(Invoice).order_by(Invoice.id.desc()).first()
    if last:
        try:
            last_num = int(last.invoice_number.split("-")[1])
        except (IndexError, ValueError):
            last_num = 1000
        return f"INV-{last_num + 1}"
    return "INV-1001"


def _calc_totals(items: list[InvoiceItemCreate], apply_gst: bool):
    subtotal = sum(round(i.quantity * i.unit_price, 2) for i in items)
    gst_rate = 0.05 if apply_gst else 0.0
    gst_amount = round(subtotal * gst_rate, 2)
    total = round(subtotal + gst_amount, 2)
    return subtotal, gst_rate, gst_amount, total


def _serialize_invoice(inv: Invoice, include_items: bool = False) -> dict:
    data = {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "customer_id": inv.customer_id,
        "customer_name": inv.customer.name if inv.customer else None,
        "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
        "due_date": inv.due_date.isoformat() if inv.due_date else None,
        "paid_date": inv.paid_date.isoformat() if inv.paid_date else None,
        "status": inv.status,
        "subtotal": inv.subtotal,
        "gst_rate": inv.gst_rate,
        "gst_amount": inv.gst_amount,
        "total": inv.total,
        "notes": inv.notes,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
    }
    if include_items:
        data["items"] = [
            {
                "id": item.id,
                "description": item.description,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "amount": item.amount,
            }
            for item in (inv.items or [])
        ]
        if inv.customer:
            data["customer"] = {
                "id": inv.customer.id,
                "name": inv.customer.name,
                "email": inv.customer.email,
                "phone": inv.customer.phone,
                "address_line1": inv.customer.address_line1,
                "address_line2": inv.customer.address_line2,
                "city": inv.customer.city,
                "province": inv.customer.province,
                "postal_code": inv.customer.postal_code,
            }
    return data


# ── Endpoints ──

@router.post("/")
async def create_invoice(data: InvoiceCreate, db: Session = Depends(get_db)):
    # Verify customer exists
    customer = db.query(Customer).filter(Customer.id == data.customer_id).first()
    if not customer:
        raise HTTPException(status_code=400, detail="Customer not found")

    subtotal, gst_rate, gst_amount, total = _calc_totals(data.items, data.apply_gst)

    invoice = Invoice(
        invoice_number=_next_invoice_number(db),
        customer_id=data.customer_id,
        invoice_date=data.invoice_date,
        due_date=data.due_date,
        status="draft",
        subtotal=subtotal,
        gst_rate=gst_rate,
        gst_amount=gst_amount,
        total=total,
        notes=data.notes,
    )
    db.add(invoice)
    db.flush()  # get invoice.id for items

    for item_data in data.items:
        item = InvoiceItem(
            invoice_id=invoice.id,
            description=item_data.description,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            amount=round(item_data.quantity * item_data.unit_price, 2),
        )
        db.add(item)

    db.commit()
    db.refresh(invoice)
    return {"id": invoice.id, "invoice_number": invoice.invoice_number, "message": "Invoice created"}


@router.get("/")
async def list_invoices(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Invoice).options(joinedload(Invoice.customer))

    if status:
        if status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status filter")
        query = query.filter(Invoice.status == status)
    if customer_id:
        query = query.filter(Invoice.customer_id == customer_id)

    total = query.count()
    invoices = query.order_by(Invoice.created_at.desc()).offset(skip).limit(min(limit, 100)).all()

    return {
        "total": total,
        "invoices": [_serialize_invoice(inv) for inv in invoices],
    }


@router.get("/{invoice_id}")
async def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.customer), joinedload(Invoice.items))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return _serialize_invoice(invoice, include_items=True)


@router.patch("/{invoice_id}")
async def update_invoice(invoice_id: int, data: InvoiceUpdate, db: Session = Depends(get_db)):
    invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.items))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft invoices can be edited")

    if data.customer_id is not None:
        customer = db.query(Customer).filter(Customer.id == data.customer_id).first()
        if not customer:
            raise HTTPException(status_code=400, detail="Customer not found")
        invoice.customer_id = data.customer_id

    if data.invoice_date is not None:
        invoice.invoice_date = data.invoice_date
    if data.due_date is not None:
        invoice.due_date = data.due_date
    if data.notes is not None:
        invoice.notes = data.notes

    # Recalculate if items or GST changed
    apply_gst = data.apply_gst if data.apply_gst is not None else (invoice.gst_rate > 0)

    if data.items is not None:
        # Replace all items
        for old_item in invoice.items:
            db.delete(old_item)
        db.flush()

        for item_data in data.items:
            item = InvoiceItem(
                invoice_id=invoice.id,
                description=item_data.description,
                quantity=item_data.quantity,
                unit_price=item_data.unit_price,
                amount=round(item_data.quantity * item_data.unit_price, 2),
            )
            db.add(item)

        subtotal, gst_rate, gst_amount, total = _calc_totals(data.items, apply_gst)
        invoice.subtotal = subtotal
        invoice.gst_rate = gst_rate
        invoice.gst_amount = gst_amount
        invoice.total = total
    elif data.apply_gst is not None:
        # Only GST toggle changed, recalculate with existing items
        existing_items = [
            InvoiceItemCreate(description=i.description, quantity=i.quantity, unit_price=i.unit_price)
            for i in invoice.items
        ]
        subtotal, gst_rate, gst_amount, total = _calc_totals(existing_items, apply_gst)
        invoice.subtotal = subtotal
        invoice.gst_rate = gst_rate
        invoice.gst_amount = gst_amount
        invoice.total = total

    db.commit()
    return {"message": "Invoice updated"}


@router.patch("/{invoice_id}/status")
async def update_invoice_status(invoice_id: int, data: StatusUpdate, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice.status = data.status
    if data.status == "paid" and not invoice.paid_date:
        invoice.paid_date = date.today()
    elif data.status != "paid":
        invoice.paid_date = None

    db.commit()
    return {"message": f"Invoice marked as {data.status}"}


@router.delete("/{invoice_id}")
async def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft invoices can be deleted")

    db.delete(invoice)
    db.commit()
    return {"message": "Invoice deleted"}


@router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(invoice_id: int, db: Session = Depends(get_db)):
    invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.customer), joinedload(Invoice.items))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    try:
        pdf_buffer = generate_invoice_pdf(invoice)
    except Exception as e:
        logger.error("PDF generation failed for invoice %d: %s", invoice_id, e)
        raise HTTPException(status_code=500, detail="Failed to generate PDF")

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{invoice.invoice_number}.pdf"'
        },
    )
