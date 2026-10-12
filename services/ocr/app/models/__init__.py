"""
Data Models for OCR Server
=========================

Pydantic models and SQLAlchemy schemas for OCR processing.
"""

from .schemas import (
    OCRRequest, OCRResult, OCRError,
    BatchOCRRequest, BatchOCRResponse,
    AsyncOCRRequest, AsyncOCRStatus,
    HealthStatus, MetricsResponse,
    UploadResponse, WebSocketMessage,
    OCRType, ProcessingStatus, WebSocketEventType
)

__all__ = [
    "OCRRequest", "OCRResult", "OCRError",
    "BatchOCRRequest", "BatchOCRResponse",
    "AsyncOCRRequest", "AsyncOCRStatus",
    "HealthStatus", "MetricsResponse",
    "UploadResponse", "WebSocketMessage",
    "OCRType", "ProcessingStatus", "WebSocketEventType"
]
























