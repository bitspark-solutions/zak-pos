"""
Database Configuration and Models for ZakPOS OCR Server
======================================================

SQLAlchemy setup with PostgreSQL integration for OCR processing data.
Includes models for jobs, metrics, and error logging.
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Integer, Float, Boolean, Text, DateTime, JSON, UUID, ForeignKey
from sqlalchemy.sql import func
import structlog

from app.core.config import settings

# Configure logging
logger = structlog.get_logger(__name__)

# Database engine and session
engine = create_async_engine(
    settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"),
    echo=settings.DEBUG,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """Base class for all database models."""
    pass


# Database Models
class OCRProcessingJob(Base):
    """Model for OCR processing jobs and results."""

    __tablename__ = "ocr_processing_jobs"

    id: Mapped[UUID] = mapped_column(UUID, primary_key=True, server_default=func.gen_random_uuid())
    shop_id: Mapped[UUID] = mapped_column(UUID, nullable=False)
    user_id: Mapped[UUID] = mapped_column(UUID, nullable=False)

    # Job configuration
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued")
    job_type: Mapped[str] = mapped_column(String(20), nullable=False, default="single")
    ocr_type: Mapped[str] = mapped_column(String(20), nullable=False, default="product")

    # Image information
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    image_size_bytes: Mapped[int] = mapped_column(Integer)
    image_format: Mapped[str] = mapped_column(String(10))

    # Processing options
    confidence_threshold: Mapped[float] = mapped_column(Float, default=0.8)
    extract_barcodes: Mapped[bool] = mapped_column(Boolean, default=True)
    language: Mapped[str] = mapped_column(String(5), default="en")

    # Results
    extracted_text: Mapped[str] = mapped_column(Text)
    confidence_score: Mapped[float] = mapped_column(Float)
    structured_data: Mapped[dict] = mapped_column(JSON)
    detected_barcodes: Mapped[dict] = mapped_column(JSON)
    processing_metadata: Mapped[dict] = mapped_column(JSON)

    # Timestamps
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    started_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str] = mapped_column(Text)

    # Performance metrics
    processing_time_ms: Mapped[int] = mapped_column(Integer)
    model_used: Mapped[str] = mapped_column(String(50))
    queue_wait_time_ms: Mapped[int] = mapped_column(Integer)


class OCRModelMetrics(Base):
    """Model for tracking OCR model performance metrics."""

    __tablename__ = "ocr_model_metrics"

    id: Mapped[UUID] = mapped_column(UUID, primary_key=True, server_default=func.gen_random_uuid())
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    model_version: Mapped[str] = mapped_column(String(20), nullable=False)

    # Accuracy metrics
    total_predictions: Mapped[int] = mapped_column(Integer, default=0)
    correct_predictions: Mapped[int] = mapped_column(Integer, default=0)
    accuracy_score: Mapped[float] = mapped_column(Float)

    # Field-specific accuracy
    product_name_accuracy: Mapped[float] = mapped_column(Float)
    price_accuracy: Mapped[float] = mapped_column(Float)
    barcode_accuracy: Mapped[float] = mapped_column(Float)

    # Performance metrics
    average_processing_time_ms: Mapped[int] = mapped_column(Integer)
    memory_usage_mb: Mapped[int] = mapped_column(Integer)
    cpu_usage_percent: Mapped[float] = mapped_column(Float)

    # Timestamps
    recorded_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    date: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.current_date())


class OCRErrorLog(Base):
    """Model for OCR processing error logging."""

    __tablename__ = "ocr_error_logs"

    id: Mapped[UUID] = mapped_column(UUID, primary_key=True, server_default=func.gen_random_uuid())
    job_id: Mapped[UUID] = mapped_column(UUID, ForeignKey("ocr_processing_jobs.id", ondelete="CASCADE"))

    # Error details
    error_type: Mapped[str] = mapped_column(String(50), nullable=False)
    error_code: Mapped[str] = mapped_column(String(20))
    error_message: Mapped[str] = mapped_column(Text, nullable=False)
    stack_trace: Mapped[str] = mapped_column(Text)
    image_url: Mapped[str] = mapped_column(Text)

    # Context
    model_used: Mapped[str] = mapped_column(String(50))
    processing_step: Mapped[str] = mapped_column(String(50))
    confidence_score: Mapped[float] = mapped_column(Float)

    # User context
    shop_id: Mapped[UUID] = mapped_column(UUID)
    user_id: Mapped[UUID] = mapped_column(UUID)
    user_agent: Mapped[str] = mapped_column(Text)
    ip_address: Mapped[str] = mapped_column(String(45))

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# Database utility functions
async def init_db() -> None:
    """Initialize database and create tables."""
    try:
        async with engine.begin() as conn:
            # Create all tables
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error("Failed to initialize database", error=str(e))
        raise


async def close_db() -> None:
    """Close database connections."""
    try:
        await engine.dispose()
        logger.info("Database connections closed")
    except Exception as e:
        logger.error("Error closing database connections", error=str(e))


async def get_db() -> AsyncSession:
    """Get database session (dependency for FastAPI)."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            await session.rollback()
            logger.error("Database session error", error=str(e))
            raise
        finally:
            await session.close()


# Health check function
async def check_database_health() -> dict:
    """Check database connectivity and health."""
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute("SELECT 1 as health_check")
            await result.fetchone()

        return {
            "status": "healthy",
            "database": "connected",
            "pool_size": settings.DATABASE_POOL_SIZE
        }
    except Exception as e:
        logger.error("Database health check failed", error=str(e))
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }

