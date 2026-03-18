# =============================================================================
# ZakPOS OCR Server - Makefile
# =============================================================================
# Development commands for the OCR microservice

.PHONY: help test install-deps lint format clean build run dev

# Default target
.DEFAULT_GOAL := help

# =============================================================================
# DEVELOPMENT COMMANDS
# =============================================================================

help: ## Show this help message
	@echo "ZakPOS OCR Server - Development Commands"
	@echo "========================================"
	@echo ""
	@echo "Available Commands:"
	@echo ""
	@echo "  install-deps    Install Python dependencies"
	@echo "  test            Run all tests"
	@echo "  test-unit       Run unit tests only"
	@echo "  test-integration Run integration tests"
	@echo "  lint            Run code linting"
	@echo "  format          Format code with black and isort"
	@echo "  clean           Clean up cache and temp files"
	@echo "  build           Build Docker image"
	@echo "  run             Run development server"
	@echo "  dev             Run with hot reload"
	@echo "  health          Check service health"
	@echo "  logs            Show service logs"
	@echo "  shell           Open Python shell in container"
	@echo ""
	@echo "Examples:"
	@echo "  make install-deps  # Install dependencies"
	@echo "  make test         # Run test suite"
	@echo "  make dev          # Start development server"
	@echo "  make build        # Build Docker image"
	@echo ""

# =============================================================================
# DEPENDENCY MANAGEMENT
# =============================================================================

install-deps: ## Install Python dependencies
	@echo "Installing Python dependencies..."
	@pip install -r requirements.txt
	@echo "✅ Dependencies installed"

# =============================================================================
# TESTING
# =============================================================================

test: ## Run all tests
	@echo "Running test suite..."
	@python -m pytest tests/ -v --cov=app --cov-report=html
	@echo "✅ Tests completed"

test-unit: ## Run unit tests only
	@echo "Running unit tests..."
	@python -m pytest tests/test_*.py -v
	@echo "✅ Unit tests completed"

test-integration: ## Run integration tests
	@echo "Running integration tests..."
	@python -m pytest tests/test_integration.py -v
	@echo "✅ Integration tests completed"

test-ocr: ## Run OCR-specific tests
	@echo "Running OCR tests..."
	@python test_ocr.py
	@echo "✅ OCR tests completed"

# =============================================================================
# CODE QUALITY
# =============================================================================

lint: ## Run code linting
	@echo "Running linting..."
	@flake8 app/ --count --select=E9,F63,F7,F82 --show-source --statistics
	@flake8 app/ --count --exit-zero --max-complexity=10 --max-line-length=127 --statistics
	@mypy app/ || true
	@echo "✅ Linting completed"

format: ## Format code with black and isort
	@echo "Formatting code..."
	@black app/ tests/
	@isort app/ tests/
	@echo "✅ Code formatted"

# =============================================================================
# DEVELOPMENT SERVER
# =============================================================================

run: ## Run production server
	@echo "Starting OCR server..."
	@python main.py

dev: ## Run development server with hot reload
	@echo "Starting OCR server with hot reload..."
	@uvicorn main:app --reload --host 0.0.0.0 --port 8000

health: ## Check service health
	@echo "Checking OCR service health..."
	@curl -f http://localhost:8000/api/v1/health || echo "❌ Health check failed"

# =============================================================================
# DOCKER
# =============================================================================

build: ## Build Docker image
	@echo "Building OCR Docker image..."
	@docker build -t zakpos-ocr:latest .
	@echo "✅ Docker image built"

build-dev: ## Build development Docker image
	@echo "Building OCR development image..."
	@docker build -t zakpos-ocr:dev --target development .
	@echo "✅ Development image built"

run-docker: ## Run with Docker
	@echo "Running OCR server with Docker..."
	@docker run -p 8000:8000 --env-file ../.env zakpos-ocr:latest

test-docker: ## Test OCR server in Docker
	@echo "Testing OCR server in Docker..."
	@docker run --rm -p 8000:8000 zakpos-ocr:latest &
	@sleep 10
	@curl -f http://localhost:8000/api/v1/health || echo "❌ Health check failed"
	@curl -f http://localhost:8000/docs || echo "❌ Docs endpoint failed"
	@pkill -f "zakpos-ocr:latest"
	@echo "✅ Docker test completed"

run-compose: ## Run with Docker Compose
	@echo "Starting OCR server with Docker Compose..."
	@cd ../.. && docker-compose up -d ocr
	@echo "✅ OCR server started"
	@echo "Health check: http://localhost:58000/api/v1/health"
	@echo "API docs: http://localhost:58000/docs"

stop-compose: ## Stop Docker Compose OCR service
	@echo "Stopping OCR server..."
	@cd ../.. && docker-compose stop ocr
	@echo "✅ OCR server stopped"

logs-compose: ## View OCR logs from Docker Compose
	@cd ../.. && docker-compose logs -f ocr

# =============================================================================
# CLEANUP
# =============================================================================

clean: ## Clean up cache and temp files
	@echo "Cleaning up..."
	@rm -rf __pycache__/
	@rm -rf .pytest_cache/
	@rm -rf htmlcov/
	@rm -rf .coverage
	@find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	@find . -name "*.pyc" -delete 2>/dev/null || true
	@echo "✅ Cleanup completed"

clean-docker: ## Clean up Docker containers and images
	@echo "Cleaning up Docker..."
	@docker stop zakpos-ocr 2>/dev/null || true
	@docker rm zakpos-ocr 2>/dev/null || true
	@docker rmi zakpos-ocr:latest 2>/dev/null || true
	@docker rmi zakpos-ocr:dev 2>/dev/null || true
	@echo "✅ Docker cleanup completed"

# =============================================================================
# UTILITIES
# =============================================================================

shell: ## Open Python shell with OCR modules loaded
	@echo "Opening Python shell..."
	@python3 -c "
import sys
sys.path.insert(0, '.')
from app.core.config import settings
from app.models.schemas import OCRRequest, OCRType
print('OCR Server modules loaded successfully!')
print(f'Model: {settings.OCR_MODEL_PRIMARY}')
print('Available types:', [t.value for t in OCRType])
"

logs: ## Show recent logs (when running in Docker)
	@docker-compose logs -f ocr

update-deps: ## Update dependencies to latest versions
	@echo "Updating dependencies..."
	@pip install --upgrade -r requirements.txt
	@echo "✅ Dependencies updated"

# =============================================================================
# VALIDATION
# =============================================================================

validate: ## Validate project structure and configuration
	@echo "Validating project..."
	@python3 -m py_compile main.py
	@python3 -m py_compile app/core/config.py
	@python3 -m py_compile app/models/schemas.py
	@python3 -m py_compile app/services/ocr_service.py
	@python3 -c "from app.core.config import settings; print('✅ Configuration valid')"
	@echo "✅ Project validation completed"

check-models: ## Check if OCR models can be loaded
	@echo "Checking OCR model availability..."
	@python3 -c "
try:
    from transformers import TrOCRProcessor
    print('✅ TrOCR processor available')
except ImportError:
    print('❌ TrOCR processor not available')

try:
    import pytesseract
    print('✅ Tesseract available')
except ImportError:
    print('❌ Tesseract not available')
"
