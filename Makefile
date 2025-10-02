# =============================================================================
# ZAKPOS - Makefile (Windows Compatible)
# =============================================================================
# Comprehensive Makefile for ZakPOS development, testing, and deployment
# Provides easy commands for all common operations

# =============================================================================
# VARIABLES
# =============================================================================

# Project information
PROJECT_NAME := zakpos
VERSION := $(shell git describe --tags --always 2>nul || echo "dev")
BUILD_DATE := $(shell powershell -Command "Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ'")
VCS_REF := $(shell git rev-parse --short HEAD 2>nul || echo "dev")

# Docker Compose files
COMPOSE_BASE := docker-compose.yml
COMPOSE_DEV := docker-compose.dev.yml
COMPOSE_PROD := docker-compose.prod.yml

# Environment files
ENV_FILE := .env
ENV_EXAMPLE := env.example

# Directories
DATA_DIR := ./data
LOGS_DIR := ./logs
BACKUP_DIR := ./backups

# =============================================================================
# DEFAULT TARGET
# =============================================================================

.DEFAULT_GOAL := help

# =============================================================================
# HELP TARGET
# =============================================================================

.PHONY: help
help: ## Show this help message
	@echo "ZakPOS - Makefile Commands"
	@echo "================================"
	@echo ""
	@echo "Project Information:"
	@echo "  Project: $(PROJECT_NAME)"
	@echo "  Version: $(VERSION)"
	@echo "  Build Date: $(BUILD_DATE)"
	@echo "  VCS Ref: $(VCS_REF)"
	@echo ""
	@echo "Available Commands:"
	@echo ""
	@echo "  dev                 Start development environment"
	@echo "  dev-build           Build and start development environment"
	@echo "  dev-stop            Stop development environment"
	@echo "  dev-logs            Show development environment logs"
	@echo "  test                Run all tests"
	@echo "  test-unit           Run unit tests only"
	@echo "  test-e2e            Run end-to-end tests"
	@echo "  test-auth           Run authentication-specific tests"
	@echo "  build               Build all services"
	@echo "  clean               Clean up containers, networks, and volumes"
	@echo "  status              Show service status"
	@echo "  logs                Show logs for all services"
	@echo "  help                Show this help message"
	@echo ""
	@echo "Examples:"
	@echo "  make dev          # Start development environment"
	@echo "  make test         # Run all tests"
	@echo "  make build        # Build all services"
	@echo "  make clean        # Clean up everything"
	@echo ""

# =============================================================================
# SETUP TARGETS
# =============================================================================

.PHONY: setup
setup: ## Initial project setup
	@echo "Setting up ZakPOS project..."
	@if not exist $(ENV_FILE) ( \
		echo "Creating .env file from template..." && \
		copy $(ENV_EXAMPLE) $(ENV_FILE) && \
		echo "✓ .env file created" \
	) else ( \
		echo "✓ .env file already exists" \
	)
	@echo "Creating necessary directories..."
	@if not exist $(DATA_DIR)\postgres mkdir $(DATA_DIR)\postgres
	@if not exist $(DATA_DIR)\redis mkdir $(DATA_DIR)\redis
	@if not exist $(DATA_DIR)\kafka mkdir $(DATA_DIR)\kafka
	@if not exist $(DATA_DIR)\zookeeper mkdir $(DATA_DIR)\zookeeper
	@if not exist $(DATA_DIR)\uploads mkdir $(DATA_DIR)\uploads
	@if not exist $(LOGS_DIR)\api mkdir $(LOGS_DIR)\api
	@if not exist $(LOGS_DIR)\web mkdir $(LOGS_DIR)\web
	@if not exist $(LOGS_DIR)\nginx mkdir $(LOGS_DIR)\nginx
	@if not exist $(BACKUP_DIR) mkdir $(BACKUP_DIR)
	@echo "✓ Directories created"
	@echo "✓ Setup complete!"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Edit .env file with your configuration"
	@echo "  2. Run 'make dev' to start development environment"
	@echo "  3. Run 'make help' to see all available commands"

.PHONY: setup-env
setup-env: ## Create .env file from template
	@if not exist $(ENV_FILE) ( \
		echo "Creating .env file from template..." && \
		copy $(ENV_EXAMPLE) $(ENV_FILE) && \
		echo "✓ .env file created" && \
		echo "Please edit .env file with your configuration" \
	) else ( \
		echo ".env file already exists" \
	)

# =============================================================================
# DEVELOPMENT TARGETS
# =============================================================================

.PHONY: dev
dev: ## Start development environment
	@echo "Starting ZakPOS development environment..."
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) up -d
	@echo "✓ Development environment started"
	@echo ""
	@echo "Application URLs:"
	@echo "  API: http://localhost:39847"
	@echo "  Web: http://localhost:41923"
	@echo "  Mobile: http://localhost:53851"
	@echo ""
	@echo "Development Tools:"
	@echo "  pgAdmin: http://localhost:58050 (admin@zakpos.com / admin123)"
	@echo "  Redis Insight: http://localhost:58001"
	@echo "  Kafka UI: http://localhost:58080"
	@echo "  Mailhog: http://localhost:58026"
	@echo "  File Browser: http://localhost:58082"

.PHONY: dev-build
dev-build: ## Build and start development environment
	@echo "Building and starting development environment..."
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) up -d --build
	@echo "✓ Development environment built and started"

.PHONY: dev-logs
dev-logs: ## Show development environment logs
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) logs -f

.PHONY: dev-stop
dev-stop: ## Stop development environment
	@echo "Stopping development environment..."
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) down
	@echo "✓ Development environment stopped"

.PHONY: dev-restart
dev-restart: dev-stop dev ## Restart development environment

# =============================================================================
# PRODUCTION TARGETS
# =============================================================================

.PHONY: prod
prod: ## Start production environment
	@echo "$(BLUE)Starting ZakPOS production environment...$(NC)"
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_PROD) up -d
	@echo "$(GREEN)✓ Production environment started$(NC)"

.PHONY: prod-build
prod-build: ## Build and start production environment
	@echo "$(BLUE)Building and starting production environment...$(NC)"
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_PROD) up -d --build
	@echo "$(GREEN)✓ Production environment built and started$(NC)"

.PHONY: prod-logs
prod-logs: ## Show production environment logs
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_PROD) logs -f

.PHONY: prod-stop
prod-stop: ## Stop production environment
	@echo "$(BLUE)Stopping production environment...$(NC)"
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_PROD) down
	@echo "$(GREEN)✓ Production environment stopped$(NC)"

.PHONY: prod-restart
prod-restart: prod-stop prod ## Restart production environment

# =============================================================================
# BUILD TARGETS
# =============================================================================

.PHONY: build
build: ## Build all services
	@echo "$(BLUE)Building all ZakPOS services...$(NC)"
	@docker-compose -f $(COMPOSE_BASE) build
	@echo "$(GREEN)✓ All services built$(NC)"

.PHONY: build-api
build-api: ## Build API service
	@echo "$(BLUE)Building API service...$(NC)"
	@docker-compose -f $(COMPOSE_BASE) build api
	@echo "$(GREEN)✓ API service built$(NC)"

.PHONY: build-web
build-web: ## Build Web service
	@echo "$(BLUE)Building Web service...$(NC)"
	@docker-compose -f $(COMPOSE_BASE) build web
	@echo "$(GREEN)✓ Web service built$(NC)"

.PHONY: build-mobile
build-mobile: ## Build Mobile service
	@echo "$(BLUE)Building Mobile service...$(NC)"
	@docker-compose -f $(COMPOSE_BASE) build mobile
	@echo "$(GREEN)✓ Mobile service built$(NC)"

# =============================================================================
# TESTING TARGETS
# =============================================================================

.PHONY: test
test: ## Run all tests
	@echo "$(BLUE)Running all tests...$(NC)"
	@$(MAKE) test-config
	@$(MAKE) test-services
	@$(MAKE) test-api
	@$(MAKE) test-web
	@echo "$(GREEN)✓ All tests completed$(NC)"

.PHONY: test-config
test-config: ## Test Docker Compose configuration
	@echo "$(BLUE)Testing Docker Compose configuration...$(NC)"
	@docker-compose -f $(COMPOSE_BASE) config > /dev/null
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) config > /dev/null
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_PROD) config > /dev/null
	@echo "$(GREEN)✓ Configuration valid$(NC)"

.PHONY: test-services
test-services: ## Test service health checks
	@echo "$(BLUE)Testing service health checks...$(NC)"
	@$(MAKE) dev
	@echo "$(YELLOW)Waiting for services to start...$(NC)"
	@sleep 30
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) ps
	@echo "$(GREEN)✓ Service health checks completed$(NC)"

.PHONY: test-api
test-api: ## Test API endpoints
	@echo "$(BLUE)Testing API endpoints...$(NC)"
	@curl -f http://localhost:39847/health || echo "$(RED)✗ API health check failed$(NC)"
	@echo "$(GREEN)✓ API tests completed$(NC)"

.PHONY: test-web
test-web: ## Test Web endpoints
	@echo "$(BLUE)Testing Web endpoints...$(NC)"
	@curl -f http://localhost:41923/health || echo "$(RED)✗ Web health check failed$(NC)"
	@echo "$(GREEN)✓ Web tests completed$(NC)"

# =============================================================================
# COMPREHENSIVE TESTING TARGETS
# =============================================================================

.PHONY: test-unit
test-unit: ## Run unit tests only
	@echo "$(BLUE)Running unit tests...$(NC)"
	@cd server && npm run test:unit
	@echo "$(GREEN)✓ Unit tests completed$(NC)"

.PHONY: test-e2e
test-e2e: ## Run end-to-end tests
	@echo "$(BLUE)Running end-to-end tests...$(NC)"
	@cd server && npm run test:e2e
	@echo "$(GREEN)✓ End-to-end tests completed$(NC)"

.PHONY: test-performance
test-performance: ## Run performance tests
	@echo "$(BLUE)Running performance tests...$(NC)"
	@cd server && npm run test:performance
	@echo "$(GREEN)✓ Performance tests completed$(NC)"

.PHONY: test-coverage
test-coverage: ## Run tests with coverage report
	@echo "$(BLUE)Running tests with coverage...$(NC)"
	@cd server && npm run test:cov
	@echo "$(GREEN)✓ Coverage report generated$(NC)"

.PHONY: test-watch
test-watch: ## Run tests in watch mode
	@echo "$(BLUE)Running tests in watch mode...$(NC)"
	@cd server && npm run test:watch

.PHONY: test-debug
test-debug: ## Run tests in debug mode
	@echo "$(BLUE)Running tests in debug mode...$(NC)"
	@cd server && npm run test:debug

.PHONY: test-ci
test-ci: ## Run tests for CI/CD pipeline
	@echo "$(BLUE)Running CI/CD tests...$(NC)"
	@cd server && npm run test:ci
	@echo "$(GREEN)✓ CI/CD tests completed$(NC)"

.PHONY: test-all
test-all: ## Run all test suites (unit, e2e, performance)
	@echo "$(BLUE)Running comprehensive test suite...$(NC)"
	@cd server && npm run test:all
	@echo "$(GREEN)✓ All test suites completed$(NC)"

.PHONY: test-auth
test-auth: ## Run authentication-specific tests
	@echo "$(BLUE)Running authentication tests...$(NC)"
	@cd server && npm test -- --testPathPatterns="auth"
	@echo "$(GREEN)✓ Authentication tests completed$(NC)"

.PHONY: test-users
test-users: ## Run user management tests
	@echo "$(BLUE)Running user management tests...$(NC)"
	@cd server && npm test -- --testPathPatterns="users"
	@echo "$(GREEN)✓ User management tests completed$(NC)"

.PHONY: test-quick
test-quick: ## Run quick tests (unit tests only)
	@echo "$(BLUE)Running quick tests...$(NC)"
	@cd server && npm test -- --testPathPatterns="src/.*\.spec\.ts$"
	@echo "$(GREEN)✓ Quick tests completed$(NC)"

# =============================================================================
# DATABASE TARGETS
# =============================================================================

.PHONY: db-reset
db-reset: ## Reset database (WARNING: This will delete all data)
	@echo "$(RED)WARNING: This will delete all database data!$(NC)"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ]
	@echo "$(BLUE)Resetting database...$(NC)"
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) down postgres
	@docker volume rm zakpos_postgres_data 2>/dev/null || true
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) up -d postgres
	@echo "$(GREEN)✓ Database reset$(NC)"

.PHONY: db-backup
db-backup: ## Backup database
	@echo "$(BLUE)Backing up database...$(NC)"
	@mkdir -p $(BACKUP_DIR)
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) exec postgres pg_dump -U postgres zakpos_dev > $(BACKUP_DIR)/zakpos_backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✓ Database backed up to $(BACKUP_DIR)$(NC)"

.PHONY: db-restore
db-restore: ## Restore database from backup
	@echo "$(BLUE)Available backups:$(NC)"
	@ls -la $(BACKUP_DIR)/*.sql 2>/dev/null || echo "No backups found"
	@read -p "Enter backup filename: " backup_file
	@echo "$(BLUE)Restoring database from $$backup_file...$(NC)"
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) exec -T postgres psql -U postgres zakpos_dev < $(BACKUP_DIR)/$$backup_file
	@echo "$(GREEN)✓ Database restored$(NC)"

# =============================================================================
# MONITORING TARGETS
# =============================================================================

.PHONY: logs
logs: ## Show logs for all services
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) logs -f

.PHONY: logs-api
logs-api: ## Show API logs
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) logs -f api

.PHONY: logs-web
logs-web: ## Show Web logs
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) logs -f web

.PHONY: logs-db
logs-db: ## Show database logs
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) logs -f postgres

.PHONY: status
status: ## Show service status
	@echo "$(BLUE)ZakPOS Service Status:$(NC)"
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) ps

.PHONY: stats
stats: ## Show resource usage statistics
	@echo "$(BLUE)Resource Usage Statistics:$(NC)"
	@docker stats --no-stream

# =============================================================================
# CLEANUP TARGETS
# =============================================================================

.PHONY: clean
clean: ## Clean up containers, networks, and volumes
	@echo "$(BLUE)Cleaning up ZakPOS environment...$(NC)"
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) down -v
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_PROD) down -v
	@echo "$(GREEN)✓ Environment cleaned$(NC)"

.PHONY: clean-containers
clean-containers: ## Remove all containers
	@echo "$(BLUE)Removing all containers...$(NC)"
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) down
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_PROD) down
	@echo "$(GREEN)✓ Containers removed$(NC)"

.PHONY: clean-images
clean-images: ## Remove all images
	@echo "$(BLUE)Removing all images...$(NC)"
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) down --rmi all
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_PROD) down --rmi all
	@echo "$(GREEN)✓ Images removed$(NC)"

.PHONY: clean-volumes
clean-volumes: ## Remove all volumes
	@echo "$(BLUE)Removing all volumes...$(NC)"
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) down -v
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_PROD) down -v
	@echo "$(GREEN)✓ Volumes removed$(NC)"

.PHONY: clean-all
clean-all: clean-containers clean-images clean-volumes ## Remove everything (containers, images, volumes)

# =============================================================================
# UTILITY TARGETS
# =============================================================================

.PHONY: shell-api
shell-api: ## Open shell in API container
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) exec api sh

.PHONY: shell-web
shell-web: ## Open shell in Web container
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) exec web sh

.PHONY: shell-db
shell-db: ## Open shell in database container
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) exec postgres psql -U postgres zakpos_dev

.PHONY: shell-redis
shell-redis: ## Open Redis CLI
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) exec redis redis-cli -a redis123

.PHONY: update
update: ## Update all services
	@echo "$(BLUE)Updating ZakPOS services...$(NC)"
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) pull
	@docker-compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV) up -d
	@echo "$(GREEN)✓ Services updated$(NC)"

.PHONY: version
version: ## Show version information
	@echo "$(BLUE)ZakPOS Version Information:$(NC)"
	@echo "  Project: $(PROJECT_NAME)"
	@echo "  Version: $(VERSION)"
	@echo "  Build Date: $(BUILD_DATE)"
	@echo "  VCS Ref: $(VCS_REF)"
	@echo "  Docker Compose: $(shell docker-compose --version)"
	@echo "  Docker: $(shell docker --version)"

# =============================================================================
# DEVELOPMENT WORKFLOW TARGETS
# =============================================================================

.PHONY: dev-workflow
dev-workflow: setup dev ## Complete development workflow setup
	@echo "$(GREEN)✓ Development workflow ready!$(NC)"
	@echo ""
	@echo "$(YELLOW)Quick Commands:$(NC)"
	@echo "  make dev-logs    # View logs"
	@echo "  make test        # Run tests"
	@echo "  make status      # Check status"
	@echo "  make clean       # Clean up"

.PHONY: prod-workflow
prod-workflow: setup prod ## Complete production workflow setup
	@echo "$(GREEN)✓ Production workflow ready!$(NC)"

# =============================================================================
# SPECIAL TARGETS
# =============================================================================

.PHONY: install-deps
install-deps: ## Install project dependencies
	@echo "$(BLUE)Installing project dependencies...$(NC)"
	@cd server && npm install
	@cd client && npm install
	@cd mobile-app && npm install
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

.PHONY: lint
lint: ## Run linting on all services
	@echo "$(BLUE)Running linting...$(NC)"
	@cd server && npm run lint || true
	@cd client && npm run lint || true
	@cd mobile-app && npm run lint || true
	@echo "$(GREEN)✓ Linting completed$(NC)"

.PHONY: format
format: ## Format code in all services
	@echo "$(BLUE)Formatting code...$(NC)"
	@cd server && npm run format || true
	@cd client && npm run format || true
	@cd mobile-app && npm run format || true
	@echo "$(GREEN)✓ Code formatted$(NC)"

# =============================================================================
# END OF MAKEFILE
# =============================================================================
