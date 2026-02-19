"""API endpoints for customer management."""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel, Field
import logging

from app.db import get_db
from app.models.customer import Customer
from app.models.invoice import Invoice

logger = logging.getLogger(__name__)
router = APIRouter()


class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    address_line1: Optional[str] = Field(None, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    province: Optional[str] = Field(None, max_length=50)
    postal_code: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = Field(None, max_length=2000)


class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    address_line1: Optional[str] = Field(None, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    province: Optional[str] = Field(None, max_length=50)
    postal_code: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = Field(None, max_length=2000)


def _serialize_customer(c: Customer) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "email": c.email,
        "phone": c.phone,
        "address_line1": c.address_line1,
        "address_line2": c.address_line2,
        "city": c.city,
        "province": c.province,
        "postal_code": c.postal_code,
        "notes": c.notes,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.post("/")
async def create_customer(data: CustomerCreate, db: Session = Depends(get_db)):
    customer = Customer(
        name=data.name,
        email=data.email,
        phone=data.phone,
        address_line1=data.address_line1,
        address_line2=data.address_line2,
        city=data.city,
        province=data.province,
        postal_code=data.postal_code,
        notes=data.notes,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return {"id": customer.id, "message": "Customer created", "customer": _serialize_customer(customer)}


@router.get("/")
async def list_customers(
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(Customer)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            Customer.name.ilike(pattern) | Customer.email.ilike(pattern)
        )
    customers = query.order_by(Customer.name).offset(skip).limit(min(limit, 200)).all()
    return {
        "total": query.count(),
        "customers": [_serialize_customer(c) for c in customers],
    }


@router.get("/{customer_id}")
async def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return _serialize_customer(customer)


@router.patch("/{customer_id}")
async def update_customer(customer_id: int, data: CustomerUpdate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(customer, field, value)

    db.commit()
    return {"message": "Customer updated", "customer": _serialize_customer(customer)}


@router.delete("/{customer_id}")
async def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    invoice_count = db.query(Invoice).filter(Invoice.customer_id == customer_id).count()
    if invoice_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete customer with {invoice_count} invoice(s). Delete the invoices first.",
        )

    db.delete(customer)
    db.commit()
    return {"message": "Customer deleted"}
