"""
Unit Tests for app.services.product_parser
==========================================

Pure-function tests: no OCR engines, no torch, no network.
Covers barcode check digits (EAN-13 / UPC-A / Code128), BDT price tokens
(৳120, Tk 250.00, $2.5, trailing plain decimals), SKU detection, unit
matching, and junk/header filtering on realistic messy catalog text.
"""

from app.services.product_parser import (
    extract_pdf_text,
    parse_line,
    parse_product_text,
    validate_code128,
    validate_ean13,
    validate_upca,
)


class TestBarcodeValidators:
    def test_ean13_valid(self):
        # Classic EAN-13 sample; check digit 1 = (10 - 123 % 10) % 10 for body 400638133393
        assert validate_ean13("4006381333931") is True

    def test_ean13_valid_bd_prefix(self):
        # Body 880123456789 -> weighted sum 127 -> check digit 3
        assert validate_ean13("8801234567893") is True

    def test_ean13_invalid_checksum(self):
        assert validate_ean13("4006381333930") is False

    def test_ean13_wrong_length(self):
        assert validate_ean13("400638133393") is False
        assert validate_ean13("40063813339312") is False

    def test_ean13_non_digits(self):
        assert validate_ean13("400638133393X") is False

    def test_upca_valid(self):
        # Body 03600029145 -> weighted sum 58 -> check digit 2
        assert validate_upca("036000291452") is True

    def test_upca_invalid_checksum(self):
        assert validate_upca("036000291453") is False

    def test_code128_valid_numeric(self):
        # 9-digit payload, body 12345678 -> sum 76 -> check digit 4
        assert validate_code128("123456784") is True

    def test_code128_invalid_checksum(self):
        assert validate_code128("123456785") is False

    def test_code128_excludes_ean_upc_lengths(self):
        assert validate_code128("8801234567893") is False  # 13 -> EAN-13 domain
        assert validate_code128("036000291452") is False   # 12 -> UPC-A domain

    def test_code128_out_of_range(self):
        assert validate_code128("1234567") is False        # 7 digits
        assert validate_code128("1" * 17) is False         # 17 digits


class TestParseLine:
    def test_bdt_symbol_price_line(self):
        result = parse_line("Rice Miniket 5kg - ৳520")
        assert result == {
            "name": "Rice Miniket 5kg",
            "sku": None,
            "price": 520.0,
            "unit": "kg",
            "barcodes": [],
        }

    def test_dal_style_trailing_plain_price(self):
        result = parse_line("Dal 1kg - 120")
        assert result["name"] == "Dal 1kg"
        assert result["price"] == 120.0
        assert result["unit"] == "kg"
        assert result["sku"] is None
        assert result["barcodes"] == []

    def test_tk_currency_decimal_price(self):
        result = parse_line("Soybean Oil 900ml Tk 210.50")
        assert result["price"] == 210.5
        assert result["unit"] == "ml"
        assert result["name"] == "Soybean Oil 900ml"

    def test_thousands_comma_price(self):
        result = parse_line("Imported Butter 500g $1,250.00")
        assert result["price"] == 1250.0

    def test_european_comma_decimal_price(self):
        result = parse_line("Local Tea 250g - 45,50")
        assert result["price"] == 45.5

    def test_valid_ean13_reported_and_stripped_from_name(self):
        result = parse_line("Sugar 1kg 8801234567893 ৳120")
        assert result["barcodes"] == ["8801234567893"]
        assert result["price"] == 120.0
        assert result["name"] == "Sugar 1kg"
        assert "8801234567893" not in result["name"]

    def test_invalid_ean13_not_reported_but_stripped(self):
        result = parse_line("Bad Barcode Line Milk 2L 4006381333930")
        assert result["barcodes"] == []
        assert "4006381333930" not in result["name"]
        assert result["unit"] == "L"

    def test_upca_and_dollar_price(self):
        result = parse_line("Salt (Iodized) piece 4006381333931 $2.5")
        assert result["barcodes"] == ["4006381333931"]
        assert result["price"] == 2.5
        assert result["unit"] == "piece"

    def test_code128_candidate(self):
        result = parse_line("Coconut Oil 1L Code CO-778 123456784")
        assert result["sku"] == "CO-778"
        assert result["barcodes"] == ["123456784"]
        assert result["unit"] == "L"
        # "-778" inside the SKU must NOT be mistaken for a trailing price
        assert result["price"] is None

    def test_sku_prefix(self):
        result = parse_line("Mung Bean SKU: MB-2024 500g - 95.50")
        assert result["sku"] == "MB-2024"
        assert result["price"] == 95.5
        assert result["name"] == "Mung Bean 500g"

    def test_standalone_alnum_sku(self):
        result = parse_line("Panel Board XH-4402 white 650")
        assert result["sku"] == "XH-4402"
        assert result["price"] == 650.0

    def test_quantity_token_not_mistaken_for_sku(self):
        result = parse_line("Fanta 1000ml - 60")
        assert result["sku"] is None
        assert result["price"] == 60.0
        assert result["unit"] == "ml"

    def test_unit_variants(self):
        assert parse_line("Onion 2pcs - 60")["unit"] == "pcs"
        assert parse_line("Beef 1lb - 800")["unit"] == "lb"
        assert parse_line("Shirt piece 500")["unit"] == "piece"
        assert parse_line("Butter 8oz 350")["unit"] == "oz"
        assert parse_line("Water")["unit"] is None

    def test_name_only_line_is_candidate(self):
        result = parse_line("Tea Leaf 250g")
        assert result["name"] == "Tea Leaf 250g"
        assert result["price"] is None

    def test_junk_lines_dropped(self):
        assert parse_line("") is None
        assert parse_line("X") is None
        assert parse_line("-----") is None
        assert parse_line("=====") is None
        assert parse_line("120") is None            # price with no name
        assert parse_line("Tk") is None             # stray currency word
        assert parse_line("A") is None              # <2 name chars

    def test_header_and_footer_lines_dropped(self):
        assert parse_line("TOTAL 1,250") is None
        assert parse_line("Subtotal: 1250") is None
        assert parse_line("GRAND TOTAL ৳3,400.00") is None
        assert parse_line("VAT 5%") is None
        assert parse_line("Date: 12/10/2026") is None
        assert parse_line("THANK YOU FOR SHOPPING") is None
        assert parse_line("PAGE 2") is None

    def test_meta_like_product_names_survive(self):
        # "Date" is a metadata keyword but "Date Fruits" is a real product.
        result = parse_line("Date Fruits 500g - 80")
        assert result is not None
        assert result["name"] == "Date Fruits 500g"
        assert result["price"] == 80.0


class TestParseProductText:
    MESSY_CATALOG = "\n".join([
        "ZAK General Store",
        "-----------------",
        "Date: 12/10/2026",
        "Rice Miniket 5kg - ৳520",
        "Dal 1kg - 120",
        "Soybean Oil 900ml Tk 210.50",
        "Sugar 1kg 8801234567893 ৳120",
        "Mung Bean SKU: MB-2024 500g - 95.50",
        "Biscuit 10 pcs - 250",
        "TOTAL ৳1,250.00",
        "THANK YOU FOR SHOPPING",
        "X",
        "===",
    ])

    def test_full_catalog_extraction(self):
        products = parse_product_text(self.MESSY_CATALOG)
        names = [p["name"] for p in products]
        assert "Rice Miniket 5kg" in names
        assert "Dal 1kg" in names
        assert "Soybean Oil 900ml" in names
        assert "Sugar 1kg" in names
        assert "Mung Bean 500g" in names
        assert "Biscuit 10 pcs" in names
        # Junk/header/footer lines must not appear
        assert "X" not in names
        assert not any("TOTAL" in n for n in names)
        assert not any("THANK" in n for n in names)
        assert not any("---" in n for n in names)

    def test_contract_keys(self):
        products = parse_product_text("Dal 1kg - 120")
        assert len(products) == 1
        assert set(products[0].keys()) == {"name", "sku", "price", "unit", "barcodes"}

    def test_empty_text(self):
        assert parse_product_text("") == []

    def test_none_text(self):
        assert parse_product_text(None) == []


class TestExtractPdfText:
    def test_pdf_without_text_layer_returns_empty(self):
        from io import BytesIO

        from pypdf import PdfWriter

        writer = PdfWriter()
        writer.add_blank_page(width=612, height=792)
        buffer = BytesIO()
        writer.write(buffer)

        assert extract_pdf_text(buffer.getvalue()) == ""

    def test_invalid_pdf_raises(self):
        import pytest

        with pytest.raises(Exception):
            extract_pdf_text(b"not a pdf at all")
