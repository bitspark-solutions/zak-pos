"""
Redis Configuration for ZakPOS OCR Server
========================================

Redis setup for caching, queuing, and session management.
"""

import redis.asyncio as redis
import structlog
from typing import Optional

from app.core.config import settings

# Configure logging
logger = structlog.get_logger(__name__)

# Redis connection pool
redis_pool: Optional[redis.ConnectionPool] = None
redis_client: Optional[redis.Redis] = None


async def init_redis() -> None:
    """Initialize Redis connection pool."""
    global redis_pool, redis_client

    try:
        # Create connection pool
        redis_pool = redis.ConnectionPool.from_url(
            settings.REDIS_URL,
            max_connections=settings.DATABASE_POOL_SIZE,
            decode_responses=True,
        )

        # Create Redis client
        redis_client = redis.Redis(connection_pool=redis_pool)

        # Test connection
        await redis_client.ping()
        logger.info("Redis connected successfully", url=settings.REDIS_URL)

    except Exception as e:
        logger.error("Failed to connect to Redis", error=str(e), url=settings.REDIS_URL)
        raise


async def close_redis() -> None:
    """Close Redis connections."""
    global redis_pool, redis_client

    try:
        if redis_client:
            await redis_client.close()
        if redis_pool:
            await redis_pool.disconnect()
        logger.info("Redis connections closed")
    except Exception as e:
        logger.error("Error closing Redis connections", error=str(e))


async def get_redis() -> redis.Redis:
    """Get Redis client instance."""
    if not redis_client:
        raise RuntimeError("Redis not initialized. Call init_redis() first.")
    return redis_client


# Cache utility functions
async def cache_ocr_result(job_id: str, result: dict, ttl_seconds: int = None) -> None:
    """Cache OCR processing result."""
    if not redis_client:
        return

    try:
        cache_key = f"ocr:result:{job_id}"
        ttl = ttl_seconds or settings.OCR_CACHE_TTL_SECONDS

        await redis_client.setex(
            cache_key,
            ttl,
            result
        )
        logger.debug("Cached OCR result", job_id=job_id, ttl=ttl)
    except Exception as e:
        logger.error("Failed to cache OCR result", error=str(e), job_id=job_id)


async def get_cached_ocr_result(job_id: str) -> Optional[dict]:
    """Get cached OCR result."""
    if not redis_client:
        return None

    try:
        cache_key = f"ocr:result:{job_id}"
        result = await redis_client.get(cache_key)
        if result:
            logger.debug("Retrieved cached OCR result", job_id=job_id)
            return result
    except Exception as e:
        logger.error("Failed to get cached OCR result", error=str(e), job_id=job_id)

    return None


async def cache_model_features(image_hash: str, features: dict) -> None:
    """Cache image features for faster processing."""
    if not redis_client:
        return

    try:
        cache_key = f"ocr:features:{image_hash}"
        await redis_client.setex(
            cache_key,
            86400,  # 24 hours
            features
        )
        logger.debug("Cached model features", image_hash=image_hash)
    except Exception as e:
        logger.error("Failed to cache model features", error=str(e), image_hash=image_hash)


async def get_cached_model_features(image_hash: str) -> Optional[dict]:
    """Get cached image features."""
    if not redis_client:
        return None

    try:
        cache_key = f"ocr:features:{image_hash}"
        features = await redis_client.get(cache_key)
        if features:
            logger.debug("Retrieved cached model features", image_hash=image_hash)
            return features
    except Exception as e:
        logger.error("Failed to get cached model features", error=str(e), image_hash=image_hash)

    return None


# Queue management functions
async def add_to_processing_queue(job_id: str, priority: str = "normal") -> None:
    """Add job to processing queue."""
    if not redis_client:
        return

    try:
        if priority == "high":
            queue_key = "ocr:queue:high"
        else:
            queue_key = "ocr:queue:normal"

        await redis_client.lpush(queue_key, job_id)
        logger.debug("Added job to processing queue", job_id=job_id, priority=priority)
    except Exception as e:
        logger.error("Failed to add job to queue", error=str(e), job_id=job_id)


async def get_queue_length() -> dict:
    """Get current queue lengths."""
    if not redis_client:
        return {"high": 0, "normal": 0, "total": 0}

    try:
        high_queue = await redis_client.llen("ocr:queue:high")
        normal_queue = await redis_client.llen("ocr:queue:normal")
        return {
            "high": high_queue,
            "normal": normal_queue,
            "total": high_queue + normal_queue
        }
    except Exception as e:
        logger.error("Failed to get queue length", error=str(e))
        return {"high": 0, "normal": 0, "total": 0}


async def get_next_job_id(priority: str = "high") -> Optional[str]:
    """Get next job from processing queue."""
    if not redis_client:
        return None

    try:
        if priority == "high":
            queue_key = "ocr:queue:high"
        else:
            queue_key = "ocr:queue:normal"

        job_id = await redis_client.rpop(queue_key)
        if job_id:
            logger.debug("Retrieved job from queue", job_id=job_id, priority=priority)
        return job_id
    except Exception as e:
        logger.error("Failed to get next job from queue", error=str(e))
        return None


# Rate limiting functions
async def check_rate_limit(user_id: str, shop_id: str) -> bool:
    """Check if user/shop has exceeded rate limit."""
    if not redis_client:
        return True  # Allow if Redis unavailable

    try:
        # Check per-user limit
        user_key = f"rate_limit:user:{user_id}"
        user_count = await redis_client.get(user_key) or 0

        # Check per-shop limit
        shop_key = f"rate_limit:shop:{shop_id}"
        shop_count = await redis_client.get(shop_key) or 0

        return int(user_count) < settings.RATE_LIMIT_REQUESTS_PER_MINUTE and \
               int(shop_count) < (settings.RATE_LIMIT_REQUESTS_PER_MINUTE * 10)
    except Exception as e:
        logger.error("Failed to check rate limit", error=str(e))
        return True  # Allow if check fails


async def increment_rate_limit(user_id: str, shop_id: str) -> None:
    """Increment rate limit counters."""
    if not redis_client:
        return

    try:
        # Increment per-user counter (expires in 1 minute)
        user_key = f"rate_limit:user:{user_id}"
        await redis_client.incr(user_key)
        await redis_client.expire(user_key, 60)

        # Increment per-shop counter (expires in 1 minute)
        shop_key = f"rate_limit:shop:{shop_id}"
        await redis_client.incr(shop_key)
        await redis_client.expire(shop_key, 60)

    except Exception as e:
        logger.error("Failed to increment rate limit", error=str(e))


# Health check function
async def check_redis_health() -> dict:
    """Check Redis connectivity and health."""
    try:
        if not redis_client:
            return {"status": "disconnected", "error": "Not initialized"}

        # Test basic operations
        await redis_client.ping()
        info = await redis_client.info()

        return {
            "status": "healthy",
            "redis": "connected",
            "version": info.get("redis_version", "unknown"),
            "connected_clients": info.get("connected_clients", 0),
            "used_memory": info.get("used_memory_human", "unknown")
        }
    except Exception as e:
        logger.error("Redis health check failed", error=str(e))
        return {
            "status": "unhealthy",
            "redis": "disconnected",
            "error": str(e)
        }










