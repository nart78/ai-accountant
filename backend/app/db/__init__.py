"""Database configuration and session management."""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
from app.config import settings

# Create database engine
engine = create_engine(
    settings.database_url,
    echo=settings.database_echo,
    pool_pre_ping=True,
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db() -> Session:
    """
    Dependency function to get database session.
    Use with FastAPI dependency injection.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables and seed default data."""
    from app.models import (
        Document, Transaction, Customer, Invoice, InvoiceItem,
        Account, JournalEntry, JournalEntryLine,
        Bill, BillItem, BillPayment,
        BankAccount, BankTransaction,
        GSTFilingPeriod,
    )
    Base.metadata.create_all(bind=engine)

    # Seed chart of accounts on first boot
    from app.services.coa_seed import seed_chart_of_accounts
    db = SessionLocal()
    try:
        created = seed_chart_of_accounts(db)
        if created > 0:
            print(f"  📊 Seeded {created} default accounts in Chart of Accounts")
    finally:
        db.close()
