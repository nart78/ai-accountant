"""Invoice and InvoiceItem models."""
from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Date, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db import Base


class Invoice(Base):
    """Model for invoices."""

    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, nullable=False, index=True)

    # Customer
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)

    # Dates
    invoice_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    paid_date = Column(Date)

    # Status: draft, sent, paid, overdue
    status = Column(String(20), default="draft", nullable=False)

    # Financials
    subtotal = Column(Float, default=0.0, nullable=False)
    gst_rate = Column(Float, default=0.0)  # 0.0 or 0.05
    gst_amount = Column(Float, default=0.0)
    total = Column(Float, default=0.0, nullable=False)

    # Notes
    notes = Column(Text)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    customer = relationship("Customer", back_populates="invoices")
    items = relationship(
        "InvoiceItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="InvoiceItem.id",
    )

    def __repr__(self):
        return f"<Invoice(id={self.id}, number={self.invoice_number}, status={self.status})>"


class InvoiceItem(Base):
    """Model for invoice line items."""

    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)

    description = Column(String(500), nullable=False)
    quantity = Column(Float, nullable=False, default=1.0)
    unit_price = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)  # quantity * unit_price

    # Relationship
    invoice = relationship("Invoice", back_populates="items")

    def __repr__(self):
        return f"<InvoiceItem(id={self.id}, description={self.description}, amount={self.amount})>"
