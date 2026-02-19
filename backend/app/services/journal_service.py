"""Core double-entry bookkeeping engine.

Auto-generates journal entries from transactions, invoices, and bills.
All financial reports derive from JournalEntryLine data.
"""
import logging
from datetime import date
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.journal_entry import JournalEntry, JournalEntryLine
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)

# ── Category → Account Code mapping ──
# Maps the 19 AI-detected expense subcategories to CoA account codes.
CATEGORY_ACCOUNT_MAP = {
    "advertising": "5000",
    "bad_debts": "5050",
    "bank_fees": "5100",
    "insurance": "5150",
    "meals_and_entertainment": "5200",
    "office_supplies": "5250",
    "professional_fees": "5300",
    "rent": "5350",
    "repairs_and_maintenance": "5400",
    "software_subscriptions": "5450",
    "telephone": "5500",
    "travel": "5550",
    "utilities": "5600",
    "vehicle_expenses": "5650",
    "contractor_payments": "5700",
    "employee_wages": "5750",
    "shipping": "5800",
    "taxes_and_licenses": "5850",
    "depreciation": "5900",
    "other": "5950",
    "business_use_of_home": "5960",
    "inventory": "6100",
    "cogs": "6000",
}

# Maps payment method → credit account code
PAYMENT_CREDIT_ACCOUNT = {
    "cash": "1000",
    "credit_card": "2300",
    "debit": "1050",
    "bank_transfer": "1050",
    "cheque": "1050",
    "other": "1050",
}


def _get_account_by_code(db: Session, code: str) -> Account | None:
    return db.query(Account).filter(Account.code == code, Account.is_active == True).first()


def _resolve_expense_account_code(subcategory: str | None) -> str:
    """Map a transaction subcategory to an expense account code."""
    if subcategory and subcategory in CATEGORY_ACCOUNT_MAP:
        return CATEGORY_ACCOUNT_MAP[subcategory]
    return "5950"  # Other Expenses fallback


def _resolve_credit_account_code(payment_method: str | None) -> str:
    """Map a payment method to a credit account code."""
    if payment_method and payment_method in PAYMENT_CREDIT_ACCOUNT:
        return PAYMENT_CREDIT_ACCOUNT[payment_method]
    return "1050"  # Business Bank Account fallback


def validate_journal_entry_balance(lines: list[dict]) -> bool:
    """Check that total debits equal total credits."""
    total_debit = sum(line.get("debit", 0) for line in lines)
    total_credit = sum(line.get("credit", 0) for line in lines)
    return abs(total_debit - total_credit) < 0.01


# ── Transaction → Journal Entry ──

def create_je_for_transaction(db: Session, txn: Transaction) -> JournalEntry | None:
    """Create a journal entry for an expense or revenue transaction.

    Expense: Dr. Expense + Dr. GST Receivable → Cr. Bank/CC
    Revenue: Dr. Bank → Cr. Revenue + Cr. GST Payable
    """
    entry_date = txn.transaction_date.date() if hasattr(txn.transaction_date, 'date') else txn.transaction_date
    amount = abs(txn.amount)
    tax_amount = txn.tax_amount or 0.0

    lines = []

    if txn.category == "expense":
        expense_code = _resolve_expense_account_code(txn.subcategory)
        credit_code = _resolve_credit_account_code(txn.payment_method)

        expense_acct = _get_account_by_code(db, expense_code)
        credit_acct = _get_account_by_code(db, credit_code)
        if not expense_acct or not credit_acct:
            logger.warning("Missing CoA accounts for transaction %d (expense=%s, credit=%s)", txn.id, expense_code, credit_code)
            return None

        # Debit expense account
        lines.append({"account_id": expense_acct.id, "debit": amount, "credit": 0, "description": txn.description})

        # Debit GST Receivable if tax
        if tax_amount > 0:
            gst_recv = _get_account_by_code(db, "1300")
            if gst_recv:
                lines.append({"account_id": gst_recv.id, "debit": tax_amount, "credit": 0, "description": f"GST on {txn.description}"})

        # Credit payment account
        total_out = amount + tax_amount
        lines.append({"account_id": credit_acct.id, "debit": 0, "credit": total_out, "description": txn.description})

    elif txn.category == "revenue":
        revenue_acct = _get_account_by_code(db, "4000")
        bank_acct = _get_account_by_code(db, "1050")
        if not revenue_acct or not bank_acct:
            logger.warning("Missing CoA accounts for revenue transaction %d", txn.id)
            return None

        total_in = amount + tax_amount

        # Debit bank
        lines.append({"account_id": bank_acct.id, "debit": total_in, "credit": 0, "description": txn.description})

        # Credit revenue
        lines.append({"account_id": revenue_acct.id, "debit": 0, "credit": amount, "description": txn.description})

        # Credit GST Payable if tax
        if tax_amount > 0:
            gst_pay = _get_account_by_code(db, "2100")
            if gst_pay:
                lines.append({"account_id": gst_pay.id, "debit": 0, "credit": tax_amount, "description": f"GST on {txn.description}"})
    else:
        # asset, liability — skip auto JE for now
        return None

    if not validate_journal_entry_balance(lines):
        logger.error("Unbalanced journal entry for transaction %d", txn.id)
        return None

    je = JournalEntry(
        entry_date=entry_date,
        description=txn.description,
        reference=f"TXN-{txn.id}",
        entry_type="auto_expense" if txn.category == "expense" else "auto_revenue",
        transaction_id=txn.id,
        is_posted=True,
    )
    db.add(je)
    db.flush()

    for line_data in lines:
        line = JournalEntryLine(
            journal_entry_id=je.id,
            account_id=line_data["account_id"],
            description=line_data.get("description"),
            debit=line_data["debit"],
            credit=line_data["credit"],
        )
        db.add(line)

    return je


def delete_je_for_transaction(db: Session, txn_id: int) -> int:
    """Delete all journal entries linked to a transaction. Returns count deleted."""
    entries = db.query(JournalEntry).filter(JournalEntry.transaction_id == txn_id).all()
    count = len(entries)
    for entry in entries:
        db.delete(entry)
    return count


# ── Invoice → Journal Entry ──

def create_je_for_invoice_sent(db: Session, invoice) -> JournalEntry | None:
    """When invoice status changes to 'sent': Dr. AR → Cr. Revenue + Cr. GST Payable."""
    ar_acct = _get_account_by_code(db, "1100")
    revenue_acct = _get_account_by_code(db, "4000")
    if not ar_acct or not revenue_acct:
        logger.warning("Missing AR or Revenue account for invoice %d", invoice.id)
        return None

    lines = []

    # Debit Accounts Receivable for full total
    lines.append({"account_id": ar_acct.id, "debit": invoice.total, "credit": 0, "description": f"Invoice {invoice.invoice_number}"})

    # Credit Revenue for subtotal
    lines.append({"account_id": revenue_acct.id, "debit": 0, "credit": invoice.subtotal, "description": f"Invoice {invoice.invoice_number}"})

    # Credit GST Payable if GST applied
    if invoice.gst_amount and invoice.gst_amount > 0:
        gst_pay = _get_account_by_code(db, "2100")
        if gst_pay:
            lines.append({"account_id": gst_pay.id, "debit": 0, "credit": invoice.gst_amount, "description": f"GST on {invoice.invoice_number}"})

    if not validate_journal_entry_balance(lines):
        logger.error("Unbalanced JE for invoice sent %d", invoice.id)
        return None

    je = JournalEntry(
        entry_date=invoice.invoice_date,
        description=f"Invoice {invoice.invoice_number} sent",
        reference=invoice.invoice_number,
        entry_type="auto_invoice",
        invoice_id=invoice.id,
        is_posted=True,
    )
    db.add(je)
    db.flush()

    for line_data in lines:
        db.add(JournalEntryLine(
            journal_entry_id=je.id,
            account_id=line_data["account_id"],
            description=line_data.get("description"),
            debit=line_data["debit"],
            credit=line_data["credit"],
        ))

    return je


def create_je_for_invoice_paid(db: Session, invoice, amount: float = None, payment_date: date = None) -> JournalEntry | None:
    """When invoice is paid: Dr. Bank → Cr. AR."""
    bank_acct = _get_account_by_code(db, "1050")
    ar_acct = _get_account_by_code(db, "1100")
    if not bank_acct or not ar_acct:
        logger.warning("Missing Bank or AR account for invoice payment %d", invoice.id)
        return None

    pay_amount = amount or invoice.total
    pay_date = payment_date or invoice.paid_date or date.today()

    lines = [
        {"account_id": bank_acct.id, "debit": pay_amount, "credit": 0, "description": f"Payment for {invoice.invoice_number}"},
        {"account_id": ar_acct.id, "debit": 0, "credit": pay_amount, "description": f"Payment for {invoice.invoice_number}"},
    ]

    if not validate_journal_entry_balance(lines):
        logger.error("Unbalanced JE for invoice payment %d", invoice.id)
        return None

    je = JournalEntry(
        entry_date=pay_date,
        description=f"Payment received for {invoice.invoice_number}",
        reference=invoice.invoice_number,
        entry_type="auto_payment",
        invoice_id=invoice.id,
        is_posted=True,
    )
    db.add(je)
    db.flush()

    for line_data in lines:
        db.add(JournalEntryLine(
            journal_entry_id=je.id,
            account_id=line_data["account_id"],
            description=line_data.get("description"),
            debit=line_data["debit"],
            credit=line_data["credit"],
        ))

    return je


# ── Manual Journal Entry ──

def create_manual_journal_entry(db: Session, entry_date: date, description: str,
                                 lines: list[dict], notes: str = None) -> JournalEntry:
    """Create a manual journal entry (for adjustments, depreciation, etc.).
    lines: [{"account_id": int, "debit": float, "credit": float, "description": str}, ...]
    """
    if not validate_journal_entry_balance(lines):
        raise ValueError("Journal entry is not balanced: total debits must equal total credits")

    if not lines:
        raise ValueError("Journal entry must have at least one line")

    je = JournalEntry(
        entry_date=entry_date,
        description=description,
        entry_type="manual",
        is_posted=True,
        notes=notes,
    )
    db.add(je)
    db.flush()

    for line_data in lines:
        db.add(JournalEntryLine(
            journal_entry_id=je.id,
            account_id=line_data["account_id"],
            description=line_data.get("description"),
            debit=line_data.get("debit", 0),
            credit=line_data.get("credit", 0),
        ))

    return je


# ── Migration: Create JEs for existing transactions ──

def migrate_existing_transactions(db: Session) -> int:
    """One-time migration: create journal entries for all existing transactions
    that don't already have one. Idempotent."""
    existing_txn_ids = {
        je.transaction_id
        for je in db.query(JournalEntry.transaction_id).filter(JournalEntry.transaction_id.isnot(None)).all()
    }

    transactions = db.query(Transaction).all()
    created = 0

    for txn in transactions:
        if txn.id in existing_txn_ids:
            continue
        je = create_je_for_transaction(db, txn)
        if je:
            created += 1

    if created > 0:
        db.commit()

    return created


# ── Bill → Journal Entry ──

def create_je_for_bill_received(db: Session, bill) -> JournalEntry | None:
    """When bill status changes to 'received': Dr. Expense + Dr. GST Receivable → Cr. AP.

    Uses item-level accounts if set, otherwise bill-level expense_account,
    otherwise falls back to 5950 Other Expenses.
    """
    ap_acct = _get_account_by_code(db, "2000")
    if not ap_acct:
        logger.warning("Missing AP account (2000) for bill %d", bill.id)
        return None

    lines = []

    # Build expense debit lines from bill items
    for item in (bill.items or []):
        # Determine expense account: item-level > bill-level > default 5950
        if item.account_id:
            expense_acct = db.query(Account).filter(Account.id == item.account_id).first()
        elif bill.expense_account_id:
            expense_acct = db.query(Account).filter(Account.id == bill.expense_account_id).first()
        else:
            expense_acct = _get_account_by_code(db, "5950")

        if not expense_acct:
            logger.warning("Missing expense account for bill item %d, falling back to 5950", item.id)
            expense_acct = _get_account_by_code(db, "5950")
            if not expense_acct:
                return None

        lines.append({
            "account_id": expense_acct.id,
            "debit": round(item.amount, 2),
            "credit": 0,
            "description": item.description,
        })

    # If no items, use bill subtotal directly
    if not lines:
        if bill.expense_account_id:
            expense_acct = db.query(Account).filter(Account.id == bill.expense_account_id).first()
        else:
            expense_acct = _get_account_by_code(db, "5950")
        if not expense_acct:
            logger.warning("Missing expense account for bill %d", bill.id)
            return None
        lines.append({
            "account_id": expense_acct.id,
            "debit": round(bill.subtotal, 2),
            "credit": 0,
            "description": f"Bill {bill.bill_number}",
        })

    # Debit GST Receivable if GST applied
    if bill.gst_amount and bill.gst_amount > 0:
        gst_recv = _get_account_by_code(db, "1300")
        if gst_recv:
            lines.append({
                "account_id": gst_recv.id,
                "debit": round(bill.gst_amount, 2),
                "credit": 0,
                "description": f"GST on {bill.bill_number}",
            })

    # Credit Accounts Payable for total
    lines.append({
        "account_id": ap_acct.id,
        "debit": 0,
        "credit": round(bill.total, 2),
        "description": f"Bill {bill.bill_number}",
    })

    if not validate_journal_entry_balance(lines):
        logger.error("Unbalanced JE for bill received %d", bill.id)
        return None

    je = JournalEntry(
        entry_date=bill.bill_date,
        description=f"Bill {bill.bill_number} received",
        reference=bill.bill_number,
        entry_type="auto_bill",
        bill_id=bill.id,
        is_posted=True,
    )
    db.add(je)
    db.flush()

    for line_data in lines:
        db.add(JournalEntryLine(
            journal_entry_id=je.id,
            account_id=line_data["account_id"],
            description=line_data.get("description"),
            debit=line_data["debit"],
            credit=line_data["credit"],
        ))

    return je


def create_je_for_bill_payment(db: Session, bill, payment) -> JournalEntry | None:
    """When a bill payment is recorded: Dr. AP → Cr. Bank."""
    ap_acct = _get_account_by_code(db, "2000")
    bank_acct = _get_account_by_code(db, "1050")
    if not ap_acct or not bank_acct:
        logger.warning("Missing AP or Bank account for bill payment on bill %d", bill.id)
        return None

    pay_amount = round(payment.amount, 2)

    lines = [
        {"account_id": ap_acct.id, "debit": pay_amount, "credit": 0, "description": f"Payment for {bill.bill_number}"},
        {"account_id": bank_acct.id, "debit": 0, "credit": pay_amount, "description": f"Payment for {bill.bill_number}"},
    ]

    if not validate_journal_entry_balance(lines):
        logger.error("Unbalanced JE for bill payment on bill %d", bill.id)
        return None

    je = JournalEntry(
        entry_date=payment.payment_date,
        description=f"Payment for bill {bill.bill_number}",
        reference=bill.bill_number,
        entry_type="auto_bill_payment",
        bill_id=bill.id,
        is_posted=True,
    )
    db.add(je)
    db.flush()

    for line_data in lines:
        db.add(JournalEntryLine(
            journal_entry_id=je.id,
            account_id=line_data["account_id"],
            description=line_data.get("description"),
            debit=line_data["debit"],
            credit=line_data["credit"],
        ))

    return je
