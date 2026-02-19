"""Chart of Accounts model."""
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db import Base


class Account(Base):
    """Model for chart of accounts."""

    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    account_type = Column(String(20), nullable=False)  # asset, liability, equity, revenue, expense
    sub_type = Column(String(50))  # current_asset, fixed_asset, current_liability, etc.
    description = Column(Text)
    parent_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    is_system = Column(Boolean, default=False)  # Cannot be deleted if True
    tax_code = Column(String(20))  # T2125 line mapping: "8521", "8690", etc.
    normal_balance = Column(String(10))  # "debit" or "credit"

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    parent = relationship("Account", remote_side=[id])
    journal_lines = relationship("JournalEntryLine", back_populates="account")

    def __repr__(self):
        return f"<Account(code={self.code}, name={self.name}, type={self.account_type})>"
