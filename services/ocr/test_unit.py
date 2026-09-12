"""
Unit Tests for ZakPOS OCR Service Schemas and Data Models
=========================================================
Tests Pydantic models, schemas, and error types.
"""

import unittest
from app.models.schemas import (
    OCRType,
    OCRRequest,
    OCRResult,
    BatchOCRRequest,
    BatchOCRResponse,
    AsyncOCRStatus,
    HealthStatus,
    MetricsResponse,
    UploadResponse,
    OCRError,
)


class TestOCRSchemas(unittest.TestCase):
    def test_ocr_type_enum(self):
        self.assertEqual(OCRType.PRODUCT, 'product')
        self.assertEqual(OCRType.RECEIPT, 'receipt')
        self.assertEqual(OCRType.INVOICE, 'invoice')

    def test_ocr_request_validation(self):
        req = OCRRequest(
            shop_id='shop-123',
            user_id='user-456',
            image_path='/tmp/sample.jpg',
        )
        self.assertEqual(req.shop_id, 'shop-123')
        self.assertEqual(req.user_id, 'user-456')
        self.assertEqual(req.ocr_type, OCRType.PRODUCT)
        self.assertEqual(req.confidence_threshold, 0.8)
        self.assertTrue(req.extract_barcodes)
        self.assertEqual(req.language, 'en')

    def test_ocr_result_creation(self):
        res = OCRResult(
            id='res-1',
            text='Sample Coffee 250g',
            confidence=0.98,
            structured={'product': 'Sample Coffee', 'price': 4.99},
            barcodes=['123456789012'],
            processing_time_ms=35.2,
            model_used='microsoft/trocr-base-stage1',
        )
        self.assertEqual(res.id, 'res-1')
        self.assertEqual(res.confidence, 0.98)
        self.assertEqual(res.structured['price'], 4.99)
        self.assertTrue(res.is_successful)

    def test_batch_ocr_response(self):
        res = OCRResult(
            id='r-1',
            text='Item 1',
            confidence=0.95,
            processing_time_ms=20.0,
            model_used='trocr',
        )
        batch = BatchOCRResponse(
            batch_id='b-1',
            total_images=1,
            processed_images=1,
            results=[res],
            processing_time_ms=20.0,
        )
        self.assertEqual(batch.batch_id, 'b-1')
        self.assertEqual(len(batch.results), 1)

    def test_async_ocr_status(self):
        status = AsyncOCRStatus(
            job_id='job-abc',
            status='processing',
            progress_percentage=50,
            estimated_time_seconds=15,
        )
        self.assertEqual(status.job_id, 'job-abc')
        self.assertEqual(status.progress_percentage, 50)
        self.assertIsNone(status.result)

    def test_health_status(self):
        h = HealthStatus(
            status='healthy',
            version='1.0.0',
            model='trocr',
            database='connected',
            redis='connected',
            ocr_service='ready'
        )
        self.assertEqual(h.status, 'healthy')
        self.assertEqual(h.version, '1.0.0')

    def test_upload_response(self):
        up = UploadResponse(
            filename='scan123.jpg',
            file_size=2048,
            image_url='/api/v1/files/scan123.jpg',
            content_type='image/jpeg'
        )
        self.assertEqual(up.filename, 'scan123.jpg')
        self.assertEqual(up.file_size, 2048)

    def test_ocr_error_exception(self):
        err = OCRError(code='INVALID_IMAGE', message='Corrupted image header')
        self.assertEqual(err.code, 'INVALID_IMAGE')
        self.assertIn('[INVALID_IMAGE]', str(err))


if __name__ == '__main__':
    unittest.main()
