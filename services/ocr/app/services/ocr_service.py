"""
Core OCR Service for ZakPOS
==========================

Main service class that handles image processing, text extraction,
and structured data parsing using Microsoft TrOCR and Tesseract.
"""

import asyncio
import time
import uuid
from typing import Dict, List, Optional, Any
from PIL import Image
import numpy as np
import structlog
import cv2

from app.core.config import settings, MODEL_CONFIGS
from app.core.redis import cache_ocr_result, get_cached_ocr_result
from app.core.monitoring import (
    record_processing_time,
    record_model_accuracy,
    record_error,
    log_ocr_processing
)
from app.models.schemas import OCRRequest, OCRResult, OCRError

# Import OCR engines (will be loaded dynamically)
torch_available = False
transformers_available = False
tesseract_available = False

try:
    import torch
    from transformers import TrOCRProcessor, VisionEncoderDecoderModel
    torch_available = True
    transformers_available = True
except ImportError:
    print("Warning: PyTorch/Transformers not available. TrOCR will not work.")

try:
    import pytesseract
    import cv2
    tesseract_available = True
except ImportError:
    print("Warning: Tesseract/OpenCV not available. Fallback OCR will not work.")


class OCRService:
    """Main OCR processing service with model management."""

    _instance: Optional['OCRService'] = None
    _models_loaded: bool = False

    def __init__(self):
        self.logger = structlog.get_logger(__name__)
        self.primary_model = None
        self.processor = None
        self.fallback_model_available = False
        self.device = "cuda" if settings.OCR_ENABLE_GPU and torch_available and torch.cuda.is_available() else "cpu"

    @classmethod
    async def initialize(cls) -> 'OCRService':
        """Initialize the OCR service singleton."""
        if cls._instance is None:
            cls._instance = cls()
            await cls._instance._load_models()
        return cls._instance

    @classmethod
    def get_instance(cls) -> 'OCRService':
        """Get the OCR service instance."""
        if cls._instance is None:
            raise RuntimeError("OCR Service not initialized. Call initialize() first.")
        return cls._instance

    async def _load_models(self) -> None:
        """Load OCR models into memory."""
        try:
            self.logger.info("Loading OCR models", primary=settings.OCR_MODEL_PRIMARY)

            # Load primary model (TrOCR)
            if transformers_available and settings.OCR_MODEL_PRIMARY.startswith("microsoft/"):
                await self._load_trocr_model()
                self.logger.info("TrOCR model loaded successfully", device=self.device)

            # Check fallback model availability
            if tesseract_available and settings.OCR_MODEL_FALLBACK == "tesseract":
                self.fallback_model_available = True
                self.logger.info("Tesseract fallback available")

            self._models_loaded = True
            self.logger.info("All OCR models loaded successfully")

        except Exception as e:
            self.logger.error("Failed to load OCR models", error=str(e))
            self._models_loaded = False
            raise

    async def _load_trocr_model(self) -> None:
        """Load Microsoft TrOCR model."""
        try:
            # Load processor and model
            self.processor = TrOCRProcessor.from_pretrained(settings.OCR_MODEL_PRIMARY)
            self.primary_model = VisionEncoderDecoderModel.from_pretrained(
                settings.OCR_MODEL_PRIMARY,
                **MODEL_CONFIGS[settings.OCR_MODEL_PRIMARY]
            )

            # Move to GPU if available
            if self.device == "cuda":
                self.primary_model = self.primary_model.to(self.device)
                self.logger.info("Model moved to GPU")

        except Exception as e:
            self.logger.error("Failed to load TrOCR model", error=str(e))
            raise

    def is_ready(self) -> bool:
        """Check if OCR service is ready to process requests."""
        return self._models_loaded and self.primary_model is not None

    def is_model_loaded(self, model_name: str) -> bool:
        """Check if specific model is loaded."""
        if model_name == settings.OCR_MODEL_PRIMARY:
            return self.primary_model is not None
        elif model_name == settings.OCR_MODEL_FALLBACK:
            return self.fallback_model_available
        return False

    async def process_image(self, request: OCRRequest) -> OCRResult:
        """Process a single image with OCR."""
        job_id = str(uuid.uuid4())
        start_time = time.time()

        async with log_ocr_processing(job_id, request.shop_id, request.ocr_type):
            try:
                # Check cache first
                if settings.ENABLE_MODEL_CACHING:
                    cached_result = await get_cached_ocr_result(job_id)
                    if cached_result:
                        self.logger.debug("Returning cached result", job_id=job_id)
                        return OCRResult.from_dict(cached_result)

                # Validate and preprocess image
                image = await self._validate_and_preprocess_image(request)

                # Extract text using primary model
                result = await self._extract_text_with_primary_model(image, request)

                # Extract barcodes if requested
                if request.extract_barcodes:
                    barcodes = await self._detect_barcodes(image)
                    result.barcodes = barcodes

                # Parse structured data
                structured_data = self._parse_structured_data(result.text, request.ocr_type)

                # Update result with structured data
                result.structured = structured_data
                result.processing_time_ms = int((time.time() - start_time) * 1000)

                # Cache result
                if settings.ENABLE_MODEL_CACHING:
                    await cache_ocr_result(job_id, result.to_dict())

                # Record metrics
                self._record_metrics(result, request.ocr_type)

                self.logger.info(
                    "OCR processing completed",
                    job_id=job_id,
                    confidence=result.confidence,
                    processing_time_ms=result.processing_time_ms
                )

                return result

            except Exception as e:
                duration = time.time() - start_time
                self.logger.error(
                    "OCR processing failed",
                    job_id=job_id,
                    error=str(e),
                    duration_ms=int(duration * 1000)
                )

                # Record error metrics
                record_error("processing_error", settings.OCR_MODEL_PRIMARY)

                # Try fallback if available
                if self.fallback_model_available and request.ocr_type != "barcode":
                    self.logger.info("Attempting fallback OCR", job_id=job_id)
                    return await self._process_with_fallback(request, job_id)

                raise

    async def _validate_and_preprocess_image(self, request: OCRRequest) -> Image.Image:
        """Validate and preprocess image for OCR."""
        try:
            # Open and validate image
            image = Image.open(request.image_path)

            # Check file size
            if request.file_size > settings.MAX_IMAGE_SIZE_MB * 1024 * 1024:
                raise OCRError("FILE_TOO_LARGE", f"Image size exceeds {settings.MAX_IMAGE_SIZE_MB}MB limit")

            # Convert to RGB if needed
            if image.mode not in ['RGB', 'L']:
                image = image.convert('RGB')

            # Resize if too large (for performance)
            max_dimension = 2048
            if max(image.size) > max_dimension:
                image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

            # Image enhancement
            image = await self._enhance_image(image)

            return image

        except Exception as e:
            if isinstance(e, OCRError):
                raise
            raise OCRError("INVALID_IMAGE", f"Failed to process image: {str(e)}")

    async def _enhance_image(self, image: Image.Image) -> Image.Image:
        """Enhance image quality for better OCR accuracy."""
        try:
            # Convert to numpy array for processing
            img_array = np.array(image)

            # Auto-rotate based on EXIF orientation
            img_array = self._auto_rotate_image(img_array)

            # Enhance contrast and sharpness
            if len(img_array.shape) == 3:  # Color image
                # Convert to grayscale for OCR
                gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)

                # Apply adaptive thresholding for better text detection
                enhanced = cv2.adaptiveThreshold(
                    gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
                )

                # Convert back to PIL Image
                return Image.fromarray(enhanced).convert('RGB')
            else:
                # Already grayscale
                return Image.fromarray(img_array).convert('RGB')

        except Exception as e:
            self.logger.warning("Image enhancement failed, using original", error=str(e))
            return image

    def _auto_rotate_image(self, img_array: np.ndarray) -> np.ndarray:
        """Auto-rotate image based on EXIF or content analysis."""
        try:
            # Try to detect text orientation and rotate accordingly
            # For now, just return original - can be enhanced with more sophisticated logic
            return img_array
        except Exception:
            return img_array

    async def _extract_text_with_primary_model(self, image: Image.Image, request: OCRRequest) -> OCRResult:
        """Extract text using primary TrOCR model."""
        if not self.primary_model or not self.processor:
            raise OCRError("MODEL_NOT_LOADED", "Primary OCR model not available")

        start_time = time.time()

        try:
            # Prepare image for model
            pixel_values = self.processor(images=image, return_tensors="pt").pixel_values

            # Move to device if using GPU
            if self.device == "cuda":
                pixel_values = pixel_values.to(self.device)

            # Generate text
            with torch.no_grad():
                generated_ids = self.primary_model.generate(
                    pixel_values,
                    max_length=128,
                    num_beams=1,
                    early_stopping=True
                )

            # Decode generated text
            generated_text = self.processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

            # Calculate processing time
            processing_time = time.time() - start_time

            # Record metrics
            record_processing_time(settings.OCR_MODEL_PRIMARY, request.ocr_type, processing_time)

            return OCRResult(
                id=str(uuid.uuid4()),
                text=generated_text,
                confidence=0.95,  # TrOCR doesn't provide confidence, using default
                structured={},
                barcodes=[],
                processing_time_ms=int(processing_time * 1000),
                model_used=settings.OCR_MODEL_PRIMARY
            )

        except Exception as e:
            processing_time = time.time() - start_time
            record_processing_time(settings.OCR_MODEL_PRIMARY, request.ocr_type, processing_time)
            record_error("model_inference_error", settings.OCR_MODEL_PRIMARY)
            raise OCRError("MODEL_INFERENCE_ERROR", f"TrOCR processing failed: {str(e)}")

    async def _process_with_fallback(self, request: OCRRequest, job_id: str) -> OCRResult:
        """Process image with Tesseract fallback."""
        if not self.fallback_model_available:
            raise OCRError("NO_FALLBACK", "Fallback OCR model not available")

        try:
            # Open image for Tesseract
            image = Image.open(request.image_path)

            # Configure Tesseract
            config = MODEL_CONFIGS["tesseract"]["config"]
            lang = MODEL_CONFIGS["tesseract"]["lang"]

            # Extract text with Tesseract
            text = pytesseract.image_to_string(image, lang=lang, config=config)

            return OCRResult(
                id=str(uuid.uuid4()),
                text=text.strip(),
                confidence=0.8,  # Lower confidence for Tesseract
                structured={},
                barcodes=[],
                processing_time_ms=50,  # Tesseract is faster
                model_used=settings.OCR_MODEL_FALLBACK
            )

        except Exception as e:
            raise OCRError("FALLBACK_ERROR", f"Tesseract processing failed: {str(e)}")

    async def _detect_barcodes(self, image: Image.Image) -> List[Dict[str, Any]]:
        """Detect barcodes and QR codes in image."""
        if not settings.ENABLE_BARCODE_DETECTION:
            return []

        try:
            # Convert PIL to OpenCV format
            img_array = np.array(image)
            if len(img_array.shape) == 3:
                gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
            else:
                gray = img_array

            # Initialize barcode detector
            detector = cv2.barcode_BarcodeDetector()

            # Detect barcodes
            ok, decoded_info, decoded_type, corners = detector.detectAndDecode(gray)

            barcodes = []
            if ok and decoded_info:
                for info, barcode_type in zip(decoded_info, decoded_type):
                    if info:  # Only add if barcode was successfully decoded
                        barcode_data = {
                            "type": barcode_type,
                            "value": info,
                            "confidence": 0.95,
                            "bounding_box": {
                                "x": int(corners[0][0][0]),
                                "y": int(corners[0][0][1]),
                                "width": int(corners[0][2][0] - corners[0][0][0]),
                                "height": int(corners[0][2][1] - corners[0][0][1])
                            }
                        }
                        barcodes.append(barcode_data)

            return barcodes

        except Exception as e:
            self.logger.warning("Barcode detection failed", error=str(e))
            return []

    def _parse_structured_data(self, text: str, ocr_type: str) -> Dict[str, Any]:
        """Parse extracted text into structured data based on type."""
        structured = {}

        try:
            if ocr_type == "product":
                structured = self._parse_product_data(text)
            elif ocr_type == "receipt":
                structured = self._parse_receipt_data(text)
            elif ocr_type == "invoice":
                structured = self._parse_invoice_data(text)

        except Exception as e:
            self.logger.warning("Structured data parsing failed", error=str(e), text=text)

        return structured

    def _parse_product_data(self, text: str) -> Dict[str, Any]:
        """Parse product label text into structured data."""
        lines = [line.strip() for line in text.split('\n') if line.strip()]

        # Simple parsing logic - can be enhanced with more sophisticated NLP
        product_name = lines[0] if lines else ""

        # Look for price patterns
        price = None
        for line in lines:
            # Look for price patterns like $19.99, 19.99, $20
            import re
            price_match = re.search(r'\$?(\d+\.?\d*)', line)
            if price_match:
                price = float(price_match.group(1))
                break

        return {
            "product_name": product_name,
            "price": price,
            "currency": "USD" if price else None
        }

    def _parse_receipt_data(self, text: str) -> Dict[str, Any]:
        """Parse receipt text into structured data."""
        # Simple receipt parsing - can be enhanced
        lines = [line.strip() for line in text.split('\n') if line.strip()]

        # Look for total
        total = None
        for line in lines:
            if 'total' in line.lower():
                import re
                total_match = re.search(r'\$?(\d+\.?\d*)', line)
                if total_match:
                    total = float(total_match.group(1))
                    break

        return {
            "total_amount": total,
            "currency": "USD" if total else None,
            "item_count": len([l for l in lines if '$' in l or any(c.isdigit() for c in l)])
        }

    def _parse_invoice_data(self, text: str) -> Dict[str, Any]:
        """Parse invoice text into structured data."""
        # Similar to receipt parsing but for invoices
        lines = [line.strip() for line in text.split('\n') if line.strip()]

        # Look for invoice number
        invoice_number = None
        for line in lines:
            if 'invoice' in line.lower() or 'inv' in line.lower():
                # Extract number after invoice
                import re
                num_match = re.search(r'[\w#]+(\d+)', line)
                if num_match:
                    invoice_number = num_match.group(1)
                    break

        return {
            "invoice_number": invoice_number,
            "supplier_name": lines[0] if lines else None,
            "total_amount": self._parse_receipt_data(text).get("total_amount")
        }

    def _record_metrics(self, result: OCRResult, ocr_type: str) -> None:
        """Record processing metrics."""
        try:
            # Record processing time
            record_processing_time(result.model_used, ocr_type, result.processing_time_ms / 1000)

            # Record accuracy metrics (simplified)
            if result.confidence > 0.9:
                record_model_accuracy(result.model_used, "overall", result.confidence)
            elif result.confidence > 0.7:
                record_model_accuracy(result.model_used, "overall", 0.7)
            else:
                record_model_accuracy(result.model_used, "overall", 0.5)

        except Exception as e:
            self.logger.warning("Failed to record metrics", error=str(e))

    async def batch_process(self, requests: List[OCRRequest]) -> List[OCRResult]:
        """Process multiple images in batch."""
        results = []

        # Process images concurrently for better performance
        tasks = [self.process_image(request) for request in requests]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Handle any exceptions
        final_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                self.logger.error(
                    "Batch processing failed for image",
                    index=i,
                    error=str(result)
                )
                # Return error result
                final_results.append(OCRResult(
                    id=str(uuid.uuid4()),
                    text="",
                    confidence=0.0,
                    structured={},
                    barcodes=[],
                    processing_time_ms=0,
                    model_used="error",
                    error=str(result)
                ))
            else:
                final_results.append(result)

        return final_results
