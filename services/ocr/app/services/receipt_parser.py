"""
Receipt / Invoice Parser for ZakPOS
===================================

Heuristic raw-text -> structured receipt digitization used by the
``POST /api/v1/extract-receipt`` endpoint (Phase D, task #26).

Pure functions only: no OCR engines, no models, no IO. Price/name/junk-line
helpers are reused from ``product_parser`` so both extractors stay in sync.

Pipeline:
    bytes -> raw_text (OCRService for images / pypdf for PDFs)
    raw_text -> {vendor, document_date, currency, subtotal, tax,
                 discount, total, items}  (``parse_receipt_text``)
"""

import re
from typing import Any, Dict, List, Optional, Tuple

from app.services.product_parser import (
    _CURRENCY_ONLY_RE,
    _clean_name,
    _is_junk_line,
    _parse_price_number,
)

# ---------------------------------------------------------------------------
# Vendor
# ---------------------------------------------------------------------------

# Keywords that mark a line as a plausible business name (not just a slogan).
_BUSINESS_HINTS = ("invoice", "receipt", "cash memo", "store", "traders", "ltd", "pvt")
_VENDOR_MAX_LEN = 120
_VENDOR_HEAD_LINES = 5


def _parse_vendor(text: str) -> Optional[str]:
    """First business-looking line near the top, else the first non-empty line."""
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return None
    for line in lines[:_VENDOR_HEAD_LINES]:
        lowered = line.lower()
        if any(hint in lowered for hint in _BUSINESS_HINTS):
            return line[:_VENDOR_MAX_LEN]
    return lines[0][:_VENDOR_MAX_LEN]


# ---------------------------------------------------------------------------
# Date
# ---------------------------------------------------------------------------

_DATE_PATTERN = r"\d{1,4}[-/]\d{1,2}[-/]\d{1,4}"
_LABELED_DATE_RE = re.compile(
    r"\b(?:date|invoice\s*date|bill\s*date|txn\s*date)\b[^\d\n]{0,12}(" + _DATE_PATTERN + r")",
    re.IGNORECASE,
)
_ANY_DATE_RE = re.compile(_DATE_PATTERN)


def _normalize_date(value: str) -> Optional[str]:
    """Normalize one numeric date token to ISO YYYY-MM-DD.

    Year-first tokens are ISO; otherwise day-first is preferred (BD
    convention) and month-first is only tried when day-first is impossible.
    """
    parts = re.split(r"[-/]", value)
    if len(parts) != 3:
        return None
    if len(parts[0]) == 4 and len(parts[2]) == 4:
        return None
    try:
        if len(parts[0]) == 4:  # YYYY-MM-DD
            year, month, day = (int(p) for p in parts)
        elif len(parts[2]) == 4:  # DD[-/]MM[-/]YYYY (day-first)
            day, month, year = (int(parts[0]), int(parts[1]), int(parts[2]))
        else:
            return None
    except ValueError:
        return None
    if 1900 <= year <= 2999 and 1 <= month <= 12 and 1 <= day <= 31:
        return f"{year:04d}-{month:02d}-{day:02d}"
    if len(parts[2]) == 4:
        # Ambiguous-looking token rejected day-first: retry month-first.
        month2, day2 = int(parts[0]), int(parts[1])
        if 1 <= month2 <= 12 and 1 <= day2 <= 31:
            return f"{year:04d}-{month2:02d}-{day2:02d}"
    return None


def _find_date(text: str) -> Optional[str]:
    """Find a date, preferring an explicitly labelled "Date: ..." value."""
    match = _LABELED_DATE_RE.search(text)
    if match:
        value = _normalize_date(match.group(1))
        if value:
            return value
    for match in _ANY_DATE_RE.finditer(text):
        value = _normalize_date(match.group(0))
        if value:
            return value
    return None


# ---------------------------------------------------------------------------
# Currency
# ---------------------------------------------------------------------------

_BDT_RE = re.compile(r"[\u09f3\u09f9]|\bBDT\b|\bTaka\b|\bTk\.?(?![A-Za-z])", re.IGNORECASE)
_USD_RE = re.compile(r"\bUSD\b|\bUS\$|\$", re.IGNORECASE)
_EUR_RE = re.compile(r"\u20ac|\bEUR\b", re.IGNORECASE)


def _detect_currency(text: str, has_amounts: bool) -> Optional[str]:
    if _BDT_RE.search(text):
        return "BDT"
    if _USD_RE.search(text):
        return "USD"
    if _EUR_RE.search(text):
        return "EUR"
    # Amounts without any symbol: receipts in this market are defaulted to BDT.
    return "BDT" if has_amounts else None


# ---------------------------------------------------------------------------
# Summary labels (subtotal / tax / discount / total)
# ---------------------------------------------------------------------------

# Order matters: longer variants must precede "total" so "Sub Total" or
# "Grand Total" are not double-counted as a bare "Total".
_SUMMARY_LABEL_RE = re.compile(
    r"\b(?:sub[\s-]*total|grand[\s-]*total|net[\s-]*total|amount[\s-]*due|"
    r"discount|total|vat|gst|tax)\b",
    re.IGNORECASE,
)

# Amount that follows a label on the same line: punctuation, optional
# "amount" word, optional rate clause ("@ 5%:"), optional currency marker,
# then the number. Lookaheads reject percents ("10%"), dates ("12/10/26")
# and multi-dot tokens ("12.10.5") so rates and dates are never read as money.
_AMOUNT_AFTER_LABEL_RE = re.compile(
    r"""^[\s:;=#@.-]*
    (?:amount[\s:;=#@.-]*)?
    (?:\d+(?:[.,]\d+)?\s*%[\s:;=#@.-]*)?
    [\s:;=#@.-]*
    (?:\u09f3|\u09f9|\$|\bBDT\b|\bTaka\b|\bTk\.?|\bRs\.?)?
    [\s:;=#@.-]*
    (?P<amount>\d[\d,]*(?:\.\d{1,2})?)
    (?!\d)(?!\.\d)(?!\s*%)(?!\s*[-/]\s*\d)
    """,
    re.IGNORECASE | re.VERBOSE,
)

# Lines that start with a summary keyword are totals, never items.
_SUMMARY_PREFIX_RE = re.compile(
    r"^(?:sub[\s-]*total|grand[\s-]*total|net[\s-]*total|amount[\s-]*due|"
    r"total|vat|gst|tax|discount|balance|change|paid|cash|rounding)\b",
    re.IGNORECASE,
)


def _label_group(matched: str) -> str:
    m = matched.lower()
    if "sub" in m:
        return "subtotal"
    if "disc" in m:
        return "discount"
    if "vat" in m or "gst" in m or "tax" in m:
        return "tax"
    # total / grand total / net total / amount due
    return "total"


def _extract_summary(text: str) -> Dict[str, Optional[float]]:
    """Pull subtotal / tax / discount / total out of labelled lines.

    For "total" the LAST labelled amount in the document wins (grand-total
    convention), which also skips column headers like "Rate Total".
    """
    result: Dict[str, Optional[float]] = {"subtotal": None, "tax": None, "discount": None, "total": None}
    for line in text.splitlines():
        for match in _SUMMARY_LABEL_RE.finditer(line):
            amount_match = _AMOUNT_AFTER_LABEL_RE.match(line[match.end():])
            if not amount_match:
                continue
            value = _parse_price_number(amount_match.group("amount"))
            if value is None:
                continue
            result[_label_group(match.group(0))] = value
    return result


# ---------------------------------------------------------------------------
# Line items
# ---------------------------------------------------------------------------

_MAX_ITEMS = 60

# "3 x Cola ..." / "2xMilk ...": leading quantity multiplier.
_QTY_PREFIX_RE = re.compile(r"^\s*(\d{1,4}(?:[.,]\d+)?)\s*[\u00d7xX](?![A-Za-z0-9])")

# "Cola 500ml @ 25 = 75": explicit unit-rate separator.
_AT_SPLIT_RE = re.compile(r"\s@\s*")

_TOKEN_STRIP_CHARS = "-\u2013\u2014:=/@|,()[]*+~!"
_CURRENCY_PREFIX_RE = re.compile(r"^[\u09f3\u09f9\$]")
_NUMBERISH_RE = re.compile(r"\d[\d.,]*")
_HAS_LETTER_RE = re.compile(r"[^\W\d_]", re.UNICODE)


def _trailing_numbers(part: str) -> Tuple[List[float], str]:
    """Collect trailing money/qty numbers (line order, low to high) from a
    line fragment and return them plus the fragment with those tokens removed.

    Tokens with >6 digits (barcodes/phones), percent tokens, and date tokens
    are not money and stop the scan.
    """
    tokens = part.split()
    values: List[float] = []
    i = len(tokens) - 1
    while i >= 0:
        core = tokens[i].strip(_TOKEN_STRIP_CHARS)
        if not core:  # pure separator token ("=", "@", "-") between numbers
            i -= 1
            continue
        body = _CURRENCY_PREFIX_RE.sub("", core)
        if "%" in core or not _NUMBERISH_RE.fullmatch(body) or len(re.sub(r"\D", "", body)) > 6:
            break
        value = _parse_price_number(body)
        if value is None:
            break
        values.append(value)
        i -= 1
    values.reverse()
    return values, " ".join(tokens[: i + 1])


def _parse_item_line(line: str) -> Optional[Dict[str, Any]]:
    """Parse one line into a receipt item or None.

    Supported shapes:
      "3 x Cola 500ml @ 25 = 75"   qty / unit / total
      "3 x Cola @ 25"              qty / unit / total (computed)
      "2x Milk 60"                 qty + single amount -> line_total
      "Cola 500ml   3   25   75"   columnar trailing numbers
      "Coke 30"                    single amount, no qty -> name + nulls
    """
    stripped = line.strip()
    if not stripped or _is_junk_line(stripped):
        return None
    if _SUMMARY_PREFIX_RE.match(stripped):
        return None

    qty: Optional[float] = None
    working = stripped
    qty_match = _QTY_PREFIX_RE.match(working)
    if qty_match:
        parsed = _parse_price_number(qty_match.group(1))
        if parsed is not None and parsed > 0:
            qty = parsed
            working = working[qty_match.end():]

    name_part = working
    unit_price: Optional[float] = None
    line_total: Optional[float] = None
    has_amount_tokens = False

    at_match = _AT_SPLIT_RE.search(working)
    if at_match:
        name_part = working[: at_match.start()]
        after, _rest = _trailing_numbers(working[at_match.end():])
        has_amount_tokens = bool(after)
        if len(after) == 1:
            unit_price = after[0]
            if qty is not None:
                line_total = round(qty * unit_price, 2)
        elif len(after) >= 2:
            unit_price, line_total = after[-2], after[-1]
    else:
        trailing, name_part = _trailing_numbers(working)
        has_amount_tokens = bool(trailing)
        if qty is not None:
            if len(trailing) == 1:
                line_total = trailing[0]
            elif len(trailing) >= 2:
                unit_price, line_total = trailing[-2], trailing[-1]
        elif len(trailing) >= 3:
            qty, unit_price, line_total = trailing[-3], trailing[-2], trailing[-1]
            if qty is not None and qty <= 0:
                qty = None
        elif len(trailing) == 2:
            unit_price, line_total = trailing[0], trailing[1]
            if unit_price and unit_price > 0:
                ratio = line_total / unit_price
                if abs(ratio - round(ratio)) < 1e-6 and 0 < round(ratio) <= 100000:
                    qty = float(round(ratio))
        # len(trailing) == 1 with no qty: keep name + nulls (single bare
        # amounts are too ambiguous to claim as a price on a receipt).

    # A line only becomes an item when it carries numbers (amount tokens or
    # an explicit "Nx" qty); plain text lines are headers/prose.
    if not has_amount_tokens and qty is None:
        return None

    name = _clean_name(name_part)
    if len(name) < 2 or not _HAS_LETTER_RE.search(name):
        return None
    if _CURRENCY_ONLY_RE.match(name):
        return None

    return {"name": name, "qty": qty, "unit_price": unit_price, "line_total": line_total}


def _parse_items(text: str) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for line in text.splitlines():
        item = _parse_item_line(line)
        if item:
            items.append(item)
            if len(items) >= _MAX_ITEMS:
                break
    return items


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def parse_receipt_text(text: str) -> Dict[str, Any]:
    """Digitize raw receipt/invoice text into structured fields (pure, no IO).

    Returns a dict with: vendor, document_date, currency, subtotal, discount,
    tax, total, items. Every field is null-safe for empty/garbage input.
    """
    text = text or ""
    summary = _extract_summary(text)
    items = _parse_items(text)
    has_amounts = any(v is not None for v in summary.values()) or any(
        item["unit_price"] is not None or item["line_total"] is not None for item in items
    )
    return {
        "vendor": _parse_vendor(text),
        "document_date": _find_date(text),
        "currency": _detect_currency(text, has_amounts),
        "subtotal": summary["subtotal"],
        "discount": summary["discount"],
        "tax": summary["tax"],
        "total": summary["total"],
        "items": items,
    }
