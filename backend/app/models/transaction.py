"""
Transaction model for accounting entries.
"""
from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Boolean
from sqlalchemy.sql import func
from app.db import Base


class Transaction(Base):
    """Model for accounting transactions (double-entry bookkeeping)."""

    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)

    # Transaction Details
    transaction_date = Column(DateTime, nullable=False)
    description = Column(Text, nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="CAD")

    # Categorization
    category = Column(String(100), nullable=False)  # expense, revenue, asset, liability
    subcategory = Column(String(100))  # office_supplies, meals, consulting_revenue, etc.
    account_code = Column(String(50))  # Chart of accounts code

    # Tax Information
    tax_amount = Column(Float, default=0.0)
    tax_rate = Column(Float)  # GST/HST rate
    tax_type = Column(String(50))  # GST, HST, PST, none
    tax_deductible = Column(Boolean, default=True)

    # Vendor/Customer
    counterparty_name = Column(String(255))  # Vendor or customer name
    counterparty_type = Column(String(50))  # vendor, customer, employee

    # Double-Entry Bookkeeping
    debit_account = Column(String(100))
    credit_account = Column(String(100))

    # Payment Information
    payment_method = Column(String(50))  # cash, credit_card, bank_transfer, etc.
    payment_status = Column(String(50), default="completed")  # pending, completed, cancelled

    # Linkage
    document_id = Column(Integer, nullable=True)  # Link back to Document
    external_id = Column(String(100))  # ID from Wave/QuickBooks
    synced = Column(Boolean, default=False)

    # Audit Trail
    created_by = Column(String(100), default="ai_system")
    reviewed_by = Column(String(100))
    review_status = Column(String(50), default="auto_approved")  # auto_approved, pending_review, approved

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Transaction(id={self.id}, date={self.transaction_date}, amount={self.amount}, category={self.category})>"
