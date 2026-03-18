#!/usr/bin/env python3
"""
Test Script for ZakPOS OCR Server
=================================

Basic test to verify OCR server functionality and model loading.
Run this script to validate the OCR implementation.
"""

import asyncio
import sys
import os
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

async def test_imports():
    """Test that all required modules can be imported."""
    print("🧪 Testing imports...")

    try:
        from app.core.config import settings
        print(f"✅ Configuration loaded: {settings.OCR_MODEL_PRIMARY}")

        from app.models.schemas import OCRRequest, OCRResult, OCRType
        print("✅ Schema models imported")

        from app.core.database import Base, OCRProcessingJob
        print("✅ Database models imported")

        from app.core.redis import redis_client
        print("✅ Redis module imported")

        return True
    except ImportError as e:
        print(f"❌ Import failed: {e}")
        return False

async def test_model_loading():
    """Test OCR model loading (without actually loading models)."""
    print("\n🧠 Testing model configuration...")

    try:
        from app.core.config import settings, MODEL_CONFIGS

        print(f"✅ Primary model: {settings.OCR_MODEL_PRIMARY}")
        print(f"✅ Fallback model: {settings.OCR_MODEL_FALLBACK}")
        print(f"✅ GPU enabled: {settings.OCR_ENABLE_GPU}")
        print(f"✅ Confidence threshold: {settings.OCR_CONFIDENCE_THRESHOLD}")

        # Check model configs
        for model_name, config in MODEL_CONFIGS.items():
            print(f"✅ Model config for {model_name}: {config}")

        return True
    except Exception as e:
        print(f"❌ Model configuration test failed: {e}")
        return False

async def test_database_schema():
    """Test database schema creation."""
    print("\n💾 Testing database schema...")

    try:
        from app.core.database import Base
        from app.core.config import settings

        print(f"✅ Database URL configured: {settings.DATABASE_URL.replace(settings.DATABASE_URL.split(':')[2].split('@')[0], '***')}")

        # Count tables in schema
        tables = [table.__tablename__ for table in Base.registry._class_registry.data.values() if hasattr(table, '__tablename__')]
        print(f"✅ Database tables defined: {tables}")

        return True
    except Exception as e:
        print(f"❌ Database schema test failed: {e}")
        return False

def test_api_structure():
    """Test API structure and endpoints."""
    print("\n🌐 Testing API structure...")

    try:
        from app.api.v1.api import api_router
        print("✅ API router created")

        # Check if FastAPI is properly configured
        from main import app
        print(f"✅ FastAPI app created: {app.title}")

        return True
    except Exception as e:
        print(f"❌ API structure test failed: {e}")
        return False

async def main():
    """Run all tests."""
    print("🚀 ZakPOS OCR Server Test Suite")
    print("=" * 50)

    tests = [
        ("Import Tests", test_imports),
        ("Model Configuration", test_model_loading),
        ("Database Schema", test_database_schema),
        ("API Structure", test_api_structure),
    ]

    passed = 0
    total = len(tests)

    for test_name, test_func in tests:
        print(f"\n📋 Running {test_name}...")
        if asyncio.iscoroutinefunction(test_func):
            success = await test_func()
        else:
            success = test_func()

        if success:
            passed += 1
            print(f"✅ {test_name} PASSED")
        else:
            print(f"❌ {test_name} FAILED")

    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All tests passed! OCR server is ready for development.")
        print("\n📝 Next steps:")
        print("1. Install dependencies: pip install -r requirements.txt")
        print("2. Set up environment: cp .env.example .env")
        print("3. Run database migrations")
        print("4. Start server: python main.py")
        print("5. Test endpoints: curl http://localhost:8000/health")
        return 0
    else:
        print("⚠️  Some tests failed. Check the errors above.")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

