"""Default Chart of Accounts seed data for Canadian small businesses."""
from sqlalchemy.orm import Session
from app.models.account import Account

# (code, name, account_type, sub_type, tax_code, normal_balance)
DEFAULT_ACCOUNTS = [
    # ── ASSETS (1000s) ──
    ("1000", "Cash", "asset", "current_asset", None, "debit"),
    ("1050", "Business Bank Account", "asset", "current_asset", None, "debit"),
    ("1100", "Accounts Receivable", "asset", "current_asset", None, "debit"),
    ("1200", "Prepaid Expenses", "asset", "current_asset", None, "debit"),
    ("1300", "GST/HST Receivable", "asset", "current_asset", None, "debit"),
    ("1500", "Computer Equipment", "asset", "fixed_asset", None, "debit"),
    ("1510", "Office Equipment", "asset", "fixed_asset", None, "debit"),
    ("1520", "Accum. Depreciation - Equipment", "asset", "fixed_asset", None, "credit"),
    ("1600", "Vehicles", "asset", "fixed_asset", None, "debit"),
    ("1610", "Accum. Depreciation - Vehicles", "asset", "fixed_asset", None, "credit"),

    # ── LIABILITIES (2000s) ──
    ("2000", "Accounts Payable", "liability", "current_liability", None, "credit"),
    ("2100", "GST/HST Payable", "liability", "current_liability", None, "credit"),
    ("2200", "Income Tax Payable", "liability", "current_liability", None, "credit"),
    ("2300", "Credit Card Payable", "liability", "current_liability", None, "credit"),

    # ── EQUITY (3000s) ──
    ("3000", "Owner's Equity", "equity", "equity", None, "credit"),
    ("3100", "Owner's Draws", "equity", "equity", None, "debit"),
    ("3200", "Retained Earnings", "equity", "equity", None, "credit"),

    # ── REVENUE (4000s) ──
    ("4000", "Service Revenue", "revenue", "revenue", None, "credit"),
    ("4100", "Product Sales", "revenue", "revenue", None, "credit"),
    ("4200", "Other Income", "revenue", "revenue", None, "credit"),

    # ── EXPENSES (5000s) — mapped to T2125 lines ──
    ("5000", "Advertising & Marketing", "expense", "expense", "8521", "debit"),
    ("5050", "Bad Debts", "expense", "expense", "8590", "debit"),
    ("5100", "Bank Fees & Interest", "expense", "expense", "8710", "debit"),
    ("5150", "Insurance", "expense", "expense", "8690", "debit"),
    ("5200", "Meals & Entertainment", "expense", "expense", "8523", "debit"),
    ("5250", "Office Supplies", "expense", "expense", "8810", "debit"),
    ("5300", "Professional Fees", "expense", "expense", "8860", "debit"),
    ("5350", "Rent", "expense", "expense", "8910", "debit"),
    ("5400", "Repairs & Maintenance", "expense", "expense", "8960", "debit"),
    ("5450", "Software & Subscriptions", "expense", "expense", "8810", "debit"),
    ("5500", "Telephone & Internet", "expense", "expense", "8220", "debit"),
    ("5550", "Travel", "expense", "expense", "9200", "debit"),
    ("5600", "Utilities", "expense", "expense", "9220", "debit"),
    ("5650", "Vehicle Expenses", "expense", "expense", "9281", "debit"),
    ("5700", "Contractor Payments", "expense", "expense", "8810", "debit"),
    ("5750", "Employee Wages", "expense", "expense", "9060", "debit"),
    ("5800", "Shipping", "expense", "expense", "8810", "debit"),
    ("5850", "Taxes & Licenses", "expense", "expense", "8760", "debit"),
    ("5900", "Depreciation", "expense", "expense", "9936", "debit"),
    ("5950", "Other Expenses", "expense", "expense", "9270", "debit"),
    ("5960", "Business-Use-of-Home", "expense", "expense", "9945", "debit"),

    # ── COST OF GOODS SOLD (6000s) ──
    ("6000", "Cost of Goods Sold", "expense", "cogs", None, "debit"),
    ("6100", "Inventory Purchases", "expense", "cogs", None, "debit"),
]


def seed_chart_of_accounts(db: Session) -> int:
    """Seed the default chart of accounts. Idempotent — skips existing accounts.
    Returns the number of accounts created."""
    existing_codes = {a.code for a in db.query(Account.code).all()}
    created = 0

    for code, name, acct_type, sub_type, tax_code, normal_balance in DEFAULT_ACCOUNTS:
        if code in existing_codes:
            continue
        account = Account(
            code=code,
            name=name,
            account_type=acct_type,
            sub_type=sub_type,
            tax_code=tax_code,
            normal_balance=normal_balance,
            is_system=True,
            is_active=True,
        )
        db.add(account)
        created += 1

    if created > 0:
        db.commit()

    return created
