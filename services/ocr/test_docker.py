#!/usr/bin/env python3
"""
Docker Test Script for ZakPOS OCR Server
=======================================

Test script to verify OCR server functionality in Docker environment.
Run this to validate the complete Docker setup.
"""

import asyncio
import subprocess
import time
import requests
import json
from pathlib import Path

def run_command(command: str, timeout: int = 30) -> tuple:
    """Run a shell command and return (returncode, stdout, stderr)."""
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", f"Command timed out after {timeout} seconds"

def test_docker_build():
    """Test Docker image build."""
    print("🏗️  Testing Docker build...")

    returncode, stdout, stderr = run_command("docker build -t zakpos-ocr:test .")

    if returncode == 0:
        print("✅ Docker build successful")
        return True
    else:
        print("❌ Docker build failed:")
        print(stderr)
        return False

def test_docker_run():
    """Test running OCR server in Docker."""
    print("\n🚀 Testing Docker run...")

    # Start container in background
    print("Starting OCR container...")
    returncode, stdout, stderr = run_command(
        "docker run -d --name zakpos-ocr-test -p 8000:8000 zakpos-ocr:test"
    )

    if returncode != 0:
        print("❌ Failed to start container:")
        print(stderr)
        return False

    container_id = stdout.strip()
    print(f"✅ Container started: {container_id[:12]}")

    try:
        # Wait for server to start
        print("Waiting for server to be ready...")
        for i in range(30):  # 30 seconds timeout
            try:
                response = requests.get("http://localhost:8000/api/v1/health", timeout=5)
                if response.status_code == 200:
                    print("✅ Health check passed")
                    break
            except requests.exceptions.RequestException:
                time.sleep(1)

        # Test API endpoints
        print("Testing API endpoints...")

        # Root endpoint
        try:
            response = requests.get("http://localhost:8000/", timeout=5)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Root endpoint: {data.get('service', 'Unknown')}")
            else:
                print(f"⚠️  Root endpoint returned {response.status_code}")
        except Exception as e:
            print(f"⚠️  Root endpoint failed: {e}")

        # Health endpoint
        try:
            response = requests.get("http://localhost:8000/api/v1/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Health check: {data.get('status', 'Unknown')}")
                print(f"   Database: {data.get('services', {}).get('database', {}).get('status', 'Unknown')}")
                print(f"   Redis: {data.get('services', {}).get('redis', {}).get('status', 'Unknown')}")
                print(f"   OCR: {data.get('services', {}).get('ocr_service', {}).get('status', 'Unknown')}")
            else:
                print(f"⚠️  Health endpoint returned {response.status_code}")
        except Exception as e:
            print(f"⚠️  Health endpoint failed: {e}")

        # Docs endpoint
        try:
            response = requests.get("http://localhost:8000/docs", timeout=5)
            if response.status_code == 200:
                print("✅ API documentation available")
            else:
                print(f"⚠️  Docs endpoint returned {response.status_code}")
        except Exception as e:
            print(f"⚠️  Docs endpoint failed: {e}")

        return True

    finally:
        # Clean up
        print("Cleaning up container...")
        run_command("docker stop zakpos-ocr-test")
        run_command("docker rm zakpos-ocr-test")
        print("✅ Cleanup completed")

def test_docker_compose():
    """Test OCR server with Docker Compose."""
    print("\n🐳 Testing Docker Compose integration...")

    try:
        # Check if required services are running
        returncode, stdout, stderr = run_command("docker-compose ps --format table")
        if returncode != 0:
            print("❌ Docker Compose not available or no services running")
            print("Run: docker-compose up -d postgres redis kafka")
            return False

        # Check if OCR service exists in compose
        if "ocr" in stdout.lower():
            print("✅ OCR service found in Docker Compose")

            # Start OCR service
            print("Starting OCR service...")
            returncode, stdout, stderr = run_command("docker-compose up -d ocr")

            if returncode == 0:
                print("✅ OCR service started with Docker Compose")

                # Wait for service to be ready
                print("Waiting for OCR service...")
                for i in range(60):  # 60 seconds timeout
                    try:
                        response = requests.get("http://localhost:58000/api/v1/health", timeout=5)
                        if response.status_code == 200:
                            data = response.json()
                            print(f"✅ OCR service ready: {data.get('status', 'Unknown')}")
                            print(f"   Model: {data.get('model', 'Unknown')}")
                            print(f"   Database: {data.get('services', {}).get('database', {}).get('status', 'Unknown')}")
                            return True
                    except requests.exceptions.RequestException:
                        time.sleep(1)

                print("⚠️  OCR service didn't become ready within timeout")

            else:
                print("❌ Failed to start OCR service:")
                print(stderr)

        else:
            print("❌ OCR service not found in Docker Compose")
            print("Make sure OCR service is added to docker-compose.yml")

        return False

    except Exception as e:
        print(f"❌ Docker Compose test failed: {e}")
        return False

def test_environment_variables():
    """Test environment variable configuration."""
    print("\n🔧 Testing environment variables...")

    # Check if .env.example exists
    env_example = Path("../.env.example")
    if env_example.exists():
        print("✅ .env.example found")

        # Check if OCR variables are present
        content = env_example.read_text()
        ocr_vars = [
            "OCR_PORT",
            "OCR_MODEL_PRIMARY",
            "OCR_MODEL_FALLBACK",
            "OCR_ENABLE_GPU"
        ]

        missing_vars = []
        for var in ocr_vars:
            if var not in content:
                missing_vars.append(var)

        if missing_vars:
            print(f"⚠️  Missing OCR variables in .env.example: {missing_vars}")
        else:
            print("✅ All OCR variables found in .env.example")

        return len(missing_vars) == 0
    else:
        print("❌ .env.example not found")
        return False

async def main():
    """Run all Docker tests."""
    print("🧪 ZakPOS OCR Server Docker Test Suite")
    print("=" * 60)

    tests = [
        ("Environment Variables", test_environment_variables),
        ("Docker Build", test_docker_build),
        ("Docker Run", test_docker_run),
        ("Docker Compose", test_docker_compose),
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

    print("\n" + "=" * 60)
    print(f"📊 Docker Test Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All Docker tests passed!")
        print("\n🚀 Ready for production deployment!")
        print("\n📝 Quick Start Commands:")
        print("  docker-compose up -d ocr           # Start OCR server")
        print("  curl http://localhost:58000/health # Check health")
        print("  curl http://localhost:58000/docs   # View API docs")
        return 0
    else:
        print("⚠️  Some tests failed. Check the errors above.")
        print("\n🔧 Troubleshooting:")
        print("  1. Make sure Docker is running")
        print("  2. Check Docker Compose configuration")
        print("  3. Verify environment variables")
        print("  4. Check system resources")
        return 1

if __name__ == "__main__":
    import sys
    exit_code = asyncio.run(main())
    sys.exit(exit_code)








