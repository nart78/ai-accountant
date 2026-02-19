"""Journal Entry and Journal Entry Line models for double-entry bookkeeping."""
from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Date, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db import Base


class JournalEntry(Base):
    """Model for journal entries (double-entry bookkeeping header)."""

    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    entry_date = Column(Date, nullable=False)
    description = Column(Text, nullable=False)
    reference = Column(String(100))  # "INV-1001", "TXN-42", etc.
    entry_type = Column(String(30), nullable=False)  # auto_expense, auto_invoice, auto_payment, manual, adjustment

    # Linkage to source records
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=True)

    is_posted = Column(Boolean, default=True)
    notes = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    lines = relationship(
        "JournalEntryLine",
        back_populates="journal_entry",
        cascade="all, delete-orphan",
        order_by="JournalEntryLine.id",
    )

    def __repr__(self):
        return f"<JournalEntry(id={self.id}, date={self.entry_date}, type={self.entry_type})>"


class JournalEntryLine(Base):
    """Model for journal entry line items (individual debits/credits)."""

    __tablename__ = "journal_entry_lines"

    id = Column(Integer, primary_key=True, index=True)
    journal_entry_id = Column(Integer, ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    description = Column(String(500))
    debit = Column(Float, default=0.0)
    credit = Column(Float, default=0.0)

    # Relationships
    journal_entry = relationship("JournalEntry", back_populates="lines")
    account = relationship("Account", back_populates="journal_lines")

    def __repr__(self):
        return f"<JournalEntryLine(account={self.account_id}, debit={self.debit}, credit={self.credit})>"
