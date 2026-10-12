"""
Pydantic Models for OCR API
==========================

Request and response models for the OCR service API.
Defines the contract between clients and the OCR server.
"""

from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field, field_validator
from enum import Enum
import time
import uuid


class OCRType(str, Enum):
    """Supported OCR processing types."""
    PRODUCT = "product"
    RECEIPT = "receipt"
    INVOICE = "invoice"
    BARCODE = "barcode"


class ProcessingStatus(str, Enum):
    """OCR job processing status."""
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class OCRRequest(BaseModel):
    """Base OCR processing request."""

    shop_id: str = Field(..., description="Shop identifier for multi-tenant isolation")
    user_id: str = Field(..., description="User identifier for access control")
    ocr_type: OCRType = Field(default=OCRType.PRODUCT, description="Type of OCR processing")
    confidence_threshold: float = Field(
        default=0.8,
        ge=0.0,
        le=1.0,
        description="Minimum confidence threshold for results"
    )
    extract_barcodes: bool = Field(default=True, description="Whether to detect barcodes")
    language: str = Field(default="en", description="Language for OCR processing")

    # File information (populated by API layer)
    image_path: str = Field(..., description="Path to image file")
    file_size: int = Field(..., description="File size in bytes")
    filename: str = Field(..., description="Original filename")


class OCRResult(BaseModel):
    """OCR processing result."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique result identifier")
    text: str = Field(..., description="Extracted text content")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score (0.0-1.0)")
    structured: Dict[str, Any] = Field(default_factory=dict, description="Structured data fields")
    barcodes: List[Dict[str, Any]] = Field(default_factory=list, description="Detected barcodes")

    # Performance metrics
    processing_time_ms: int = Field(..., description="Processing time in milliseconds")
    model_used: str = Field(..., description="OCR model/engine used")

    # Error information
    error: Optional[str] = Field(None, description="Error message if processing failed")

    # Timestamps
    created_at: float = Field(default_factory=time.time, description="Result creation timestamp")

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for caching."""
        return {
            "id": self.id,
            "text": self.text,
            "confidence": self.confidence,
            "structured": self.structured,
            "barcodes": self.barcodes,
            "processing_time_ms": self.processing_time_ms,
            "model_used": self.model_used,
            "error": self.error,
            "created_at": self.created_at
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'OCRResult':
        """Create instance from dictionary."""
        return cls(**data)

    @property
    def is_successful(self) -> bool:
        """Check if processing was successful."""
        return self.error is None and self.confidence >= 0.5


class OCRError(Exception):
    """OCR exception for error handling."""
    
    def __init__(self, code: str, message: str, details: Optional[Dict[str, Any]] = None):
        self.code = code
        self.message = message
        self.details = details or {}
        super().__init__(f"[{code}] {message}")


class OCRErrorResponse(BaseModel):
    """OCR error response model for API responses."""

    code: str = Field(..., description="Error code")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")

    @classmethod
    def from_exception(cls, error: OCRError) -> 'OCRErrorResponse':
        """Create error response from exception."""
        return cls(
            code=error.code,
            message=error.message,
            details=error.details
        )
    
    @classmethod
    def from_error(cls, error_code: str, message: str, details: Optional[Dict] = None) -> 'OCRErrorResponse':
        """Create error response from error details."""
        return cls(
            code=error_code,
            message=message,
            details=details or {}
        )


class BarcodeInfo(BaseModel):
    """Barcode detection result."""

    type: str = Field(..., description="Barcode type (QR_CODE, EAN_13, etc.)")
    value: str = Field(..., description="Decoded barcode value")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence")
    bounding_box: Dict[str, int] = Field(..., description="Bounding box coordinates")

    @field_validator('type')
    @classmethod
    def validate_barcode_type(cls, v):
        """Validate barcode type."""
        valid_types = ['QR_CODE', 'EAN_13', 'UPC_A', 'CODE_128', 'DATA_MATRIX', 'PDF417']
        if v not in valid_types:
            raise ValueError(f'Invalid barcode type. Must be one of: {valid_types}')
        return v


class BatchOCRRequest(BaseModel):
    """Batch OCR processing request."""

    images: List[OCRRequest] = Field(..., min_length=1, max_length=10, description="Images to process")
    priority: str = Field(default="normal", description="Processing priority")

    @field_validator('images')
    @classmethod
    def validate_image_count(cls, v):
        """Validate number of images."""
        if len(v) > 10:
            raise ValueError("Maximum 10 images per batch")
        return v


class BatchOCRResponse(BaseModel):
    """Batch OCR processing response."""

    batch_id: str = Field(..., description="Unique batch identifier")
    total_images: int = Field(..., description="Total number of images")
    processed_images: int = Field(..., description="Number of successfully processed images")
    results: List[OCRResult] = Field(..., description="Individual processing results")
    processing_time_ms: int = Field(..., description="Total batch processing time")

    @property
    def successful_results(self) -> List[OCRResult]:
        """Get only successful results."""
        return [r for r in self.results if r.is_successful]

    @property
    def failed_results(self) -> List[OCRResult]:
        """Get only failed results."""
        return [r for r in self.results if not r.is_successful]


class AsyncOCRRequest(BaseModel):
    """Asynchronous OCR processing request."""

    shop_id: str = Field(..., description="Shop identifier")
    user_id: str = Field(..., description="User identifier")
    image_url: str = Field(..., description="URL to image file")
    ocr_type: OCRType = Field(default=OCRType.PRODUCT, description="OCR processing type")
    confidence_threshold: float = Field(default=0.8, ge=0.0, le=1.0)
    extract_barcodes: bool = Field(default=True)
    language: str = Field(default="en")
    callback_url: Optional[str] = Field(None, description="URL to call when processing completes")


class AsyncOCRStatus(BaseModel):
    """Asynchronous OCR job status."""

    job_id: str = Field(..., description="Job identifier")
    status: ProcessingStatus = Field(..., description="Current job status")
    progress_percentage: int = Field(default=0, ge=0, le=100, description="Processing progress")
    estimated_time_seconds: Optional[int] = Field(None, description="Estimated completion time")
    result: Optional[OCRResult] = Field(None, description="Processing result if completed")
    error: Optional[OCRErrorResponse] = Field(None, description="Error information if failed")


class HealthStatus(BaseModel):
    """Service health status."""

    status: str = Field(..., description="Overall service status")
    version: str = Field(..., description="Service version")
    uptime_seconds: int = Field(..., description="Service uptime")
    models_loaded: List[str] = Field(..., description="Loaded OCR models")
    database: Dict[str, Any] = Field(..., description="Database health")
    redis: Dict[str, Any] = Field(..., description="Redis health")
    ocr_service: Dict[str, Any] = Field(..., description="OCR service health")


class MetricsResponse(BaseModel):
    """Service metrics response."""

    total_requests: int = Field(..., description="Total requests processed")
    successful_requests: int = Field(..., description="Successful requests")
    failed_requests: int = Field(..., description="Failed requests")
    average_processing_time_ms: float = Field(..., description="Average processing time")
    model_accuracy: Dict[str, float] = Field(..., description="Model accuracy by field")
    errors_by_type: Dict[str, int] = Field(..., description="Errors by type")
    queue_status: Dict[str, int] = Field(..., description="Queue status")
    uptime_seconds: int = Field(..., description="Service uptime")


class UploadResponse(BaseModel):
    """File upload response."""

    filename: str = Field(..., description="Uploaded filename")
    file_size: int = Field(..., description="File size in bytes")
    image_url: str = Field(..., description="URL to access uploaded image")
    content_type: str = Field(..., description="MIME content type")
    uploaded_at: float = Field(default_factory=time.time, description="Upload timestamp")


class ExtractedProduct(BaseModel):
    """Product candidate extracted from catalog text.

    Contract consumed by the NestJS server during catalog onboarding:
    name/sku/price/unit/barcodes must not change shape.
    """

    name: str = Field(..., description="Cleaned product name (line minus barcode/price tokens)")
    sku: Optional[str] = Field(None, description="Existing SKU token if present, else null (server assigns)")
    price: Optional[float] = Field(None, description="Extracted price value, null if not found")
    unit: Optional[str] = Field(None, description="Canonical unit (kg/lb/piece/pcs/L/ml/oz) if matched, else null")
    barcodes: List[str] = Field(default_factory=list, description="Validated barcode-like tokens found on the line")


class ExtractProductsResponse(BaseModel):
    """Structured product extraction response."""

    products: List[ExtractedProduct] = Field(..., description="Extracted product candidates")
    raw_text: str = Field(..., description="Raw text produced by OCR/PDF extraction")
    engine: str = Field(..., description="Text extraction engine used (model name or 'pypdf')")
    count: int = Field(..., description="Number of product candidates extracted")


class ReceiptItem(BaseModel):
    """Line item digitized from a receipt/invoice.

    Contract consumed by the NestJS server during receipt digitization:
    name/qty/unit_price/line_total must not change shape.
    """

    name: str = Field(..., description="Item description (line minus trailing numbers)")
    qty: Optional[float] = Field(None, description="Positive quantity if identified, else null")
    unit_price: Optional[float] = Field(None, description="Unit/rate price if identified, else null")
    line_total: Optional[float] = Field(None, description="Line total amount if identified, else null")


class ExtractReceiptResponse(BaseModel):
    """Structured receipt/invoice digitization response."""

    vendor: Optional[str] = Field(None, description="Business name (keyword-preferred top line)")
    document_date: Optional[str] = Field(None, description="Document date as ISO YYYY-MM-DD if found")
    currency: Optional[str] = Field(None, description="Detected currency code (BDT/USD/EUR), null if no money")
    subtotal: Optional[float] = Field(None, description="Subtotal amount if labelled, else null")
    discount: Optional[float] = Field(None, description="Discount amount if labelled, else null")
    tax: Optional[float] = Field(None, description="Tax/VAT/GST amount if labelled, else null")
    total: Optional[float] = Field(None, description="Last (grand) total amount if labelled, else null")
    items: List[ReceiptItem] = Field(..., description="Digitized line items")
    raw_text: str = Field(..., description="Raw text produced by OCR/PDF extraction")
    engine: str = Field(..., description="Text extraction engine used (model name or 'pypdf')")


class WebSocketMessage(BaseModel):
    """WebSocket message format."""

    type: str = Field(..., description="Message type")
    job_id: str = Field(..., description="Job identifier")
    data: Dict[str, Any] = Field(..., description="Message data")
    timestamp: float = Field(default_factory=time.time, description="Message timestamp")


class WebSocketEventType(str, Enum):
    """WebSocket event types."""

    JOB_QUEUED = "job_queued"
    JOB_STARTED = "job_started"
    JOB_PROGRESS = "job_progress"
    JOB_COMPLETED = "job_completed"
    JOB_FAILED = "job_failed"
    ERROR = "error"
