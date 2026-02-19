"""Bank Account and Bank Transaction models."""
from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Date, ForeignKey, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db import Base


class BankAccount(Base):
    """Model for bank accounts used in reconciliation."""

    __tablename__ = "bank_accounts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)  # e.g. "TD Business Chequing"
    institution = Column(String(100))  # e.g. "TD", "RBC", "Scotiabank"
    account_number_last4 = Column(String(4))  # Last 4 digits only
    account_type = Column(String(50), default="chequing")  # chequing, savings, credit_card
    currency = Column(String(3), default="CAD")

    # Link to Chart of Accounts
    gl_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)

    opening_balance = Column(Float, default=0.0)
    current_balance = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    gl_account = relationship("Account", foreign_keys=[gl_account_id])
    transactions = relationship("BankTransaction", back_populates="bank_account", cascade="all, delete-orphan")


class BankTransaction(Base):
    """Model for imported bank transactions."""

    __tablename__ = "bank_transactions"

    id = Column(Integer, primary_key=True, index=True)
    bank_account_id = Column(Integer, ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=False)

    transaction_date = Column(Date, nullable=False)
    description = Column(String(500), nullable=False)
    amount = Column(Float, nullable=False)  # Positive = deposit, negative = withdrawal
    balance = Column(Float, nullable=True)  # Running balance from bank statement
    reference = Column(String(200))  # Cheque number, reference from bank

    # Categorization
    category = Column(String(100))  # Auto-suggested or user-assigned

    # Reconciliation
    is_reconciled = Column(Boolean, default=False)
    journal_entry_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=True)

    # Dedup
    import_hash = Column(String(64), index=True)  # SHA256 of date+desc+amount for dedup

    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    bank_account = relationship("BankAccount", back_populates="transactions")
    journal_entry = relationship("JournalEntry", foreign_keys=[journal_entry_id])
