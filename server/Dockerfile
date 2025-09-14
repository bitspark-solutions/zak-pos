# =============================================================================
# POCKET POS - NestJS API Dockerfile
# =============================================================================
# Multi-stage Docker build for NestJS backend API
# Optimized for production deployment with security and performance in mind

# =============================================================================
# STAGE 1: Base Dependencies
# =============================================================================
FROM node:22.19.0-alpine3.21 AS base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    tzdata

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# =============================================================================
# STAGE 2: Dependencies Installation
# =============================================================================
FROM base AS deps

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# =============================================================================
# STAGE 3: Build Stage
# =============================================================================
FROM base AS build

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client (if using Prisma)
# RUN npx prisma generate

# Build the application
RUN npm run build

# =============================================================================
# STAGE 4: Production Runtime
# =============================================================================
FROM base AS runtime

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3000

# Copy production dependencies from deps stage
COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy built application from build stage
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/package*.json ./

# Copy Prisma schema and migrations (if using Prisma)
# COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma

# Create logs directory
RUN mkdir -p /app/logs && chown nestjs:nodejs /app/logs

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application with dumb-init
CMD ["dumb-init", "node", "dist/main"]

# =============================================================================
# STAGE 5: Development Runtime
# =============================================================================
FROM base AS development

# Set environment to development
ENV NODE_ENV=development
ENV PORT=3000

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client (if using Prisma)
# RUN npx prisma generate

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/dist && chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Expose port and debug port
EXPOSE 3000 9229

# Start in development mode with hot reload
CMD ["npm", "run", "start:dev"]

# =============================================================================
# BUILD ARGUMENTS AND LABELS
# =============================================================================

# Build arguments
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

# Labels for metadata
LABEL maintainer="Pocket POS Team <dev@pocketpos.com>" \
      org.label-schema.build-date=$BUILD_DATE \
      org.label-schema.name="pocket-pos-api" \
      org.label-schema.description="Pocket POS NestJS API Server" \
      org.label-schema.url="https://pocketpos.com" \
      org.label-schema.vcs-ref=$VCS_REF \
      org.label-schema.vcs-url="https://github.com/pocketpos/api" \
      org.label-schema.vendor="Pocket POS" \
      org.label-schema.version=$VERSION \
      org.label-schema.schema-version="1.0"

# =============================================================================
# DOCKER BUILD COMMANDS
# =============================================================================
#
# Development build:
# docker build --target development -t pocket-pos-api:dev .
#
# Production build:
# docker build --target runtime -t pocket-pos-api:latest .
#
# Build with arguments:
# docker build \
#   --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
#   --build-arg VCS_REF=$(git rev-parse --short HEAD) \
#   --build-arg VERSION=$(git describe --tags --always) \
#   --target runtime \
#   -t pocket-pos-api:latest .
#
# =============================================================================

# =============================================================================
# OPTIMIZATION NOTES
# =============================================================================
#
# 1. Multi-stage build reduces final image size
# 2. Alpine Linux base for smaller footprint
# 3. Non-root user for security
# 4. dumb-init for proper signal handling
# 5. Health check for container orchestration
# 6. Separate development and production targets
# 7. .dockerignore file excludes unnecessary files
# 8. npm ci for faster, reliable, reproducible builds
# 9. Cache optimization with layer ordering
# 10. Security scanning friendly structure
#
# =============================================================================

# =============================================================================
# SECURITY CONSIDERATIONS
# =============================================================================
#
# 1. Non-root user (nestjs:nodejs)
# 2. Minimal base image (Alpine)
# 3. No unnecessary packages
# 4. Proper file permissions
# 5. Health checks for monitoring
# 6. Environment-specific builds
# 7. Secrets should be passed via environment variables
# 8. Regular base image updates
# 9. Vulnerability scanning in CI/CD
# 10. Read-only root filesystem (can be enabled)
#
# =============================================================================

# =============================================================================
# PERFORMANCE OPTIMIZATIONS
# =============================================================================
#
# 1. Layer caching optimization
# 2. Minimal runtime dependencies
# 3. Compiled TypeScript for faster startup
# 4. dumb-init for proper process management
# 5. Health checks for load balancer integration
# 6. Optimized Node.js flags (can be added to CMD)
# 7. Memory and CPU limits (set in docker-compose)
# 8. Connection pooling configuration
# 9. Logging optimization
# 10. Graceful shutdown handling
#
# =============================================================================