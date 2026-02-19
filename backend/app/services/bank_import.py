"""CSV parser for Canadian bank statement imports.

Supports common formats from TD, RBC, Scotiabank, BMO, and generic CSV.
Auto-detects format based on headers.
"""
import csv
import hashlib
import io
from datetime import datetime, date
from typing import Optional


def _parse_date(value: str) -> Optional[date]:
    """Try multiple date formats common in Canadian bank CSVs."""
    formats = [
        "%m/%d/%Y",   # MM/DD/YYYY (TD, RBC)
        "%Y-%m-%d",   # YYYY-MM-DD (ISO)
        "%d/%m/%Y",   # DD/MM/YYYY
        "%m-%d-%Y",   # MM-DD-YYYY
        "%Y/%m/%d",   # YYYY/MM/DD
        "%b %d, %Y",  # Jan 15, 2026
        "%B %d, %Y",  # January 15, 2026
    ]
    value = value.strip()
    for fmt in formats:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def _parse_amount(value: str) -> Optional[float]:
    """Parse amount string, handling commas, brackets for negatives, etc."""
    if not value:
        return None
    value = value.strip().replace(",", "").replace("$", "").replace(" ", "")
    # Handle (123.45) format for negative amounts
    if value.startswith("(") and value.endswith(")"):
        value = "-" + value[1:-1]
    try:
        return float(value)
    except ValueError:
        return None


def _make_hash(txn_date: date, description: str, amount: float) -> str:
    """Create a dedup hash from transaction fields."""
    raw = f"{txn_date.isoformat()}|{description.strip()}|{amount:.2f}"
    return hashlib.sha256(raw.encode()).hexdigest()


# ── Format Detection ──

KNOWN_FORMATS = {
    "td": {
        "headers": {"date", "description", "debit", "credit"},
        "date_col": "date",
        "desc_col": "description",
        "debit_col": "debit",
        "credit_col": "credit",
    },
    "rbc": {
        "headers": {"account type", "account number", "transaction date", "cheque number", "description 1", "description 2", "cad$"},
        "date_col": "transaction date",
        "desc_col": "description 1",
        "amount_col": "cad$",
    },
    "scotiabank": {
        "headers": {"date", "amount", "description"},
        "date_col": "date",
        "desc_col": "description",
        "amount_col": "amount",
    },
    "bmo": {
        "headers": {"first bank card", "transaction type", "date posted", "transaction amount", "description"},
        "date_col": "date posted",
        "desc_col": "description",
        "amount_col": "transaction amount",
    },
}


def _detect_format(headers: list[str]) -> Optional[dict]:
    """Detect CSV format based on headers."""
    lower_headers = {h.lower().strip() for h in headers}
    for name, fmt in KNOWN_FORMATS.items():
        if fmt["headers"].issubset(lower_headers):
            return fmt
    return None


def _normalize_header(header: str) -> str:
    return header.lower().strip()


def parse_bank_csv(file_content: bytes, fallback_format: str = "auto") -> list[dict]:
    """Parse a bank CSV file and return a list of transaction dicts.

    Returns list of:
        {
            "transaction_date": date,
            "description": str,
            "amount": float,  # positive = deposit, negative = withdrawal
            "balance": float | None,
            "reference": str | None,
            "import_hash": str,
        }
    """
    text = file_content.decode("utf-8-sig")  # Handle BOM
    reader = csv.reader(io.StringIO(text))

    # Read headers
    raw_headers = next(reader, None)
    if not raw_headers:
        return []

    headers = [_normalize_header(h) for h in raw_headers]
    fmt = _detect_format(headers)

    transactions = []

    if fmt and "debit_col" in fmt and "credit_col" in fmt:
        # TD-style: separate debit/credit columns
        date_idx = headers.index(fmt["date_col"])
        desc_idx = headers.index(fmt["desc_col"])
        debit_idx = headers.index(fmt["debit_col"])
        credit_idx = headers.index(fmt["credit_col"])
        balance_idx = headers.index("balance") if "balance" in headers else None

        for row in reader:
            if len(row) <= max(date_idx, desc_idx, debit_idx, credit_idx):
                continue

            txn_date = _parse_date(row[date_idx])
            if not txn_date:
                continue

            desc = row[desc_idx].strip()
            if not desc:
                continue

            debit = _parse_amount(row[debit_idx])
            credit = _parse_amount(row[credit_idx])

            # Debit = money out (negative), Credit = money in (positive)
            amount = 0.0
            if credit and credit > 0:
                amount = credit
            elif debit and debit > 0:
                amount = -debit

            if amount == 0.0:
                continue

            balance = None
            if balance_idx is not None and balance_idx < len(row):
                balance = _parse_amount(row[balance_idx])

            transactions.append({
                "transaction_date": txn_date,
                "description": desc,
                "amount": round(amount, 2),
                "balance": round(balance, 2) if balance is not None else None,
                "reference": None,
                "import_hash": _make_hash(txn_date, desc, amount),
            })

    elif fmt and "amount_col" in fmt:
        # Single amount column (RBC, Scotiabank, BMO style)
        date_idx = headers.index(fmt["date_col"])
        desc_idx = headers.index(fmt["desc_col"])
        amount_idx = headers.index(fmt["amount_col"])
        balance_idx = headers.index("balance") if "balance" in headers else None
        ref_idx = headers.index("cheque number") if "cheque number" in headers else None

        for row in reader:
            if len(row) <= max(date_idx, desc_idx, amount_idx):
                continue

            txn_date = _parse_date(row[date_idx])
            if not txn_date:
                continue

            desc = row[desc_idx].strip()
            if not desc:
                continue

            amount = _parse_amount(row[amount_idx])
            if amount is None or amount == 0.0:
                continue

            balance = None
            if balance_idx is not None and balance_idx < len(row):
                balance = _parse_amount(row[balance_idx])

            reference = None
            if ref_idx is not None and ref_idx < len(row):
                reference = row[ref_idx].strip() or None

            transactions.append({
                "transaction_date": txn_date,
                "description": desc,
                "amount": round(amount, 2),
                "balance": round(balance, 2) if balance is not None else None,
                "reference": reference,
                "import_hash": _make_hash(txn_date, desc, amount),
            })

    else:
        # Generic fallback: try common column names
        # Look for date, description/memo, amount/debit/credit columns
        date_idx = None
        desc_idx = None
        amount_idx = None
        debit_idx = None
        credit_idx = None
        balance_idx = None

        for i, h in enumerate(headers):
            if h in ("date", "transaction date", "posted date", "date posted"):
                date_idx = i
            elif h in ("description", "memo", "narrative", "details", "transaction details", "description 1"):
                desc_idx = i
            elif h in ("amount", "transaction amount", "value"):
                amount_idx = i
            elif h in ("debit", "withdrawal", "withdrawals"):
                debit_idx = i
            elif h in ("credit", "deposit", "deposits"):
                credit_idx = i
            elif h in ("balance", "running balance"):
                balance_idx = i

        if date_idx is None or desc_idx is None:
            return []

        for row in reader:
            if len(row) <= max(date_idx, desc_idx):
                continue

            txn_date = _parse_date(row[date_idx])
            if not txn_date:
                continue

            desc = row[desc_idx].strip()
            if not desc:
                continue

            amount = 0.0
            if amount_idx is not None and amount_idx < len(row):
                amt = _parse_amount(row[amount_idx])
                if amt is not None:
                    amount = amt
            elif debit_idx is not None and credit_idx is not None:
                debit = _parse_amount(row[debit_idx]) if debit_idx < len(row) else None
                credit = _parse_amount(row[credit_idx]) if credit_idx < len(row) else None
                if credit and credit > 0:
                    amount = credit
                elif debit and debit > 0:
                    amount = -debit

            if amount == 0.0:
                continue

            balance = None
            if balance_idx is not None and balance_idx < len(row):
                balance = _parse_amount(row[balance_idx])

            transactions.append({
                "transaction_date": txn_date,
                "description": desc,
                "amount": round(amount, 2),
                "balance": round(balance, 2) if balance is not None else None,
                "reference": None,
                "import_hash": _make_hash(txn_date, desc, amount),
            })

    return transactions
