"""
Product Catalog Parser for ZakPOS
================================

Heuristic text -> product candidate extraction used by the
``POST /api/v1/extract-products`` endpoint for POS catalog onboarding.

Pure functions only: no OCR engines, no models, no IO. The module imports
nothing heavier than ``re``/``typing`` so it stays unit-testable without
torch/tesseract installed. ``extract_pdf_text`` lazily imports ``pypdf``
inside the function for the same reason.

Pipeline:
    bytes -> raw_text (OCRService for images / pypdf for PDFs)
    raw_text -> product candidates (``parse_product_text``)
"""

import re
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Barcode check-digit helpers
# ---------------------------------------------------------------------------


def _gtin_check_digit(code: str, weights: Tuple[int, ...]) -> int:
    """Compute the mod-10 GTIN check digit for all but the last digit of ``code``."""
    body = code[:-1]
    total = sum(int(digit) * weights[index % len(weights)] for index, digit in enumerate(body))
    return (10 - total % 10) % 10


def validate_ean13(code: str) -> bool:
    """Validate an EAN-13 code: exactly 13 digits with a correct mod-10 check digit."""
    if len(code) != 13 or not code.isdigit():
        return False
    return _gtin_check_digit(code, (1, 3)) == int(code[-1])


def validate_upca(code: str) -> bool:
    """Validate a UPC-A code: exactly 12 digits with a correct mod-10 check digit."""
    if len(code) != 12 or not code.isdigit():
        return False
    return _gtin_check_digit(code, (3, 1)) == int(code[-1])


def validate_code128(code: str) -> bool:
    """Validate a numeric-only Code128 payload candidate.

    Code128 lengths overlap other symbologies, so we treat 8-16 digit runs that
    are not EAN-13/UPC-A and end with a correct mod-10 check digit as Code128
    candidates (a true Code128 symbol checksum is mod-103 over the full ASCII
    payload, which OCR cannot recover from digits alone).
    """
    if not code.isdigit():
        return False
    if not 8 <= len(code) <= 16:
        return False
    if len(code) in (12, 13):
        return False  # handled by UPC-A / EAN-13 validators
    return _gtin_check_digit(code, (1, 3)) == int(code[-1])


# ---------------------------------------------------------------------------
# Token patterns
# ---------------------------------------------------------------------------

# Runs of 8-16 digits are barcode candidates (longer runs are also stripped).
_BARCODE_RUN_RE = re.compile(r"(?<!\d)\d{8,16}(?!\d)")
_LONG_DIGIT_RUN_RE = re.compile(r"(?<!\d)\d{17,}(?!\d)")

# Currency-labelled prices: ৳ / BDT / Tk / $ followed by a number.
_CURRENCY_PRICE_RE = re.compile(
    r"(?:\u09f3|\u09f9|\bBDT\b|\bTk\.?|\bTaka\b|\$)\s*(\d[\d.,]*)",
    re.IGNORECASE,
)

# Plain number at the very end of a line (optionally after a separator that is
# itself preceded by whitespace/start): "Dal 1kg - 120". Requiring the space
# keeps SKU-ish tokens like "CO-778" from being read as prices.
_TRAILING_PRICE_RE = re.compile(
    r"(?:^|(?<=[\s(]))[-–—:=/,]?\s*(\d+(?:[.,]\d{1,2})?)\s*$"
)

# SKU from an explicit prefix (SKU:/Code:/Item Code:...) or a standalone
# alphanumeric token of 4-12 chars that mixes letters and digits.
_SKU_PREFIX_RE = re.compile(
    r"\b(?:SKU|Code|Item\s*Code|Product\s*Code|Prod\s*Code)\s*[:#=\-]?\s*([A-Za-z0-9][A-Za-z0-9\-]{3,11})\b",
    re.IGNORECASE,
)
_SKU_STANDALONE_RE = re.compile(r"\b(?=[A-Za-z0-9\-]*\d)(?=[A-Za-z0-9\-]*[A-Za-z])[A-Za-z0-9\-]{4,12}\b")

# Unit keywords mapped to canonical POS units.
_UNIT_ALIASES = {
    "kg": "kg", "kgs": "kg", "kilo": "kg", "kilos": "kg",
    "lb": "lb", "lbs": "lb", "pound": "lb", "pounds": "lb",
    "piece": "piece", "pieces": "piece", "pc": "piece",
    "pcs": "pcs",
    "ml": "ml", "milliliter": "ml", "millilitre": "ml",
    "l": "L", "liter": "L", "liters": "L", "litre": "L", "litres": "L",
    "oz": "oz", "ounce": "oz", "ounces": "oz",
}
_UNIT_RE = re.compile(
    r"(?:(?<=\d)|\b)(kg|kgs|kilos?|lbs?|pounds?|pieces?|pcs|millilit(?:er|re)s?|ml|"
    r"lit(?:er|re)s?|ounces?|oz|l)(?![A-Za-z0-9])",
    re.IGNORECASE,
)

# Header/footer lines that should never become products.
# Tier 1: standalone invoice/catalog keywords (optionally trailed by numbers,
# e.g. "TOTAL 1,250", "THANK YOU FOR SHOPPING").
_HEADER_LINE_RE = re.compile(
    r"^(?:THANK\s*YOU.*|(?:GRAND\s+)?(?:SUB)?TOTAL(?:S)?|TOTAL|NET\s+TOTAL|VAT|TAX|"
    r"DISCOUNT|INVOICE|RECEIPT)\b[\W\d_.,:/%\s-]*$",
    re.IGNORECASE,
)
# Tier 2: metadata keywords, dropped only when nothing but numbers/punctuation
# follows (so "Date: 12/10/26" dies but "Date Fruits 500g" survives).
_META_LINE_RE = re.compile(
    r"^(?:DATE|TIME|ORDER|BILL|PAGE|QTY|QUANTITY|PRICE|DESCRIPTION|ITEMS?|SL|S/?N|NO\.?)\b"
    r"[\W\d_.,:/#-]*$",
    re.IGNORECASE,
)

# Separators stripped from the cleaned product name.
_NAME_STRIP_CHARS = " \t-–—:=;,./|~*+#!?&()[]{}<>"

# Names that are nothing but a stray currency word ("Tk", "৳") are junk.
_CURRENCY_ONLY_RE = re.compile(r"^(?:৳|৹|\$|Tk\.?|BDT|Taka)$", re.IGNORECASE)


def _parse_price_number(raw: str) -> Optional[float]:
    """Convert a price token like "1,250.50" or "120,00" into a float."""
    text = raw.strip().rstrip(".,")
    if not text:
        return None
    # "1.200,50" / "1,250.50" style: whichever separator comes last is the
    # decimal one, the other is a thousands grouping separator.
    if "," in text and "." in text:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "," in text:
        parts = text.rsplit(",", 1)
        if len(parts) == 2 and len(parts[1]) != 3:
            text = text.replace(",", ".")  # "120,50" -> "120.50"
        else:
            text = text.replace(",", "")   # "1,250" -> "1250"
    try:
        value = float(text)
    except ValueError:
        return None
    return value if value >= 0 else None


def _clean_name(text: str) -> str:
    """Collapse whitespace and strip separators from a product name."""
    name = re.sub(r"\s+", " ", text).strip(_NAME_STRIP_CHARS)
    return re.sub(r"\s+", " ", name).strip()


def _is_junk_line(stripped: str) -> bool:
    """True for empty lines, pure punctuation, and very short noise."""
    if len(stripped) < 2:
        return True
    if re.fullmatch(r"[\W_]+", stripped, re.UNICODE):
        return True
    core = stripped.strip(_NAME_STRIP_CHARS)
    if _HEADER_LINE_RE.match(core) or _META_LINE_RE.match(core):
        return True
    return False


def _extract_barcodes(text: str) -> Tuple[List[str], str]:
    """Find validated barcode tokens; return them plus the text with digit
    runs (>=8) removed so they cannot pollute the product name."""
    barcodes: List[str] = []

    def _replace(match: re.Match) -> str:
        digits = match.group(0)
        if validate_ean13(digits) or validate_upca(digits) or validate_code128(digits):
            barcodes.append(digits)
        return " "

    remaining = _BARCODE_RUN_RE.sub(_replace, text)
    remaining = _LONG_DIGIT_RUN_RE.sub(" ", remaining)
    return barcodes, remaining


def _extract_price(text: str) -> Tuple[Optional[float], str]:
    """Find a price token (currency-labelled first, then trailing plain number)."""
    match = _CURRENCY_PRICE_RE.search(text)
    if match:
        price = _parse_price_number(match.group(1))
        if price is not None:
            remaining = (text[: match.start()] + " " + text[match.end():]).strip()
            return price, remaining

    match = _TRAILING_PRICE_RE.search(text)
    if match:
        price = _parse_price_number(match.group(1))
        if price is not None:
            remaining = text[: match.start()].strip()
            return price, remaining

    return None, text


def _extract_sku(text: str) -> Tuple[Optional[str], str]:
    """Find an SKU token: prefixed (SKU:/Code:) or a standalone 4-12 char
    alphanumeric that mixes letters and digits (unit quantities excluded)."""
    match = _SKU_PREFIX_RE.search(text)
    if match:
        sku = match.group(1).strip("-")
        remaining = (text[: match.start()] + " " + text[match.end():]).strip()
        return sku, remaining

    for match in _SKU_STANDALONE_RE.finditer(text):
        token = match.group(0)
        # Skip things like "1000ml" or "500gm" - those are quantities, not SKUs.
        if re.fullmatch(r"\d+(?:[.,]\d+)?(kg|kgs|lb|lbs|ml|l|oz|pcs?|g|gm|grams?)", token, re.IGNORECASE):
            continue
        sku = token.strip("-")
        remaining = (text[: match.start()] + " " + text[match.end():]).strip()
        return sku, remaining

    return None, text


def _extract_unit(text: str) -> Optional[str]:
    """Match a unit keyword (kg/lb/piece/pcs/L/ml/oz...) and canonicalize it."""
    for match in _UNIT_RE.finditer(text):
        canonical = _UNIT_ALIASES.get(match.group(1).lower())
        if canonical:
            return canonical
    return None


def parse_line(line: str) -> Optional[Dict[str, Any]]:
    """Parse one OCR/PDF text line into a product candidate dict or None."""
    stripped = line.strip()
    if not stripped or _is_junk_line(stripped):
        return None

    barcodes, working = _extract_barcodes(stripped)
    price, working = _extract_price(working)
    sku, working = _extract_sku(working)
    unit = _extract_unit(stripped)
    name = _clean_name(working)

    if len(name) < 2:
        return None
    # A "product" that is only punctuation or digits after cleaning is junk.
    if re.fullmatch(r"[\W\d_.,\s-]+", name, re.UNICODE):
        return None
    # Same for stray currency words ("Tk", "৳").
    if _CURRENCY_ONLY_RE.match(name):
        return None

    return {
        "name": name,
        "sku": sku,
        "price": price,
        "unit": unit,
        "barcodes": barcodes,
    }


def parse_product_text(text: str) -> List[Dict[str, Any]]:
    """Split raw OCR/PDF text into product candidates, dropping junk lines."""
    products: List[Dict[str, Any]] = []
    for line in (text or "").splitlines():
        candidate = parse_line(line)
        if candidate:
            products.append(candidate)
    return products


def extract_pdf_text(data: bytes) -> str:
    """Extract embedded text from PDF bytes using pypdf (lazy import).

    Returns "" for scanned PDFs without an embedded text layer; the caller is
    expected to surface a clear error instead of silently OCR-ing rendered
    pages (rendering is out of scope).
    """
    import io

    from pypdf import PdfReader  # lazy: keeps this module importable without pypdf

    reader = PdfReader(io.BytesIO(data))
    pages: List[str] = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:
            pages.append("")
    return "\n".join(pages)
