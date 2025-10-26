"""
Core OCR Server Components
=========================

Configuration, database, Redis, and monitoring setup for the OCR service.
"""

from .config import settings, get_cors_origins, is_development, is_production, get_log_level
from .database import init_db, close_db, get_db, Base, OCRProcessingJob, OCRModelMetrics, OCRErrorLog
from .redis import init_redis, close_redis, get_redis, cache_ocr_result, get_cached_ocr_result
from .monitoring import setup_monitoring, get_system_health, log_ocr_processing

__all__ = [
    "settings", "get_cors_origins", "is_development", "is_production", "get_log_level",
    "init_db", "close_db", "get_db", "Base", "OCRProcessingJob", "OCRModelMetrics", "OCRErrorLog",
    "init_redis", "close_redis", "get_redis", "cache_ocr_result", "get_cached_ocr_result",
    "setup_monitoring", "get_system_health", "log_ocr_processing"
]

