"""
Document model for storing uploaded financial documents.
"""
from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Boolean, JSON
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class Document(Base):
    """Model for financial documents (receipts, invoices, statements)."""

    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, image, csv, etc.
    file_size = Column(Integer, nullable=False)  # bytes

    # AI Processing Results
    document_type = Column(String(100))  # receipt, invoice, bank_statement, etc.
    category = Column(String(100))  # office_supplies, meals, travel, etc.
    vendor_name = Column(String(255))
    amount = Column(Float)
    currency = Column(String(10), default="CAD")
    transaction_date = Column(DateTime)
    tax_amount = Column(Float)  # GST/HST amount
    tax_rate = Column(Float)  # Tax rate applied

    # Extracted data
    extracted_data = Column(JSON)  # Full AI extraction results
    confidence_score = Column(Float)  # AI confidence (0-1)

    # Status
    processing_status = Column(String(50), default="pending")  # pending, processed, error, review_needed
    reviewed = Column(Boolean, default=False)
    review_notes = Column(Text)

    # Accounting linkage
    transaction_id = Column(Integer, nullable=True)  # Link to Transaction table
    synced_to_accounting = Column(Boolean, default=False)
    accounting_id = Column(String(100))  # ID in Wave/QuickBooks

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    processed_at = Column(DateTime(timezone=True))

    def __repr__(self):
        return f"<Document(id={self.id}, type={self.document_type}, vendor={self.vendor_name}, amount={self.amount})>"
