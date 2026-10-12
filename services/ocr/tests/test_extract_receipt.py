"""
API Tests for POST /api/v1/extract-receipt
==========================================

Endpoint-level tests mirroring test_extract_products.py: the rate limiter
is stubbed and OCRService is mocked so torch/tesseract are never loaded.
Covers the snake_case response contract, the scanned-PDF (no embedded
text) error path, content-type validation, and the optional X-API-Key
auth on the shared placeholder dependency.
"""

import io

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import api as api_module
from app.api.v1.api import api_router
from app.models.schemas import OCRResult
from app.services.ocr_service import OCRService

ENDPOINT = "/api/v1/extract-receipt"

RECEIPT_TEXT = (
    "RAHMAN TRADERS\n"
    "Tax Invoice\n"
    "Date: 26-10-2026\n"
    "Cola 500ml   3   25   75\n"
    "VAT @ 5%: 15\n"
    "Grand Total: 90\n"
)

RESPONSE_FIELDS = {
    "vendor", "document_date", "currency", "subtotal", "discount",
    "tax", "total", "items", "raw_text", "engine",
}


class _StubOCRService:
    """Minimal stand-in for OCRService that returns canned text."""

    def __init__(self, text: str, model_used: str = "mock-trocr"):
        self._text = text
        self._model_used = model_used

    async def process_image(self, request) -> OCRResult:
        return OCRResult(
            id="stub-result",
            text=self._text,
            confidence=0.9,
            structured={},
            barcodes=[],
            processing_time_ms=5,
            model_used=self._model_used,
        )


def _make_client() -> TestClient:
    # Built without a context manager on purpose: the app lifespan (DB,
    # Redis, model loading) must never run in these tests.
    app = FastAPI()
    app.include_router(api_router, prefix="/api/v1")
    return TestClient(app)


@pytest.fixture()
def client(monkeypatch):
    async def _allow(*args, **kwargs):
        return True

    monkeypatch.setattr(api_module, "check_rate_limit", _allow)
    monkeypatch.setattr(api_module, "increment_rate_limit", _allow)
    return _make_client()


def _stub_ocr_service(monkeypatch, text: str) -> None:
    stub = _StubOCRService(text)
    monkeypatch.setattr(OCRService, "get_instance", classmethod(lambda cls: stub))


def _blank_pdf_bytes() -> bytes:
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


class TestExtractReceiptImageMode:
    def test_contract_shape_and_values(self, client, monkeypatch):
        _stub_ocr_service(monkeypatch, RECEIPT_TEXT)

        response = client.post(
            ENDPOINT,
            files={"file": ("receipt.png", b"fake-png-bytes", "image/png")},
        )

        assert response.status_code == 200, response.text
        body = response.json()
        assert set(body.keys()) == RESPONSE_FIELDS
        assert body["engine"] == "mock-trocr"
        assert body["vendor"] == "RAHMAN TRADERS"
        assert body["document_date"] == "2026-10-26"
        assert body["currency"] == "BDT"
        assert body["tax"] == 15.0
        assert body["total"] == 90.0
        assert body["raw_text"].startswith("RAHMAN TRADERS")

        item = body["items"][0]
        assert set(item.keys()) == {"name", "qty", "unit_price", "line_total"}
        assert item["name"] == "Cola 500ml"
        assert item["qty"] == 3.0
        assert item["unit_price"] == 25.0
        assert item["line_total"] == 75.0

    def test_empty_ocr_text_returns_null_fields(self, client, monkeypatch):
        _stub_ocr_service(monkeypatch, "")

        response = client.post(
            ENDPOINT,
            files={"file": ("receipt.jpg", b"fake-jpeg-bytes", "image/jpeg")},
        )

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["vendor"] is None
        assert body["total"] is None
        assert body["items"] == []

    def test_webp_tiff_jpg_accepted(self, client, monkeypatch):
        _stub_ocr_service(monkeypatch, RECEIPT_TEXT)

        for content_type in ("image/webp", "image/tiff", "image/jpg"):
            response = client.post(
                ENDPOINT,
                files={"file": ("scan.img", b"bytes", content_type)},
            )
            assert response.status_code == 200, content_type


class TestExtractReceiptPdfMode:
    def test_scanned_pdf_without_text_layer_returns_clear_error(self, client):
        response = client.post(
            ENDPOINT,
            files={"file": ("scan.pdf", _blank_pdf_bytes(), "application/pdf")},
        )

        assert response.status_code == 400
        detail = response.json()["detail"].lower()
        assert "no embedded text" in detail
        assert "image" in detail  # tells the caller to use image mode

    def test_pdf_with_text_is_parsed(self, client, monkeypatch):
        monkeypatch.setattr(api_module, "extract_pdf_text", lambda data: RECEIPT_TEXT)

        response = client.post(
            ENDPOINT,
            files={"file": ("receipt.pdf", b"%PDF-1.4 fake", "application/pdf")},
        )

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["engine"] == "pypdf"
        assert set(body.keys()) == RESPONSE_FIELDS
        assert body["vendor"] == "RAHMAN TRADERS"
        assert body["total"] == 90.0

    def test_field_names_are_snake_case(self, client, monkeypatch):
        monkeypatch.setattr(api_module, "extract_pdf_text", lambda data: RECEIPT_TEXT)

        response = client.post(
            ENDPOINT,
            files={"file": ("receipt.pdf", b"%PDF-1.4 fake", "application/pdf")},
        )

        assert response.status_code == 200
        for key in response.json().keys():
            assert key == key.lower()
            assert " " not in key
            assert any(ch.islower() or ch == "_" for ch in key)
        assert "document_date" in response.json()
        assert "unit_price" in response.json()["items"][0]


class TestExtractReceiptValidation:
    def test_rejects_unsupported_content_type(self, client):
        response = client.post(
            ENDPOINT,
            files={"file": ("notes.txt", b"hello", "text/plain")},
        )
        assert response.status_code == 400

    def test_missing_file_returns_422(self, client):
        response = client.post(ENDPOINT)
        assert response.status_code == 422


class TestApiKeyAuth:
    def _post(self, client, headers=None):
        return client.post(
            ENDPOINT,
            files={"file": ("receipt.png", b"fake-png-bytes", "image/png")},
            headers=headers or {},
        )

    def test_missing_key_rejected_when_configured(self, client, monkeypatch):
        monkeypatch.setattr(api_module.settings, "OCR_API_KEY", "s3cret")
        assert self._post(client).status_code == 401

    def test_wrong_key_rejected_when_configured(self, client, monkeypatch):
        monkeypatch.setattr(api_module.settings, "OCR_API_KEY", "s3cret")
        assert self._post(client, {"X-API-Key": "nope"}).status_code == 401

    def test_correct_key_accepted_when_configured(self, client, monkeypatch):
        monkeypatch.setattr(api_module.settings, "OCR_API_KEY", "s3cret")
        _stub_ocr_service(monkeypatch, RECEIPT_TEXT)
        response = self._post(client, {"X-API-Key": "s3cret"})
        assert response.status_code == 200

    def test_permissive_when_unset(self, client, monkeypatch):
        monkeypatch.setattr(api_module.settings, "OCR_API_KEY", None)
        _stub_ocr_service(monkeypatch, RECEIPT_TEXT)
        assert self._post(client).status_code == 200
