"""
Configuration Settings for ZakPOS OCR Server
===========================================

Environment variables and settings management for the OCR microservice.
All configuration is loaded from environment variables with sensible defaults.
"""

import os
from typing import List, Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application Info
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    PORT: int = 8000

    # CORS Settings
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:41923,http://localhost:53851,http://localhost:96140"

    # Database Configuration
    DATABASE_URL: str = "postgresql://postgres:postgres123@localhost:47821/zakpos_dev"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    # Redis Configuration
    REDIS_URL: str = "redis://localhost:58392"
    REDIS_POOL_SIZE: int = 10

    # Kafka Configuration
    KAFKA_BROKERS: str = "localhost:54629"
    KAFKA_TOPIC_OCR_COMPLETED: str = "ocr.completed"
    KAFKA_TOPIC_OCR_FAILED: str = "ocr.failed"

    # File Storage Configuration
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET_NAME: str = "zakpos-ocr"
    MAX_IMAGE_SIZE_MB: int = 10

    # OCR Model Configuration
    OCR_MODEL_PRIMARY: str = "microsoft/trocr-small-printed"
    OCR_MODEL_FALLBACK: str = "tesseract"
    OCR_CONFIDENCE_THRESHOLD: float = 0.8
    OCR_PROCESSING_TIMEOUT_SECONDS: int = 30
    OCR_ENABLE_GPU: bool = False

    # Performance Settings
    OCR_CACHE_TTL_SECONDS: int = 3600  # 1 hour
    OCR_BATCH_SIZE: int = 5
    OCR_QUEUE_SIZE: int = 1000
    OCR_WORKERS: int = 4

    # Rate Limiting
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 100
    RATE_LIMIT_BURST_SIZE: int = 10

    # Security
    JWT_SECRET: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRES_MINUTES: int = 60

    # Monitoring
    SENTRY_DSN: Optional[str] = None
    PROMETHEUS_ENABLED: bool = True

    # Feature Flags
    ENABLE_BARCODE_DETECTION: bool = True
    ENABLE_ASYNC_PROCESSING: bool = True
    ENABLE_MODEL_CACHING: bool = True
    ENABLE_METRICS_COLLECTION: bool = True

    class Config:
        """Pydantic configuration."""
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


# Create global settings instance
settings = Settings()


# Environment-specific configurations
def get_cors_origins() -> List[str]:
    """Get CORS origins based on environment."""
    if settings.DEBUG:
        return [
            "http://localhost:3000",
            "http://localhost:41923",
            "http://localhost:53851",
            "http://localhost:96140",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:41923",
        ]
    return settings.CORS_ORIGINS.split(",") if settings.CORS_ORIGINS else []


def is_development() -> bool:
    """Check if running in development mode."""
    return settings.DEBUG or os.getenv("NODE_ENV", "").lower() == "development"


def is_production() -> bool:
    """Check if running in production mode."""
    return os.getenv("NODE_ENV", "").lower() == "production"


def get_log_level() -> str:
    """Get appropriate log level based on environment."""
    if is_development():
        return "DEBUG"
    return settings.LOG_LEVEL


# Model paths and configurations
MODEL_CONFIGS = {
    "microsoft/trocr-small-printed": {
        "max_length": 128,
        "num_beams": 1,
        "early_stopping": True,
        "use_cache": True,
        "torch_dtype": "float16" if settings.OCR_ENABLE_GPU else "float32",
    },
    "tesseract": {
        "lang": "eng",
        "config": "--oem 3 --psm 6",
        "timeout": 30,
    }
}


# API Response models
class OCRType:
    """Supported OCR processing types."""
    PRODUCT = "product"
    RECEIPT = "receipt"
    INVOICE = "invoice"
    BARCODE = "barcode"


class ProcessingStatus:
    """OCR job processing status."""
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


