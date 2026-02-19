"""GST/HST Filing Period model for tracking tax filing obligations."""
from sqlalchemy import Column, Integer, String, DateTime, Float, Date, Boolean, Text
from sqlalchemy.sql import func
from app.db import Base


class GSTFilingPeriod(Base):
    """Model for tracking GST/HST filing periods and submissions."""

    __tablename__ = "gst_filing_periods"

    id = Column(Integer, primary_key=True, index=True)

    # Period
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    filing_frequency = Column(String(20), default="quarterly")  # monthly, quarterly, annual

    # Calculated amounts
    gst_collected = Column(Float, default=0.0)  # Line 101 - Total GST/HST collected
    input_tax_credits = Column(Float, default=0.0)  # Line 106 - Total ITCs
    net_tax = Column(Float, default=0.0)  # Line 109 - Net tax (collected - ITCs)
    installment_payments = Column(Float, default=0.0)  # Line 110
    amount_owing = Column(Float, default=0.0)  # Line 113 - Amount owing or refund

    # Status tracking
    status = Column(String(20), default="draft")  # draft, calculated, filed
    filed_date = Column(Date, nullable=True)
    confirmation_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
