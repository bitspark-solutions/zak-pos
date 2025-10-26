"""
ZakPOS OCR Server
================

A high-performance OCR microservice for processing product labels, receipts, and invoices.
Uses Microsoft TrOCR as the primary engine with Tesseract as fallback.

Features:
- Ultra-fast processing (<59ms target)
- GPU acceleration support
- Multi-tenant architecture
- Real-time and async processing
- Comprehensive error handling
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
import structlog

from app.core.config import settings
from app.core.database import init_db, close_db, AsyncSessionLocal
from app.core.redis import init_redis, close_redis
from app.core.monitoring import setup_monitoring
from app.services.ocr_service import OCRService
from app.api.v1.api import api_router

# Configure structured logging
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown."""
    # Startup
    logger.info("Starting ZakPOS OCR Server", version=settings.VERSION)

    # Initialize database
    await init_db()
    logger.info("Database initialized")

    # Initialize Redis
    await init_redis()
    logger.info("Redis initialized")

    # Initialize OCR service (with error handling for Docker startup)
    try:
        ocr_service = await OCRService.initialize()
        logger.info("OCR service initialized", model=settings.OCR_MODEL_PRIMARY)
    except Exception as e:
        logger.warning("OCR service initialization failed, will retry", error=str(e))
        # Don't fail startup, allow health checks to handle model loading

    # Setup monitoring
    setup_monitoring(app)

    yield

    # Shutdown
    logger.info("Shutting down OCR Server")
    await close_redis()
    await close_db()


# Create FastAPI application
app = FastAPI(
    title="ZakPOS OCR Server",
    description="High-performance OCR microservice for product label and receipt processing",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with basic server information."""
    return {
        "service": "ZakPOS OCR Server",
        "version": settings.VERSION,
        "status": "healthy",
        "model": settings.OCR_MODEL_PRIMARY,
        "docs": "/docs"
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for load balancers and monitoring."""
    try:
        # Check database connectivity
        async with AsyncSessionLocal() as session:
            await session.execute("SELECT 1")

        # Check Redis connectivity
        from app.core.redis import get_redis
        redis = await get_redis()
        await redis.ping()

        # Check OCR service
        ocr_service = OCRService.get_instance()
        if not ocr_service.is_ready():
            raise HTTPException(status_code=503, detail="OCR service not ready")

        return {
            "status": "healthy",
            "version": settings.VERSION,
            "model": settings.OCR_MODEL_PRIMARY,
            "database": "connected",
            "redis": "connected",
            "ocr_service": "ready"
        }

    except Exception as e:
        logger.error("Health check failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service unhealthy"
        )


@app.get("/metrics", tags=["Monitoring"])
async def metrics():
    """Prometheus-style metrics endpoint."""
    # TODO: Implement detailed metrics collection
    return {
        "total_requests": 0,
        "successful_requests": 0,
        "average_processing_time_ms": 0,
        "model_accuracy": 0.95,
        "uptime_seconds": 0
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
        access_log=True,
    )
