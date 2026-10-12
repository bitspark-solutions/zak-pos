"""
Unit Tests for app.services.receipt_parser
==========================================

Pure-parser tests for receipt/invoice digitization: no FastAPI, no OCR
engines, no IO - only ``parse_receipt_text`` over canned raw text.
"""

from app.services.receipt_parser import parse_receipt_text

SAMPLE_RECEIPT = """RAHMAN TRADERS
Tax Invoice
Shop #12, Dhanmondi, Dhaka
Date: 26-10-2026
Invoice No: INV-2026-0042
--------------------------
Cola 500ml   3   25   75
2x Potato Chips 60
Rice Miniket 5kg @ 520 = 2600
--------------------------
Subtotal: 2735
VAT @ 5%: 136.75
Discount: 35
Grand Total: 2836.75
Thank you, come again!
"""


class TestVendor:
    def test_business_keyword_line_preferred_over_first_line(self):
        result = parse_receipt_text(
            "02-9876543\nDhanmondi Branch\nAL-MADINA STORE\nItem A 2 50 100"
        )
        assert result["vendor"] == "AL-MADINA STORE"

    def test_falls_back_to_first_non_empty_line(self):
        result = parse_receipt_text("Corner Cafe\n\nCola 3 25 75")
        assert result["vendor"] == "Corner Cafe"

    def test_trimmed_to_120_chars(self):
        long_line = "X" * 200
        result = parse_receipt_text(long_line + "\nTotal 10")
        assert result["vendor"] == "X" * 120

    def test_empty_text_returns_all_nulls(self):
        result = parse_receipt_text("")
        assert result["vendor"] is None
        assert result["document_date"] is None
        assert result["currency"] is None
        assert result["subtotal"] is None
        assert result["discount"] is None
        assert result["tax"] is None
        assert result["total"] is None
        assert result["items"] == []

    def test_whitespace_only_text_returns_all_nulls(self):
        result = parse_receipt_text("   \n\t\n  ")
        assert result["vendor"] is None
        assert result["items"] == []


class TestDocumentDate:
    def _date_of(self, text):
        return parse_receipt_text(text)["document_date"]

    def test_iso_date(self):
        assert self._date_of("Store\n2026-10-05\nTotal 500") == "2026-10-05"

    def test_day_first_slashes(self):
        assert self._date_of("Invoice\n26/10/2026\nTotal 500") == "2026-10-26"

    def test_day_first_dashes(self):
        assert self._date_of("Invoice\n26-10-2026\nTotal 500") == "2026-10-26"

    def test_ambiguous_date_prefers_day_first(self):
        # Both parts <= 12: BD receipts are day-first by convention.
        assert self._date_of("Invoice\n05/09/2026\nTotal 500") == "2026-09-05"

    def test_month_first_fallback_when_day_first_impossible(self):
        assert self._date_of("Invoice\n10/25/2026\nTotal 500") == "2026-10-25"

    def test_labelled_date_is_preferred(self):
        assert self._date_of("Billing date 31-12-2025\nTotal 500") == "2025-12-31"

    def test_no_date_returns_none(self):
        assert self._date_of("Cola 25\nTotal 500") is None


class TestCurrency:
    def _currency_of(self, text):
        return parse_receipt_text(text)["currency"]

    def test_taka_symbol(self):
        assert self._currency_of("Store\nTotal: \u09f3500") == "BDT"

    def test_tk_prefix(self):
        assert self._currency_of("Store\nTotal Tk 500") == "BDT"

    def test_bdt_code(self):
        assert self._currency_of("Store\nBDT 500 total") == "BDT"

    def test_dollar_is_usd(self):
        assert self._currency_of("Store\nTotal $12.00") == "USD"

    def test_euro(self):
        assert self._currency_of("Store\nTotal \u20ac80.00") == "EUR"

    def test_defaults_to_bdt_when_amounts_present_without_symbol(self):
        assert self._currency_of("Store\nGrand Total: 500") == "BDT"

    def test_none_without_any_amounts(self):
        assert self._currency_of("Corner Cafe\nSee you again") is None


class TestSummaryAmounts:
    def test_subtotal_label_variants(self):
        for label in ("Subtotal", "Sub Total", "SUB-TOTAL"):
            result = parse_receipt_text(f"Store\n{label}: 450\nTotal: 500")
            assert result["subtotal"] == 450.0, label

    def test_tax_label_variants(self):
        assert parse_receipt_text("Store\nVAT: 22\nTotal 100")["tax"] == 22.0
        assert parse_receipt_text("Store\nGST 22\nTotal 100")["tax"] == 22.0
        assert parse_receipt_text("Store\nTax: 22\nTotal 100")["tax"] == 22.0

    def test_tax_percent_rate_is_ignored_not_the_amount(self):
        result = parse_receipt_text("Store\nVAT @ 5%: 136.75\nGrand Total 2836.75")
        assert result["tax"] == 136.75

    def test_discount_with_currency_symbol_and_commas(self):
        result = parse_receipt_text("Store\nDiscount: \u09f31,250\nTotal 5000")
        assert result["discount"] == 1250.0

    def test_grand_total_last_total_wins(self):
        result = parse_receipt_text(
            "Store\nItem Total 50\nTotal: 500\nVAT: 25\nGrand Total: 525"
        )
        assert result["total"] == 525.0

    def test_amount_due_maps_to_total(self):
        result = parse_receipt_text("Store\nAmount Due: 1,250.50")
        assert result["total"] == 1250.5

    def test_net_total_maps_to_total(self):
        result = parse_receipt_text("Store\nNet Total 940")
        assert result["total"] == 940.0

    def test_subtotal_is_not_a_total(self):
        result = parse_receipt_text("Store\nSubtotal: 450")
        assert result["subtotal"] == 450.0
        assert result["total"] is None

    def test_no_totals_returns_none_fields(self):
        result = parse_receipt_text("Store\nCola 500ml   3   25   75")
        assert result["total"] is None
        assert result["subtotal"] is None
        assert result["tax"] is None
        assert result["discount"] is None


class TestItems:
    def test_qty_at_equals_pattern(self):
        result = parse_receipt_text("Store\n3 x Cola 500ml @ 25 = 75")
        assert result["items"] == [
            {"name": "Cola 500ml", "qty": 3.0, "unit_price": 25.0, "line_total": 75.0}
        ]

    def test_columnar_trailing_numbers(self):
        result = parse_receipt_text("Store\nCola 500ml   3   25   75")
        item = result["items"][0]
        assert item["name"] == "Cola 500ml"
        assert item["qty"] == 3.0
        assert item["unit_price"] == 25.0
        assert item["line_total"] == 75.0

    def test_short_qty_x_single_amount_is_line_total(self):
        result = parse_receipt_text("Store\n2x Milk 60")
        item = result["items"][0]
        assert item["name"] == "Milk"
        assert item["qty"] == 2.0
        assert item["unit_price"] is None
        assert item["line_total"] == 60.0

    def test_at_without_explicit_total_computes_line_total(self):
        result = parse_receipt_text("Store\n4 x Sugar @ 60")
        item = result["items"][0]
        assert item["unit_price"] == 60.0
        assert item["line_total"] == 240.0

    def test_single_amount_without_qty_keeps_name_plus_nulls(self):
        result = parse_receipt_text("Store\nCoke 30")
        assert result["items"] == [
            {"name": "Coke", "qty": None, "unit_price": None, "line_total": None}
        ]

    def test_two_amounts_infer_qty_when_divisible(self):
        result = parse_receipt_text("Store\nBread 25 75")
        item = result["items"][0]
        assert item["qty"] == 3.0
        assert item["unit_price"] == 25.0
        assert item["line_total"] == 75.0

    def test_two_amounts_keep_qty_null_when_not_divisible(self):
        result = parse_receipt_text("Store\nBread 30 100")
        item = result["items"][0]
        assert item["qty"] is None
        assert item["unit_price"] == 30.0
        assert item["line_total"] == 100.0

    def test_summary_and_thanks_lines_are_not_items(self):
        result = parse_receipt_text(SAMPLE_RECEIPT)
        names = [item["name"].lower() for item in result["items"]]
        assert "subtotal" not in " ".join(names)
        assert "vat" not in names
        assert "grand total" not in " ".join(names)
        assert all("thank" not in n for n in names)

    def test_plain_text_lines_are_not_items(self):
        result = parse_receipt_text("Corner Cafe\nDhanmondi Branch\nSee you again")
        assert result["items"] == []

    def test_phone_and_barcode_numbers_are_not_amounts(self):
        result = parse_receipt_text("Store\nHotline 01711223344\n77012345678901 Cola")
        # Long digit runs (phones/barcodes) must not create priced items.
        assert all(i["unit_price"] is None and i["line_total"] is None for i in result["items"])

    def test_items_capped_at_60(self):
        # NOTE: names avoid "Item/Qty/..." keywords: those lines are dropped
        # as column headers by the shared junk-line filter.
        lines = [f"Soda-{i} 2 10 20" for i in range(70)]
        result = parse_receipt_text("Store\n" + "\n".join(lines))
        assert len(result["items"]) == 60

    def test_item_field_shape(self):
        result = parse_receipt_text(SAMPLE_RECEIPT)
        for item in result["items"]:
            assert set(item.keys()) == {"name", "qty", "unit_price", "line_total"}
            assert isinstance(item["name"], str)


class TestFullReceipt:
    def test_digitizes_realistic_bd_invoice(self):
        result = parse_receipt_text(SAMPLE_RECEIPT)
        assert result["vendor"] == "RAHMAN TRADERS"
        assert result["document_date"] == "2026-10-26"
        assert result["currency"] == "BDT"
        assert result["subtotal"] == 2735.0
        assert result["tax"] == 136.75
        assert result["discount"] == 35.0
        assert result["total"] == 2836.75
        assert [i["name"] for i in result["items"]] == [
            "Cola 500ml",
            "Potato Chips",
            "Rice Miniket 5kg",
        ]
        assert result["items"][0]["qty"] == 3.0
