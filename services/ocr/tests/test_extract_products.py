"""
API Tests for POST /api/v1/extract-products
===========================================

Endpoint-level tests that never load TrOCR/torch: the rate limiter is
stubbed and OCRService is mocked. Covers the response contract, the
scanned-PDF (no embedded text) error path, content-type validation, and
the optional X-API-Key auth on the shared placeholder dependency.
"""

import io
from typing import Optional

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import api as api_module
from app.api.v1.api import api_router
from app.models.schemas import OCRResult
from app.services.ocr_service import OCRService

ENDPOINT = "/api/v1/extract-products"


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


class TestExtractProductsImageMode:
    def test_contract_shape_and_values(self, client, monkeypatch):
        _stub_ocr_service(
            monkeypatch,
            "Rice Miniket 5kg - ৳520\nTOTAL ৳1,250\nDal 1kg - 120\n----",
        )

        response = client.post(
            ENDPOINT,
            files={"file": ("catalog.png", b"fake-png-bytes", "image/png")},
        )

        assert response.status_code == 200, response.text
        body = response.json()
        assert set(body.keys()) == {"products", "raw_text", "engine", "count"}
        assert body["engine"] == "mock-trocr"
        assert body["count"] == 2
        assert body["raw_text"].startswith("Rice Miniket")

        product = body["products"][0]
        assert set(product.keys()) == {"name", "sku", "price", "unit", "barcodes"}
        assert product["name"] == "Rice Miniket 5kg"
        assert product["price"] == 520.0
        assert product["unit"] == "kg"
        assert product["sku"] is None
        assert product["barcodes"] == []

    def test_webp_and_tiff_accepted(self, client, monkeypatch):
        _stub_ocr_service(monkeypatch, "Tea Leaf 250g")

        for content_type in ("image/webp", "image/tiff", "image/jpeg", "image/jpg"):
            response = client.post(
                ENDPOINT,
                files={"file": ("scan.img", b"bytes", content_type)},
            )
            assert response.status_code == 200, content_type


class TestExtractProductsPdfMode:
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
        monkeypatch.setattr(
            api_module,
            "extract_pdf_text",
            lambda data: "Soybean Oil 900ml Tk 210.50\nTHANK YOU FOR SHOPPING",
        )

        response = client.post(
            ENDPOINT,
            files={"file": ("catalog.pdf", b"%PDF-1.4 fake", "application/pdf")},
        )

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["engine"] == "pypdf"
        assert body["count"] == 1
        assert body["products"][0]["price"] == 210.5


class TestExtractProductsValidation:
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
            "/api/v1/extract-products",
            files={"file": ("catalog.png", b"fake-png-bytes", "image/png")},
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
        _stub_ocr_service(monkeypatch, "Tea Leaf 250g")
        response = self._post(client, {"X-API-Key": "s3cret"})
        assert response.status_code == 200

    def test_permissive_when_unset(self, client, monkeypatch):
        monkeypatch.setattr(api_module.settings, "OCR_API_KEY", None)
        _stub_ocr_service(monkeypatch, "Tea Leaf 250g")
        assert self._post(client).status_code == 200
