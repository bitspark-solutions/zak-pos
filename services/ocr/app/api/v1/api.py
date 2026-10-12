"""
OCR API Endpoints - v1
=====================

FastAPI routes for OCR processing including synchronous, asynchronous,
and batch operations. All endpoints require authentication and rate limiting.
"""

import time
import uuid
import tempfile
import os
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi import status as http_status
from fastapi.responses import JSONResponse
import structlog

from app.core.config import settings
from app.core.redis import check_rate_limit, increment_rate_limit, get_queue_length
from app.core.monitoring import get_system_health
from app.services.ocr_service import OCRService
from app.services.product_parser import extract_pdf_text, parse_product_text
from app.services.receipt_parser import parse_receipt_text
from app.models.schemas import (
    OCRRequest, OCRResult, BatchOCRRequest, BatchOCRResponse,
    AsyncOCRRequest, AsyncOCRStatus, ExtractProductsResponse, ExtractReceiptResponse,
    HealthStatus,
    MetricsResponse, UploadResponse, OCRError, WebSocketMessage, OCRType
)

# Configure logging
logger = structlog.get_logger(__name__)

# Create API router
api_router = APIRouter()

# Accepted content types for product extraction uploads
EXTRACT_IMAGE_CONTENT_TYPES = {
    "image/png", "image/jpeg", "image/jpg", "image/webp", "image/tiff"
}
EXTRACT_PDF_CONTENT_TYPE = "application/pdf"

# One-shot flag so the permissive-dev warning is logged only once
_dev_mode_warned = False


# Dependency functions
async def get_current_user(x_api_key: Optional[str] = Header(None)) -> Dict[str, str]:
    """Get current user from JWT token (placeholder for now)."""
    global _dev_mode_warned

    # TODO: Implement proper JWT authentication
    if settings.OCR_API_KEY:
        # Shared secret mode: the NestJS server passes X-API-Key.
        if x_api_key != settings.OCR_API_KEY:
            raise HTTPException(
                status_code=http_status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing X-API-Key header"
            )
    elif not _dev_mode_warned:
        _dev_mode_warned = True
        logger.warning(
            "OCR_API_KEY not configured - accepting requests without API key "
            "(permissive development mode)"
        )

    return {"user_id": "temp_user", "shop_id": "temp_shop"}


async def check_rate_limits(user_id: str, shop_id: str) -> None:
    """Check and enforce rate limits."""
    if not await check_rate_limit(user_id, shop_id):
        raise HTTPException(
            status_code=http_status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please try again later."
        )

    await increment_rate_limit(user_id, shop_id)


# Health and monitoring endpoints
@api_router.get("/health", response_model=HealthStatus, tags=["Health"])
async def health_check():
    """Comprehensive health check endpoint."""
    health = await get_system_health()

    if health["status"] != "healthy":
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service unhealthy"
        )

    return health


@api_router.get("/metrics", response_model=MetricsResponse, tags=["Monitoring"])
async def get_metrics():
    """Get service metrics and performance data."""
    # TODO: Implement actual metrics collection
    return MetricsResponse(
        total_requests=0,
        successful_requests=0,
        failed_requests=0,
        average_processing_time_ms=25.0,
        model_accuracy={"overall": 0.95, "product_name": 0.92, "price": 0.98},
        errors_by_type={"model_error": 0, "timeout": 0},
        queue_status=await get_queue_length(),
        uptime_seconds=3600
    )


# Core OCR endpoints
@api_router.post("/process", response_model=OCRResult, tags=["OCR"])
async def process_image(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(..., description="Image file to process"),
    ocr_type: OCRType = Form(OCRType.PRODUCT, description="Type of OCR processing"),
    confidence_threshold: float = Form(0.8, description="Confidence threshold"),
    extract_barcodes: bool = Form(True, description="Extract barcodes"),
    language: str = Form("en", description="Processing language"),
    current_user: Dict = Depends(get_current_user)
):
    """Process a single image synchronously with OCR."""

    # Validate file
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload an image."
        )

    # Check file size
    if image.size > settings.MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=http_status.HTTP_413_PAYLOAD_TOO_LARGE,
            detail=f"File too large. Maximum size is {settings.MAX_IMAGE_SIZE_MB}MB"
        )

    # Check rate limits
    await check_rate_limits(current_user["user_id"], current_user["shop_id"])

    try:
        # Save uploaded file temporarily (cross-platform temp directory)
        temp_dir = tempfile.gettempdir()
        temp_filename = f"temp_{uuid.uuid4()}_{image.filename or 'image'}"
        temp_path = os.path.join(temp_dir, temp_filename)

        with open(temp_path, "wb") as buffer:
            content = await image.read()
            buffer.write(content)

        # Create OCR request
        request = OCRRequest(
            shop_id=current_user["shop_id"],
            user_id=current_user["user_id"],
            ocr_type=ocr_type,
            confidence_threshold=confidence_threshold,
            extract_barcodes=extract_barcodes,
            language=language,
            image_path=temp_path,
            file_size=image.size,
            filename=image.filename
        )

        # Process image
        ocr_service = OCRService.get_instance()
        result = await ocr_service.process_image(request)

        # Clean up temporary file
        background_tasks.add_task(os.remove, temp_path)

        logger.info(
            "OCR request completed",
            user_id=current_user["user_id"],
            shop_id=current_user["shop_id"],
            confidence=result.confidence,
            processing_time_ms=result.processing_time_ms
        )

        return result

    except OCRError as e:
        logger.error("OCR processing failed", error_code=e.code, error_message=e.message, user_id=current_user["user_id"])
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST if e.code in ["FILE_TOO_LARGE", "INVALID_IMAGE"] else http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"[{e.code}] {e.message}"
        )
    except Exception as e:
        logger.error("OCR processing failed", error=str(e), user_id=current_user["user_id"])
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR processing failed: {str(e)}"
        )


@api_router.post("/process/async", response_model=AsyncOCRStatus, tags=["OCR"])
async def process_image_async(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(..., description="Image file to process"),
    ocr_type: OCRType = Form(OCRType.PRODUCT, description="Type of OCR processing"),
    confidence_threshold: float = Form(0.8, description="Confidence threshold"),
    extract_barcodes: bool = Form(True, description="Extract barcodes"),
    language: str = Form("en", description="Processing language"),
    callback_url: str = Form(None, description="Callback URL for completion"),
    current_user: Dict = Depends(get_current_user)
):
    """Process an image asynchronously with OCR."""

    # Similar validation as sync endpoint
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload an image."
        )

    if image.size > settings.MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=http_status.HTTP_413_PAYLOAD_TOO_LARGE,
            detail=f"File too large. Maximum size is {settings.MAX_IMAGE_SIZE_MB}MB"
        )

    await check_rate_limits(current_user["user_id"], current_user["shop_id"])

    try:
        # Save file temporarily (cross-platform temp directory)
        temp_dir = tempfile.gettempdir()
        temp_filename = f"async_{uuid.uuid4()}_{image.filename or 'image'}"
        temp_path = os.path.join(temp_dir, temp_filename)

        with open(temp_path, "wb") as buffer:
            content = await image.read()
            buffer.write(content)

        # Create job record in database
        job_id = str(uuid.uuid4())

        # TODO: Save job to database with QUEUED status

        # Queue for background processing
        background_tasks.add_task(
            process_ocr_job_background,
            job_id,
            temp_path,
            current_user["shop_id"],
            current_user["user_id"],
            ocr_type,
            confidence_threshold,
            extract_barcodes,
            language,
            callback_url
        )

        return AsyncOCRStatus(
            job_id=job_id,
            status="queued",
            progress_percentage=0,
            estimated_time_seconds=30
        )

    except Exception as e:
        logger.error("Async OCR request failed", error=str(e))
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to queue OCR job: {str(e)}"
        )


@api_router.get("/status/{job_id}", response_model=AsyncOCRStatus, tags=["OCR"])
async def get_job_status(job_id: str, current_user: Dict = Depends(get_current_user)):
    """Get the status of an asynchronous OCR job."""

    # TODO: Implement job status lookup from database

    # Placeholder response
    return AsyncOCRStatus(
        job_id=job_id,
        status="completed",
        progress_percentage=100,
        estimated_time_seconds=None,
        result=OCRResult(
            id=str(uuid.uuid4()),
            text="Sample extracted text",
            confidence=0.95,
            structured={"product_name": "Sample Product", "price": 19.99},
            barcodes=[],
            processing_time_ms=45,
            model_used=settings.OCR_MODEL_PRIMARY
        )
    )


@api_router.post("/batch", response_model=BatchOCRResponse, tags=["OCR"])
async def process_batch(
    background_tasks: BackgroundTasks,
    images: List[UploadFile] = File(..., description="Images to process"),
    ocr_type: OCRType = Form(OCRType.PRODUCT, description="Type of OCR processing"),
    confidence_threshold: float = Form(0.8, description="Confidence threshold"),
    extract_barcodes: bool = Form(True, description="Extract barcodes"),
    language: str = Form("en", description="Processing language"),
    priority: str = Form("normal", description="Processing priority"),
    current_user: Dict = Depends(get_current_user)
):
    """Process multiple images in batch."""

    # Validate batch size
    if len(images) > 10:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Maximum 10 images per batch"
        )

    # Validate all files
    for image in images:
        if not image.content_type or not image.content_type.startswith("image/"):
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type: {image.filename}"
            )

        if image.size > settings.MAX_IMAGE_SIZE_MB * 1024 * 1024:
            raise HTTPException(
                status_code=http_status.HTTP_413_PAYLOAD_TOO_LARGE,
                detail=f"File too large: {image.filename}"
            )

    await check_rate_limits(current_user["user_id"], current_user["shop_id"])

    try:
        batch_id = str(uuid.uuid4())
        temp_files = []

        # Save all files temporarily (cross-platform temp directory)
        temp_dir = tempfile.gettempdir()
        for i, image in enumerate(images):
            temp_filename = f"batch_{batch_id}_{i}_{image.filename or f'image_{i}'}"
            temp_path = os.path.join(temp_dir, temp_filename)

            with open(temp_path, "wb") as buffer:
                content = await image.read()
                buffer.write(content)

            temp_files.append(temp_path)

        # Create OCR requests
        requests = []
        for i, (image, temp_path) in enumerate(zip(images, temp_files)):
            requests.append(OCRRequest(
                shop_id=current_user["shop_id"],
                user_id=current_user["user_id"],
                ocr_type=ocr_type,
                confidence_threshold=confidence_threshold,
                extract_barcodes=extract_barcodes,
                language=language,
                image_path=temp_path,
                file_size=image.size,
                filename=image.filename
            ))

        # Process batch
        ocr_service = OCRService.get_instance()
        results = await ocr_service.batch_process(requests)

        # Clean up temporary files
        for temp_path in temp_files:
            background_tasks.add_task(os.remove, temp_path)

        # Calculate total processing time
        total_time = sum(r.processing_time_ms for r in results)

        batch_response = BatchOCRResponse(
            batch_id=batch_id,
            total_images=len(images),
            processed_images=len(results),
            results=results,
            processing_time_ms=total_time
        )

        logger.info(
            "Batch OCR completed",
            batch_id=batch_id,
            total_images=len(images),
            successful=sum(1 for r in results if r.is_successful),
            total_time_ms=total_time
        )

        return batch_response

    except OCRError as e:
        logger.error("Batch OCR failed", error_code=e.code, error_message=e.message, batch_id=batch_id)
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST if e.code in ["FILE_TOO_LARGE", "INVALID_IMAGE"] else http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"[{e.code}] {e.message}"
        )
    except Exception as e:
        logger.error("Batch OCR failed", error=str(e), batch_id=batch_id)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch processing failed: {str(e)}"
        )


@api_router.post("/upload", response_model=UploadResponse, tags=["File Management"])
async def upload_image(
    image: UploadFile = File(..., description="Image file to upload"),
    current_user: Dict = Depends(get_current_user)
):
    """Upload an image file for OCR processing."""

    # Validate file type
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload an image."
        )

    # Check file size
    if image.size > settings.MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=http_status.HTTP_413_PAYLOAD_TOO_LARGE,
            detail=f"File too large. Maximum size is {settings.MAX_IMAGE_SIZE_MB}MB"
        )

    # Check rate limits (stricter for uploads)
    await check_rate_limits(current_user["user_id"], current_user["shop_id"])

    try:
        # Generate unique filename (cross-platform temp directory)
        file_extension = image.filename.split(".")[-1] if image.filename and "." in image.filename else "jpg"
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        temp_dir = tempfile.gettempdir()
        file_path = os.path.join(temp_dir, unique_filename)

        # Save file
        with open(file_path, "wb") as buffer:
            content = await image.read()
            buffer.write(content)

        # Generate accessible URL (in production, upload to S3/MinIO)
        image_url = f"/api/v1/files/{unique_filename}"

        return UploadResponse(
            filename=unique_filename,
            file_size=image.size,
            image_url=image_url,
            content_type=image.content_type
        )

    except Exception as e:
        logger.error("File upload failed", error=str(e), user_id=current_user["user_id"])
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )


@api_router.get("/files/{filename}", tags=["File Management"])
async def get_uploaded_file(filename: str, current_user: Dict = Depends(get_current_user)):
    """Serve uploaded image files."""
    # TODO: Implement file serving with proper authentication
    # For now, return placeholder response
    raise HTTPException(
        status_code=http_status.HTTP_501_NOT_IMPLEMENTED,
        detail="File serving not implemented yet"
    )


# Product extraction endpoint (catalog onboarding)
@api_router.post("/extract-products", response_model=ExtractProductsResponse, tags=["OCR"])
async def extract_products(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Product catalog image (png/jpg/jpeg/webp/tiff) or PDF"),
    language: str = Form("en", description="Processing language"),
    current_user: Dict = Depends(get_current_user)
):
    """Extract structured product candidates from a catalog image or PDF.

    Pipeline: bytes -> text (OCRService for images, pypdf embedded-text
    extraction for PDFs) -> product candidates via the heuristic parser.
    Scanned PDFs (no embedded text layer) are rejected with a clear error;
    page rendering is intentionally out of scope.
    """

    content_type = (file.content_type or "").lower()
    is_pdf = content_type == EXTRACT_PDF_CONTENT_TYPE
    is_image = content_type in EXTRACT_IMAGE_CONTENT_TYPES

    if not (is_pdf or is_image):
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid file type. Please upload an image "
                "(png/jpg/jpeg/webp/tiff) or a PDF."
            )
        )

    if file.size and file.size > settings.MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=http_status.HTTP_413_PAYLOAD_TOO_LARGE,
            detail=f"File too large. Maximum size is {settings.MAX_IMAGE_SIZE_MB}MB"
        )

    await check_rate_limits(current_user["user_id"], current_user["shop_id"])

    try:
        data = await file.read()

        if is_pdf:
            # PDFs: embedded text extraction only (no page rendering).
            engine = "pypdf"
            try:
                raw_text = extract_pdf_text(data)
            except Exception as e:
                raise OCRError("INVALID_PDF", f"Failed to read PDF: {str(e)}")

            if not raw_text.strip():
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "PDF contains no embedded text. Scanned PDFs are not "
                        "supported by this endpoint - convert the pages to "
                        "images (png/jpg) and re-upload to use image OCR mode."
                    )
                )
        else:
            # Images: reuse the existing OCR pipeline.
            temp_dir = tempfile.gettempdir()
            temp_filename = f"extract_{uuid.uuid4()}_{file.filename or 'image'}"
            temp_path = os.path.join(temp_dir, temp_filename)

            with open(temp_path, "wb") as buffer:
                buffer.write(data)

            request = OCRRequest(
                shop_id=current_user["shop_id"],
                user_id=current_user["user_id"],
                ocr_type=OCRType.PRODUCT,
                confidence_threshold=settings.OCR_CONFIDENCE_THRESHOLD,
                extract_barcodes=False,  # barcodes are parsed from text by the product parser
                language=language,
                image_path=temp_path,
                file_size=len(data),
                filename=file.filename or "catalog_image"
            )

            ocr_service = OCRService.get_instance()
            result = await ocr_service.process_image(request)
            raw_text = result.text
            engine = result.model_used

            background_tasks.add_task(os.remove, temp_path)

        products = parse_product_text(raw_text)

        logger.info(
            "Product extraction completed",
            user_id=current_user["user_id"],
            shop_id=current_user["shop_id"],
            engine=engine,
            product_count=len(products),
            filename=file.filename
        )

        return ExtractProductsResponse(
            products=products,
            raw_text=raw_text,
            engine=engine,
            count=len(products)
        )

    except OCRError as e:
        logger.error("Product extraction failed", error_code=e.code, error_message=e.message)
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST if e.code in ["FILE_TOO_LARGE", "INVALID_IMAGE", "INVALID_PDF"] else http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"[{e.code}] {e.message}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Product extraction failed", error=str(e), user_id=current_user["user_id"])
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Product extraction failed: {str(e)}"
        )


# Receipt / invoice digitization endpoint
@api_router.post("/extract-receipt", response_model=ExtractReceiptResponse, tags=["OCR"])
async def extract_receipt(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Receipt/invoice image (png/jpg/jpeg/webp/tiff) or PDF"),
    language: str = Form("en", description="Processing language"),
    current_user: Dict = Depends(get_current_user)
):
    """Digitize a receipt/invoice image or PDF into structured fields.

    Pipeline: bytes -> text (OCRService for images, pypdf embedded-text
    extraction for PDFs) -> structured receipt via the heuristic parser.
    Scanned PDFs (no embedded text layer) are rejected with a clear error;
    page rendering is intentionally out of scope.
    """

    content_type = (file.content_type or "").lower()
    is_pdf = content_type == EXTRACT_PDF_CONTENT_TYPE
    is_image = content_type in EXTRACT_IMAGE_CONTENT_TYPES

    if not (is_pdf or is_image):
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid file type. Please upload an image "
                "(png/jpg/jpeg/webp/tiff) or a PDF."
            )
        )

    if file.size and file.size > settings.MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=http_status.HTTP_413_PAYLOAD_TOO_LARGE,
            detail=f"File too large. Maximum size is {settings.MAX_IMAGE_SIZE_MB}MB"
        )

    await check_rate_limits(current_user["user_id"], current_user["shop_id"])

    try:
        data = await file.read()

        if is_pdf:
            # PDFs: embedded text extraction only (no page rendering).
            engine = "pypdf"
            try:
                raw_text = extract_pdf_text(data)
            except Exception as e:
                raise OCRError("INVALID_PDF", f"Failed to read PDF: {str(e)}")

            if not raw_text.strip():
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "PDF contains no embedded text. Scanned PDFs are not "
                        "supported by this endpoint - convert the pages to "
                        "images (png/jpg) and re-upload to use image OCR mode."
                    )
                )
        else:
            # Images: reuse the existing OCR pipeline.
            temp_dir = tempfile.gettempdir()
            temp_filename = f"receipt_{uuid.uuid4()}_{file.filename or 'image'}"
            temp_path = os.path.join(temp_dir, temp_filename)

            with open(temp_path, "wb") as buffer:
                buffer.write(data)

            request = OCRRequest(
                shop_id=current_user["shop_id"],
                user_id=current_user["user_id"],
                ocr_type=OCRType.RECEIPT,
                confidence_threshold=settings.OCR_CONFIDENCE_THRESHOLD,
                extract_barcodes=False,  # structure is parsed from text by the receipt parser
                language=language,
                image_path=temp_path,
                file_size=len(data),
                filename=file.filename or "receipt_image"
            )

            ocr_service = OCRService.get_instance()
            result = await ocr_service.process_image(request)
            raw_text = result.text
            engine = result.model_used

            background_tasks.add_task(os.remove, temp_path)

        receipt = parse_receipt_text(raw_text)

        logger.info(
            "Receipt extraction completed",
            user_id=current_user["user_id"],
            shop_id=current_user["shop_id"],
            engine=engine,
            item_count=len(receipt["items"]),
            filename=file.filename
        )

        return ExtractReceiptResponse(
            vendor=receipt["vendor"],
            document_date=receipt["document_date"],
            currency=receipt["currency"],
            subtotal=receipt["subtotal"],
            discount=receipt["discount"],
            tax=receipt["tax"],
            total=receipt["total"],
            items=receipt["items"],
            raw_text=raw_text,
            engine=engine
        )

    except OCRError as e:
        logger.error("Receipt extraction failed", error_code=e.code, error_message=e.message)
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST if e.code in ["FILE_TOO_LARGE", "INVALID_IMAGE", "INVALID_PDF"] else http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"[{e.code}] {e.message}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Receipt extraction failed", error=str(e), user_id=current_user["user_id"])
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Receipt extraction failed: {str(e)}"
        )


# Background task functions
async def process_ocr_job_background(
    job_id: str,
    image_path: str,
    shop_id: str,
    user_id: str,
    ocr_type: OCRType,
    confidence_threshold: float,
    extract_barcodes: bool,
    language: str,
    callback_url: str = None
):
    """Background task for async OCR processing."""
    try:
        # TODO: Update job status to PROCESSING in database

        # Create OCR request
        request = OCRRequest(
            shop_id=shop_id,
            user_id=user_id,
            ocr_type=ocr_type,
            confidence_threshold=confidence_threshold,
            extract_barcodes=extract_barcodes,
            language=language,
            image_path=image_path,
            file_size=0,  # Not needed for background processing
            filename="async_image"
        )

        # Process image
        ocr_service = OCRService.get_instance()
        result = await ocr_service.process_image(request)

        # TODO: Update job status to COMPLETED in database
        # TODO: Save result to database
        # TODO: Call callback URL if provided

        logger.info(
            "Background OCR completed",
            job_id=job_id,
            confidence=result.confidence,
            processing_time_ms=result.processing_time_ms
        )

    except Exception as e:
        logger.error("Background OCR failed", job_id=job_id, error=str(e))
        # TODO: Update job status to FAILED in database
        # TODO: Call error callback if provided
    finally:
        # Clean up temporary file
        try:
            os.remove(image_path)
        except Exception:
            pass
















