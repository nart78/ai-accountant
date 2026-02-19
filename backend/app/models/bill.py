"""Bill, BillItem, and BillPayment models for accounts payable."""
from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Date, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db import Base


class Bill(Base):
    """Model for vendor bills (accounts payable)."""

    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    bill_number = Column(String(50), unique=True, nullable=False, index=True)

    # Vendor (uses Customer model with contact_type vendor/both)
    vendor_id = Column(Integer, ForeignKey("customers.id"), nullable=False)

    # Dates
    bill_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)

    # Status: draft, received, paid, overdue
    status = Column(String(20), default="draft", nullable=False)

    # Financials
    subtotal = Column(Float, default=0.0, nullable=False)
    gst_rate = Column(Float, default=0.0)  # 0.0 or 0.05
    gst_amount = Column(Float, default=0.0)
    total = Column(Float, default=0.0, nullable=False)
    amount_paid = Column(Float, default=0.0, nullable=False)

    # Notes
    notes = Column(Text)

    # Default expense account for the whole bill (optional, item-level overrides)
    expense_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    vendor = relationship("Customer", back_populates="bills")
    expense_account = relationship("Account", foreign_keys=[expense_account_id])
    items = relationship(
        "BillItem",
        back_populates="bill",
        cascade="all, delete-orphan",
        order_by="BillItem.id",
    )
    payments = relationship(
        "BillPayment",
        back_populates="bill",
        cascade="all, delete-orphan",
        order_by="BillPayment.id",
    )

    def __repr__(self):
        return f"<Bill(id={self.id}, number={self.bill_number}, status={self.status})>"


class BillItem(Base):
    """Model for bill line items."""

    __tablename__ = "bill_items"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id", ondelete="CASCADE"), nullable=False)

    description = Column(String(500), nullable=False)
    quantity = Column(Float, nullable=False, default=1.0)
    unit_price = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)  # quantity * unit_price

    # Expense account for this line item (optional, overrides bill-level)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)

    # Relationships
    bill = relationship("Bill", back_populates="items")
    account = relationship("Account", foreign_keys=[account_id])

    def __repr__(self):
        return f"<BillItem(id={self.id}, description={self.description}, amount={self.amount})>"


class BillPayment(Base):
    """Model for bill payment records."""

    __tablename__ = "bill_payments"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id", ondelete="CASCADE"), nullable=False)

    payment_date = Column(Date, nullable=False)
    amount = Column(Float, nullable=False)
    payment_method = Column(String(50), default="bank_transfer")
    reference = Column(String(100))
    notes = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    bill = relationship("Bill", back_populates="payments")

    def __repr__(self):
        return f"<BillPayment(id={self.id}, bill_id={self.bill_id}, amount={self.amount})>"
