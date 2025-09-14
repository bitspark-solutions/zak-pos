# =============================================================================
# POCKET POS - NextJS Web Client Dockerfile
# =============================================================================
# Multi-stage Docker build for NextJS frontend application
# Optimized for production deployment with security and performance in mind

# =============================================================================
# STAGE 1: Base Dependencies
# =============================================================================
FROM node:22.19.0-alpine3.21 AS base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    libc6-compat \
    dumb-init \
    curl \
    tzdata

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

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

# Set build environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build arguments for environment-specific builds
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_APP_ENV
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_GOOGLE_ANALYTICS_ID

# Set build-time environment variables
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=$NEXT_PUBLIC_GOOGLE_ANALYTICS_ID

# Build the application
RUN npm run build

# =============================================================================
# STAGE 4: Production Runtime
# =============================================================================
FROM base AS runtime

# Set environment to production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy production dependencies from deps stage
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy built application from build stage
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Create logs directory
RUN mkdir -p /app/logs && chown nextjs:nodejs /app/logs

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application with dumb-init
CMD ["dumb-init", "node", "server.js"]

# =============================================================================
# STAGE 5: Development Runtime
# =============================================================================
FROM base AS development

# Set environment to development
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs && \
    mkdir -p /app/.next && \
    chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port and debug port
EXPOSE 3000 9229

# Start in development mode with hot reload
CMD ["npm", "run", "dev"]

# =============================================================================
# STAGE 6: Static Export (for CDN deployment)
# =============================================================================
FROM nginx:1.27-alpine3.21 AS static

# Copy static files from build stage
COPY --from=build /app/out /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create non-root user
RUN addgroup -g 1001 -S nginx-user && \
    adduser -S nginx-user -u 1001

# Set proper permissions
RUN chown -R nginx-user:nginx-user /usr/share/nginx/html && \
    chown -R nginx-user:nginx-user /var/cache/nginx && \
    chown -R nginx-user:nginx-user /var/log/nginx && \
    chown -R nginx-user:nginx-user /etc/nginx/conf.d

# Switch to non-root user
USER nginx-user

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080 || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

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
      org.label-schema.name="pocket-pos-client" \
      org.label-schema.description="Pocket POS NextJS Web Client" \
      org.label-schema.url="https://pocketpos.com" \
      org.label-schema.vcs-ref=$VCS_REF \
      org.label-schema.vcs-url="https://github.com/pocketpos/client" \
      org.label-schema.vendor="Pocket POS" \
      org.label-schema.version=$VERSION \
      org.label-schema.schema-version="1.0"

# =============================================================================
# DOCKER BUILD COMMANDS
# =============================================================================
#
# Development build:
# docker build --target development -t pocket-pos-client:dev .
#
# Production build:
# docker build --target runtime \
#   --build-arg NEXT_PUBLIC_API_URL=https://api.pocketpos.com \
#   --build-arg NEXT_PUBLIC_WS_URL=wss://api.pocketpos.com \
#   --build-arg NEXT_PUBLIC_APP_ENV=production \
#   -t pocket-pos-client:latest .
#
# Static export build:
# docker build --target static -t pocket-pos-client:static .
#
# Build with all arguments:
# docker build \
#   --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
#   --build-arg VCS_REF=$(git rev-parse --short HEAD) \
#   --build-arg VERSION=$(git describe --tags --always) \
#   --build-arg NEXT_PUBLIC_API_URL=https://api.pocketpos.com \
#   --build-arg NEXT_PUBLIC_WS_URL=wss://api.pocketpos.com \
#   --build-arg NEXT_PUBLIC_APP_ENV=production \
#   --target runtime \
#   -t pocket-pos-client:latest .
#
# =============================================================================

# =============================================================================
# NEXTJS CONFIGURATION REQUIREMENTS
# =============================================================================
#
# For standalone output, add to next.config.js:
#
# module.exports = {
#   output: 'standalone',
#   experimental: {
#     outputFileTracingRoot: path.join(__dirname, '../../'),
#   },
# }
#
# For static export, add to next.config.js:
#
# module.exports = {
#   output: 'export',
#   trailingSlash: true,
#   images: {
#     unoptimized: true
#   }
# }
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
# 6. Separate development, production, and static targets
# 7. .dockerignore file excludes unnecessary files
# 8. npm ci for faster, reliable, reproducible builds
# 9. Cache optimization with layer ordering
# 10. NextJS standalone output for minimal runtime
# 11. Static export option for CDN deployment
# 12. Build-time environment variable injection
#
# =============================================================================

# =============================================================================
# SECURITY CONSIDERATIONS
# =============================================================================
#
# 1. Non-root user (nextjs:nodejs)
# 2. Minimal base image (Alpine)
# 3. No unnecessary packages
# 4. Proper file permissions
# 5. Health checks for monitoring
# 6. Environment-specific builds
# 7. Secrets should be passed via environment variables
# 8. Regular base image updates
# 9. Vulnerability scanning in CI/CD
# 10. CSP headers (configure in next.config.js)
# 11. HTTPS enforcement
# 12. XSS protection headers
#
# =============================================================================

# =============================================================================
# PERFORMANCE OPTIMIZATIONS
# =============================================================================
#
# 1. Layer caching optimization
# 2. Minimal runtime dependencies
# 3. NextJS standalone output
# 4. Static asset optimization
# 5. Image optimization (NextJS built-in)
# 6. Code splitting (NextJS built-in)
# 7. Tree shaking (NextJS built-in)
# 8. Compression (gzip/brotli)
# 9. CDN-ready static export option
# 10. Service worker caching
# 11. Bundle analysis integration
# 12. Memory and CPU limits (set in docker-compose)
#
# =============================================================================