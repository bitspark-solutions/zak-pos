"""
API Module for OCR Server
========================

FastAPI routes and endpoints for OCR processing operations.
"""

from .v1.api import api_router

__all__ = ["api_router"]


