"""Customer model for invoicing and vendor management."""
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db import Base


class Customer(Base):
    """Model for customers and vendors used in invoicing and bills."""

    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(50))
    address_line1 = Column(String(255))
    address_line2 = Column(String(255))
    city = Column(String(100))
    province = Column(String(50))
    postal_code = Column(String(20))
    notes = Column(Text)

    # Contact type: customer, vendor, or both
    contact_type = Column(String(20), default="customer", nullable=False)

    # Default expense account for vendor bills
    default_expense_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    invoices = relationship("Invoice", back_populates="customer")
    bills = relationship("Bill", back_populates="vendor")
    default_expense_account = relationship("Account", foreign_keys=[default_expense_account_id])

    def __repr__(self):
        return f"<Customer(id={self.id}, name={self.name}, type={self.contact_type})>"
