"""
Monitoring and Observability for ZakPOS OCR Server
================================================

Health checks, metrics collection, and structured logging setup.
"""

import time
import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from prometheus_client import Counter, Histogram, Gauge, generate_latest
import json

from app.core.config import settings
from app.core.database import check_database_health
from app.core.redis import check_redis_health
from app.services.ocr_service import OCRService

# Configure structured logging
logger = structlog.get_logger(__name__)

# Prometheus metrics
REQUEST_COUNT = Counter(
    "ocr_requests_total",
    "Total number of OCR requests",
    ["method", "endpoint", "status"]
)

REQUEST_DURATION = Histogram(
    "ocr_request_duration_seconds",
    "OCR request duration in seconds",
    ["method", "endpoint"]
)

PROCESSING_TIME = Histogram(
    "ocr_processing_time_seconds",
    "OCR processing time in seconds",
    ["model", "ocr_type"]
)

MODEL_ACCURACY = Gauge(
    "ocr_model_accuracy",
    "OCR model accuracy score",
    ["model", "field"]
)

ACTIVE_JOBS = Gauge(
    "ocr_active_jobs", "Number of active OCR processing jobs"
)

ERROR_COUNT = Counter(
    "ocr_errors_total",
    "Total number of OCR errors",
    ["error_type", "model"]
)


def setup_monitoring(app: FastAPI) -> None:
    """Set up monitoring middleware and endpoints."""

    @app.middleware("http")
    async def monitoring_middleware(request: Request, call_next):
        """Middleware for request monitoring."""
        start_time = time.time()

        # Log request
        logger.info(
            "Request started",
            method=request.method,
            url=str(request.url),
            user_agent=request.headers.get("user-agent", ""),
            shop_id=request.headers.get("x-shop-id", "unknown")
        )

        try:
            response = await call_next(request)

            # Record metrics
            duration = time.time() - start_time
            REQUEST_COUNT.labels(
                method=request.method,
                endpoint=request.url.path,
                status=response.status_code
            ).inc()

            REQUEST_DURATION.labels(
                method=request.method,
                endpoint=request.url.path
            ).observe(duration)

            # Log successful request
            if response.status_code < 400:
                logger.info(
                    "Request completed",
                    method=request.method,
                    url=str(request.url),
                    status_code=response.status_code,
                    duration_ms=round(duration * 1000, 2)
                )
            else:
                logger.warning(
                    "Request failed",
                    method=request.method,
                    url=str(request.url),
                    status_code=response.status_code,
                    duration_ms=round(duration * 1000, 2)
                )

            return response

        except Exception as e:
            duration = time.time() - start_time
            REQUEST_COUNT.labels(
                method=request.method,
                endpoint=request.url.path,
                status=500
            ).inc()

            logger.error(
                "Request error",
                method=request.method,
                url=str(request.url),
                error=str(e),
                duration_ms=round(duration * 1000, 2)
            )
            raise

    # Add Prometheus metrics endpoint
    if settings.PROMETHEUS_ENABLED:
        @app.get("/metrics")
        async def metrics():
            """Prometheus metrics endpoint."""
            return Response(
                generate_latest(),
                media_type="text/plain; version=0.0.4; charset=utf-8"
            )


# Service health check functions
async def get_system_health() -> dict:
    """Get comprehensive system health status."""
    health_status = {
        "status": "healthy",
        "timestamp": time.time(),
        "version": settings.VERSION,
        "services": {}
    }

    # Check database
    db_health = await check_database_health()
    health_status["services"]["database"] = db_health

    if db_health["status"] != "healthy":
        health_status["status"] = "degraded"

    # Check Redis
    redis_health = await check_redis_health()
    health_status["services"]["redis"] = redis_health

    if redis_health["status"] != "healthy":
        health_status["status"] = "degraded"

    # Check OCR service
    try:
        ocr_service = OCRService.get_instance()
        ocr_ready = ocr_service.is_ready()
        health_status["services"]["ocr_service"] = {"status": "ready" if ocr_ready else "not_ready"}

        if not ocr_ready:
            health_status["status"] = "degraded"

    except Exception as e:
        health_status["services"]["ocr_service"] = {"status": "error", "error": str(e)}
        health_status["status"] = "unhealthy"

    # Check models
    try:
        models = await get_loaded_models_info()
        health_status["services"]["models"] = models
    except Exception as e:
        health_status["services"]["models"] = {"status": "error", "error": str(e)}
        health_status["status"] = "degraded"

    return health_status


async def get_loaded_models_info() -> dict:
    """Get information about loaded OCR models."""
    try:
        ocr_service = OCRService.get_instance()
        models_info = {
            "status": "loaded",
            "primary_model": settings.OCR_MODEL_PRIMARY,
            "fallback_model": settings.OCR_MODEL_FALLBACK,
            "gpu_enabled": settings.OCR_ENABLE_GPU,
            "models": []
        }

        # Add model-specific information
        for model_name in [settings.OCR_MODEL_PRIMARY, settings.OCR_MODEL_FALLBACK]:
            try:
                if model_name.startswith("microsoft/"):
                    # Hugging Face model info
                    model_info = {
                        "name": model_name,
                        "type": "huggingface",
                        "status": "loaded" if ocr_service.is_model_loaded(model_name) else "not_loaded"
                    }
                elif model_name == "tesseract":
                    # Tesseract info
                    model_info = {
                        "name": model_name,
                        "type": "tesseract",
                        "lang": "eng",
                        "status": "available"
                    }
                else:
                    model_info = {
                        "name": model_name,
                        "type": "unknown",
                        "status": "unknown"
                    }

                models_info["models"].append(model_info)

            except Exception as e:
                models_info["models"].append({
                    "name": model_name,
                    "status": "error",
                    "error": str(e)
                })

        return models_info

    except Exception as e:
        return {"status": "error", "error": str(e)}


# Metrics recording functions
def record_processing_time(model: str, ocr_type: str, duration_seconds: float) -> None:
    """Record OCR processing time metric."""
    PROCESSING_TIME.labels(model=model, ocr_type=ocr_type).observe(duration_seconds)


def record_model_accuracy(model: str, field: str, accuracy: float) -> None:
    """Record model accuracy metric."""
    MODEL_ACCURACY.labels(model=model, field=field).set(accuracy)


def record_error(error_type: str, model: str) -> None:
    """Record error metric."""
    ERROR_COUNT.labels(error_type=error_type, model=model).inc()


def update_active_jobs(count: int) -> None:
    """Update active jobs gauge."""
    ACTIVE_JOBS.set(count)


# Structured logging setup
def setup_structured_logging() -> None:
    """Configure structured logging for the application."""

    # Configure structlog
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


# Context managers for logging
@asynccontextmanager
async def log_ocr_processing(job_id: str, shop_id: str, ocr_type: str):
    """Context manager for logging OCR processing."""
    start_time = time.time()

    logger.info(
        "OCR processing started",
        job_id=job_id,
        shop_id=shop_id,
        ocr_type=ocr_type
    )

    try:
        yield
    except Exception as e:
        duration = time.time() - start_time
        logger.error(
            "OCR processing failed",
            job_id=job_id,
            shop_id=shop_id,
            ocr_type=ocr_type,
            error=str(e),
            duration_ms=round(duration * 1000, 2)
        )
        raise
    else:
        duration = time.time() - start_time
        logger.info(
            "OCR processing completed",
            job_id=job_id,
            shop_id=shop_id,
            ocr_type=ocr_type,
            duration_ms=round(duration * 1000, 2)
        )

