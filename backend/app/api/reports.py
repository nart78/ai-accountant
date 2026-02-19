"""
API endpoints for financial reports and analytics.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import datetime, date
from typing import Optional
from collections import defaultdict

from app.db import get_db
from app.models.transaction import Transaction
from app.models.document import Document
from app.models.account import Account
from app.models.journal_entry import JournalEntry, JournalEntryLine
from app.models.invoice import Invoice

router = APIRouter()


@router.get("/profit-loss")
async def profit_and_loss(
    start_date: date = Query(..., description="Start date for the report"),
    end_date: date = Query(..., description="End date for the report"),
    db: Session = Depends(get_db)
):
    """
    Generate Profit & Loss (Income Statement) report.
    Shows revenue, expenses, and net income for a period.
    """
    # Query transactions within date range
    transactions = db.query(Transaction).filter(
        Transaction.transaction_date >= datetime.combine(start_date, datetime.min.time()),
        Transaction.transaction_date <= datetime.combine(end_date, datetime.max.time())
    ).all()

    # Categorize transactions
    revenue = 0.0
    expenses_by_category = defaultdict(float)
    total_expenses = 0.0
    total_tax_paid = 0.0

    for t in transactions:
        if t.category == "revenue":
            revenue += t.amount
        elif t.category == "expense":
            expenses_by_category[t.subcategory or "Other"] += t.amount
            total_expenses += t.amount
            if t.tax_amount:
                total_tax_paid += t.tax_amount

    net_income = revenue - total_expenses

    return {
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
        },
        "revenue": {
            "total": round(revenue, 2),
        },
        "expenses": {
            "by_category": {k: round(v, 2) for k, v in expenses_by_category.items()},
            "total": round(total_expenses, 2),
        },
        "taxes": {
            "total_tax_paid": round(total_tax_paid, 2),
        },
        "net_income": round(net_income, 2),
        "profit_margin": round((net_income / revenue * 100) if revenue > 0 else 0, 2),
    }


@router.get("/expenses-by-category")
async def expenses_by_category(
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db)
):
    """Get expenses broken down by category for a date range."""
    result = db.query(
        Transaction.subcategory,
        func.sum(Transaction.amount).label("total"),
        func.count(Transaction.id).label("count")
    ).filter(
        Transaction.category == "expense",
        Transaction.transaction_date >= datetime.combine(start_date, datetime.min.time()),
        Transaction.transaction_date <= datetime.combine(end_date, datetime.max.time())
    ).group_by(Transaction.subcategory).all()

    categories = [
        {
            "category": r.subcategory or "Uncategorized",
            "total": round(r.total, 2),
            "count": r.count,
        }
        for r in result
    ]

    total = sum(c["total"] for c in categories)

    # Add percentage
    for c in categories:
        c["percentage"] = round((c["total"] / total * 100) if total > 0 else 0, 2)

    return {
        "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "categories": sorted(categories, key=lambda x: x["total"], reverse=True),
        "total": round(total, 2),
    }


@router.get("/tax-summary")
async def tax_summary(
    year: int = Query(..., description="Tax year"),
    db: Session = Depends(get_db)
):
    """
    Generate tax summary for Canadian tax filing.
    Shows GST/HST collected and paid, income, deductible expenses.
    """
    start_date = datetime(year, 1, 1)
    end_date = datetime(year, 12, 31, 23, 59, 59)

    transactions = db.query(Transaction).filter(
        Transaction.transaction_date >= start_date,
        Transaction.transaction_date <= end_date
    ).all()

    # Calculate tax figures
    gst_hst_collected = 0.0  # On sales
    gst_hst_paid = 0.0  # On purchases
    total_revenue = 0.0
    total_deductible_expenses = 0.0
    total_non_deductible = 0.0

    for t in transactions:
        if t.category == "revenue":
            total_revenue += t.amount
            if t.tax_amount:
                gst_hst_collected += t.tax_amount
        elif t.category == "expense":
            if t.tax_deductible:
                total_deductible_expenses += t.amount
            else:
                total_non_deductible += t.amount

            if t.tax_amount:
                gst_hst_paid += t.tax_amount

    net_gst_hst = gst_hst_collected - gst_hst_paid
    taxable_income = total_revenue - total_deductible_expenses

    return {
        "tax_year": year,
        "revenue": {
            "total": round(total_revenue, 2),
        },
        "expenses": {
            "deductible": round(total_deductible_expenses, 2),
            "non_deductible": round(total_non_deductible, 2),
            "total": round(total_deductible_expenses + total_non_deductible, 2),
        },
        "gst_hst": {
            "collected": round(gst_hst_collected, 2),
            "paid": round(gst_hst_paid, 2),
            "net_owing": round(net_gst_hst, 2),
            "note": "Positive means you owe CRA, negative means you get a refund"
        },
        "taxable_income": round(taxable_income, 2),
    }


@router.get("/monthly-summary")
async def monthly_summary(
    year: int = Query(...),
    db: Session = Depends(get_db)
):
    """Get monthly revenue and expenses summary for a year."""
    start_date = datetime(year, 1, 1)
    end_date = datetime(year, 12, 31, 23, 59, 59)

    # Get all transactions for the year
    transactions = db.query(Transaction).filter(
        Transaction.transaction_date >= start_date,
        Transaction.transaction_date <= end_date
    ).all()

    # Group by month
    monthly_data = defaultdict(lambda: {"revenue": 0.0, "expenses": 0.0})

    for t in transactions:
        month = t.transaction_date.month
        if t.category == "revenue":
            monthly_data[month]["revenue"] += t.amount
        elif t.category == "expense":
            monthly_data[month]["expenses"] += t.amount

    # Format response
    months = []
    for m in range(1, 13):
        data = monthly_data[m]
        net = data["revenue"] - data["expenses"]
        months.append({
            "month": m,
            "month_name": datetime(year, m, 1).strftime("%B"),
            "revenue": round(data["revenue"], 2),
            "expenses": round(data["expenses"], 2),
            "net_income": round(net, 2),
        })

    total_revenue = sum(m["revenue"] for m in months)
    total_expenses = sum(m["expenses"] for m in months)

    return {
        "year": year,
        "months": months,
        "totals": {
            "revenue": round(total_revenue, 2),
            "expenses": round(total_expenses, 2),
            "net_income": round(total_revenue - total_expenses, 2),
        }
    }


@router.get("/dashboard")
async def dashboard_stats(db: Session = Depends(get_db)):
    """
    Get key dashboard statistics and metrics.
    """
    # Get current month stats
    now = datetime.now()
    month_start = datetime(now.year, now.month, 1)

    # Total documents
    total_documents = db.query(func.count(Document.id)).scalar()
    pending_review = db.query(func.count(Document.id)).filter(
        Document.processing_status == "review_needed"
    ).scalar()

    # This month's transactions
    month_transactions = db.query(Transaction).filter(
        Transaction.transaction_date >= month_start
    ).all()

    month_revenue = sum(t.amount for t in month_transactions if t.category == "revenue")
    month_expenses = sum(t.amount for t in month_transactions if t.category == "expense")

    # Recent documents
    recent_docs = db.query(Document).order_by(
        Document.created_at.desc()
    ).limit(5).all()

    return {
        "documents": {
            "total": total_documents,
            "pending_review": pending_review,
        },
        "this_month": {
            "revenue": round(month_revenue, 2),
            "expenses": round(month_expenses, 2),
            "net_income": round(month_revenue - month_expenses, 2),
        },
        "recent_uploads": [
            {
                "id": doc.id,
                "filename": doc.original_filename,
                "type": doc.document_type,
                "amount": doc.amount,
                "status": doc.processing_status,
                "created_at": doc.created_at.isoformat(),
            }
            for doc in recent_docs
        ],
    }


# ── Phase 2: Financial Statements (from Journal Entries) ──

def _account_balance_at(db: Session, account_id: int, as_of: date, normal_balance: str) -> float:
    """Calculate an account's balance from journal entries up to a date."""
    result = db.query(
        func.coalesce(func.sum(JournalEntryLine.debit), 0).label("d"),
        func.coalesce(func.sum(JournalEntryLine.credit), 0).label("c"),
    ).join(JournalEntry).filter(
        JournalEntryLine.account_id == account_id,
        JournalEntry.is_posted == True,
        JournalEntry.entry_date <= as_of,
    ).first()
    d, c = result.d or 0, result.c or 0
    return (d - c) if normal_balance == "debit" else (c - d)


def _account_balance_range(db: Session, account_id: int, start: date, end: date, normal_balance: str) -> float:
    """Calculate an account's activity within a date range."""
    result = db.query(
        func.coalesce(func.sum(JournalEntryLine.debit), 0).label("d"),
        func.coalesce(func.sum(JournalEntryLine.credit), 0).label("c"),
    ).join(JournalEntry).filter(
        JournalEntryLine.account_id == account_id,
        JournalEntry.is_posted == True,
        JournalEntry.entry_date >= start,
        JournalEntry.entry_date <= end,
    ).first()
    d, c = result.d or 0, result.c or 0
    return (d - c) if normal_balance == "debit" else (c - d)


@router.get("/balance-sheet")
async def balance_sheet(
    as_of_date: date = Query(..., description="Balance sheet date"),
    db: Session = Depends(get_db),
):
    """Generate a balance sheet as of a given date.
    Assets = Liabilities + Equity (accounting equation)."""
    accounts = db.query(Account).filter(Account.is_active == True).order_by(Account.code).all()

    sections = {
        "asset": {"current_asset": [], "fixed_asset": [], "other": []},
        "liability": {"current_liability": [], "other": []},
        "equity": {"equity": []},
    }

    totals = {"asset": 0.0, "liability": 0.0, "equity": 0.0}

    for acct in accounts:
        if acct.account_type not in sections:
            continue
        balance = _account_balance_at(db, acct.id, as_of_date, acct.normal_balance or "debit")
        if abs(balance) < 0.01:
            continue

        sub = acct.sub_type if acct.sub_type in sections[acct.account_type] else "other"
        if sub not in sections[acct.account_type]:
            sub = list(sections[acct.account_type].keys())[-1]

        sections[acct.account_type][sub].append({
            "code": acct.code,
            "name": acct.name,
            "balance": round(balance, 2),
        })
        totals[acct.account_type] += balance

    # Include net income in equity (revenue - expenses for the period up to as_of_date)
    revenue_expense_accounts = [a for a in accounts if a.account_type in ("revenue", "expense")]
    net_income = 0.0
    for acct in revenue_expense_accounts:
        bal = _account_balance_at(db, acct.id, as_of_date, acct.normal_balance or "debit")
        if acct.account_type == "revenue":
            net_income += bal
        else:
            net_income -= bal

    if abs(net_income) >= 0.01:
        sections["equity"]["equity"].append({
            "code": "NET",
            "name": "Net Income (Current Period)",
            "balance": round(net_income, 2),
        })
        totals["equity"] += net_income

    return {
        "as_of_date": as_of_date.isoformat(),
        "assets": {k: v for k, v in sections["asset"].items() if v},
        "liabilities": {k: v for k, v in sections["liability"].items() if v},
        "equity": {k: v for k, v in sections["equity"].items() if v},
        "totals": {
            "total_assets": round(totals["asset"], 2),
            "total_liabilities": round(totals["liability"], 2),
            "total_equity": round(totals["equity"], 2),
            "total_liabilities_and_equity": round(totals["liability"] + totals["equity"], 2),
            "is_balanced": abs(totals["asset"] - (totals["liability"] + totals["equity"])) < 0.01,
        },
    }


@router.get("/trial-balance")
async def trial_balance(
    as_of_date: date = Query(..., description="Trial balance date"),
    db: Session = Depends(get_db),
):
    """Generate a trial balance — all accounts with debit/credit columns."""
    accounts = db.query(Account).filter(Account.is_active == True).order_by(Account.code).all()

    rows = []
    total_debit = 0.0
    total_credit = 0.0

    for acct in accounts:
        result = db.query(
            func.coalesce(func.sum(JournalEntryLine.debit), 0).label("d"),
            func.coalesce(func.sum(JournalEntryLine.credit), 0).label("c"),
        ).join(JournalEntry).filter(
            JournalEntryLine.account_id == acct.id,
            JournalEntry.is_posted == True,
            JournalEntry.entry_date <= as_of_date,
        ).first()

        d, c = result.d or 0, result.c or 0
        net = d - c

        if abs(net) < 0.01:
            continue

        debit_bal = round(net, 2) if net > 0 else 0.0
        credit_bal = round(abs(net), 2) if net < 0 else 0.0

        rows.append({
            "code": acct.code,
            "name": acct.name,
            "account_type": acct.account_type,
            "debit": debit_bal,
            "credit": credit_bal,
        })
        total_debit += debit_bal
        total_credit += credit_bal

    return {
        "as_of_date": as_of_date.isoformat(),
        "accounts": rows,
        "totals": {
            "total_debit": round(total_debit, 2),
            "total_credit": round(total_credit, 2),
            "is_balanced": abs(total_debit - total_credit) < 0.01,
        },
    }


@router.get("/general-ledger")
async def general_ledger(
    account_id: int = Query(...),
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db),
):
    """Get all journal entry lines for a specific account in a date range."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Account not found")

    lines = (
        db.query(JournalEntryLine)
        .join(JournalEntry)
        .filter(
            JournalEntryLine.account_id == account_id,
            JournalEntry.is_posted == True,
            JournalEntry.entry_date >= start_date,
            JournalEntry.entry_date <= end_date,
        )
        .order_by(JournalEntry.entry_date, JournalEntry.id)
        .all()
    )

    # Opening balance (before start_date)
    opening = _account_balance_at(db, account_id, date(start_date.year, start_date.month, start_date.day - 1) if start_date.day > 1 else start_date, account.normal_balance or "debit")

    running = opening
    entries = []
    for line in lines:
        if account.normal_balance == "debit":
            running += line.debit - line.credit
        else:
            running += line.credit - line.debit
        entries.append({
            "date": line.journal_entry.entry_date.isoformat(),
            "description": line.description or line.journal_entry.description,
            "reference": line.journal_entry.reference,
            "debit": round(line.debit, 2),
            "credit": round(line.credit, 2),
            "balance": round(running, 2),
        })

    return {
        "account": {"id": account.id, "code": account.code, "name": account.name, "account_type": account.account_type},
        "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "opening_balance": round(opening, 2),
        "entries": entries,
        "closing_balance": round(running, 2),
    }


@router.get("/ar-aging")
async def ar_aging(db: Session = Depends(get_db)):
    """Accounts Receivable aging report — invoices by age bucket."""
    today = date.today()
    invoices = db.query(Invoice).filter(Invoice.status.in_(["sent", "overdue"])).all()

    buckets = {"current": [], "days_30": [], "days_60": [], "days_90_plus": []}
    totals = {"current": 0.0, "days_30": 0.0, "days_60": 0.0, "days_90_plus": 0.0}

    for inv in invoices:
        days_overdue = (today - inv.due_date).days if inv.due_date else 0
        amount = inv.total
        entry = {
            "invoice_number": inv.invoice_number,
            "customer_id": inv.customer_id,
            "customer_name": inv.customer.name if inv.customer else None,
            "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
            "due_date": inv.due_date.isoformat() if inv.due_date else None,
            "amount": round(amount, 2),
            "days_overdue": max(0, days_overdue),
        }

        if days_overdue <= 0:
            buckets["current"].append(entry)
            totals["current"] += amount
        elif days_overdue <= 30:
            buckets["days_30"].append(entry)
            totals["days_30"] += amount
        elif days_overdue <= 60:
            buckets["days_60"].append(entry)
            totals["days_60"] += amount
        else:
            buckets["days_90_plus"].append(entry)
            totals["days_90_plus"] += amount

    total_outstanding = sum(totals.values())

    return {
        "as_of_date": today.isoformat(),
        "buckets": buckets,
        "totals": {k: round(v, 2) for k, v in totals.items()},
        "total_outstanding": round(total_outstanding, 2),
    }


@router.get("/gst-worksheet")
async def gst_worksheet(
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db),
):
    """GST/HST worksheet for a filing period.
    Calculates GST collected (from account 2100) and ITC (from account 1300)."""
    gst_payable = db.query(Account).filter(Account.code == "2100").first()
    gst_receivable = db.query(Account).filter(Account.code == "1300").first()

    collected = 0.0
    itc = 0.0

    if gst_payable:
        collected = _account_balance_range(db, gst_payable.id, start_date, end_date, "credit")
    if gst_receivable:
        itc = _account_balance_range(db, gst_receivable.id, start_date, end_date, "debit")

    net_tax = collected - itc

    return {
        "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "gst_collected": round(collected, 2),
        "input_tax_credits": round(itc, 2),
        "net_tax": round(net_tax, 2),
        "amount_owing": round(max(0, net_tax), 2),
        "refund_due": round(abs(min(0, net_tax)), 2),
        "note": "Positive net_tax means you owe CRA. Negative means refund due.",
    }


@router.get("/t2125")
async def t2125_worksheet(
    year: int = Query(..., description="Tax year"),
    db: Session = Depends(get_db),
):
    """T2125 Statement of Business Activities worksheet.
    Maps expense accounts to CRA T2125 line numbers via tax_code."""
    start = date(year, 1, 1)
    end = date(year, 12, 31)

    # Revenue
    revenue_accounts = db.query(Account).filter(Account.account_type == "revenue", Account.is_active == True).all()
    total_revenue = 0.0
    revenue_detail = []
    for acct in revenue_accounts:
        bal = _account_balance_range(db, acct.id, start, end, acct.normal_balance or "credit")
        if abs(bal) >= 0.01:
            revenue_detail.append({"code": acct.code, "name": acct.name, "amount": round(bal, 2)})
            total_revenue += bal

    # Expenses by T2125 line
    expense_accounts = db.query(Account).filter(
        Account.account_type == "expense", Account.is_active == True
    ).order_by(Account.code).all()

    expense_lines = {}
    total_expenses = 0.0
    for acct in expense_accounts:
        bal = _account_balance_range(db, acct.id, start, end, acct.normal_balance or "debit")
        if abs(bal) < 0.01:
            continue

        line_num = acct.tax_code or "9270"  # Default to "Other expenses"
        if line_num not in expense_lines:
            expense_lines[line_num] = {"line": line_num, "accounts": [], "total": 0.0}
        expense_lines[line_num]["accounts"].append({"code": acct.code, "name": acct.name, "amount": round(bal, 2)})
        expense_lines[line_num]["total"] += bal
        total_expenses += bal

    # Round totals
    for line in expense_lines.values():
        line["total"] = round(line["total"], 2)

    net_income = total_revenue - total_expenses

    return {
        "tax_year": year,
        "gross_income": {
            "line_8000": round(total_revenue, 2),
            "detail": revenue_detail,
        },
        "expenses": {
            "lines": dict(sorted(expense_lines.items())),
            "total": round(total_expenses, 2),
        },
        "net_income": round(net_income, 2),
    }
