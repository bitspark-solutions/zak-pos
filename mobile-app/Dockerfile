# =============================================================================
# POCKET POS - React Native Mobile App Dockerfile
# =============================================================================
# Docker container for React Native development with Expo CLI
# Optimized for development workflow and CI/CD pipeline

# =============================================================================
# STAGE 1: Base Development Environment
# =============================================================================
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    bash \
    curl \
    git \
    openssh \
    python3 \
    make \
    g++ \
    openjdk11-jre \
    android-tools \
    tzdata

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S reactnative -u 1001

# Install global packages
RUN npm install -g \
    @expo/cli@latest \
    @react-native-community/cli@latest \
    eas-cli@latest

# =============================================================================
# STAGE 2: Development Environment
# =============================================================================
FROM base AS development

# Set environment variables
ENV NODE_ENV=development
ENV EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0
ENV REACT_NATIVE_PACKAGER_HOSTNAME=0.0.0.0
ENV ADB_INSTALL_TIMEOUT=10

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p /app/logs && \
    mkdir -p /app/.expo && \
    mkdir -p /app/android/app/build && \
    mkdir -p /app/ios/build

# Set proper permissions
RUN chown -R reactnative:nodejs /app

# Switch to non-root user
USER reactnative

# Expose ports for Expo and Metro bundler
EXPOSE 8081 19000 19001 19002 19006

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8081/status || exit 1

# Default command for development
CMD ["npx", "expo", "start", "--tunnel"]

# =============================================================================
# STAGE 3: Build Environment (for CI/CD)
# =============================================================================
FROM base AS build

# Install additional build dependencies
RUN apk add --no-cache \
    gradle \
    android-sdk \
    android-sdk-build-tools \
    android-sdk-platform-tools

# Set Android environment variables
ENV ANDROID_HOME=/usr/lib/android-sdk
ENV ANDROID_SDK_ROOT=/usr/lib/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools

# Set environment variables
ENV NODE_ENV=production
ENV EXPO_OPTIMIZE=true

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create build directories
RUN mkdir -p /app/dist && \
    mkdir -p /app/logs

# Set proper permissions
RUN chown -R reactnative:nodejs /app

# Switch to non-root user
USER reactnative

# Build command (can be overridden)
CMD ["npx", "expo", "build:web"]

# =============================================================================
# STAGE 4: Testing Environment
# =============================================================================
FROM base AS testing

# Install testing dependencies
RUN npm install -g \
    detox-cli@latest \
    appium@latest

# Set environment variables
ENV NODE_ENV=test
ENV CI=true

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Create test directories
RUN mkdir -p /app/coverage && \
    mkdir -p /app/test-results && \
    mkdir -p /app/logs

# Set proper permissions
RUN chown -R reactnative:nodejs /app

# Switch to non-root user
USER reactnative

# Expose ports for testing
EXPOSE 8081 4723

# Default test command
CMD ["npm", "test"]

# =============================================================================
# STAGE 5: Web Export (for web deployment)
# =============================================================================
FROM nginx:alpine AS web

# Copy web build from build stage
COPY --from=build /app/web-build /usr/share/nginx/html

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
ARG EXPO_TOKEN
ARG EAS_PROJECT_ID

# Labels for metadata
LABEL maintainer="Pocket POS Team <dev@pocketpos.com>" \
      org.label-schema.build-date=$BUILD_DATE \
      org.label-schema.name="pocket-pos-mobile" \
      org.label-schema.description="Pocket POS React Native Mobile App" \
      org.label-schema.url="https://pocketpos.com" \
      org.label-schema.vcs-ref=$VCS_REF \
      org.label-schema.vcs-url="https://github.com/pocketpos/mobile" \
      org.label-schema.vendor="Pocket POS" \
      org.label-schema.version=$VERSION \
      org.label-schema.schema-version="1.0"

# =============================================================================
# DOCKER BUILD COMMANDS
# =============================================================================
#
# Development build:
# docker build --target development -t pocket-pos-mobile:dev .
#
# Build environment:
# docker build --target build \
#   --build-arg EXPO_TOKEN=$EXPO_TOKEN \
#   --build-arg EAS_PROJECT_ID=$EAS_PROJECT_ID \
#   -t pocket-pos-mobile:build .
#
# Testing environment:
# docker build --target testing -t pocket-pos-mobile:test .
#
# Web deployment:
# docker build --target web -t pocket-pos-mobile:web .
#
# Build with all arguments:
# docker build \
#   --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
#   --build-arg VCS_REF=$(git rev-parse --short HEAD) \
#   --build-arg VERSION=$(git describe --tags --always) \
#   --build-arg EXPO_TOKEN=$EXPO_TOKEN \
#   --build-arg EAS_PROJECT_ID=$EAS_PROJECT_ID \
#   --target development \
#   -t pocket-pos-mobile:latest .
#
# =============================================================================

# =============================================================================
# DOCKER RUN COMMANDS
# =============================================================================
#
# Development with port mapping:
# docker run -p 8081:8081 -p 19000:19000 -p 19001:19001 -p 19002:19002 \
#   -v $(pwd):/app -v /app/node_modules \
#   pocket-pos-mobile:dev
#
# Development with network host (Linux only):
# docker run --network host -v $(pwd):/app -v /app/node_modules \
#   pocket-pos-mobile:dev
#
# Testing:
# docker run -v $(pwd)/coverage:/app/coverage \
#   -v $(pwd)/test-results:/app/test-results \
#   pocket-pos-mobile:test
#
# Build for production:
# docker run -v $(pwd)/dist:/app/dist \
#   -e EXPO_TOKEN=$EXPO_TOKEN \
#   pocket-pos-mobile:build npx expo build:android
#
# =============================================================================

# =============================================================================
# DEVELOPMENT WORKFLOW
# =============================================================================
#
# 1. Start development container:
#    docker-compose up mobile-dev
#
# 2. Access Expo DevTools:
#    http://localhost:19002
#
# 3. Connect device/emulator:
#    - Scan QR code with Expo Go app
#    - Use Android emulator: adb connect <container-ip>:5555
#    - Use iOS simulator (macOS only)
#
# 4. Hot reload:
#    - File changes trigger automatic reload
#    - Press 'r' in terminal to reload manually
#    - Press 'd' to open developer menu
#
# 5. Debugging:
#    - React Native Debugger
#    - Chrome DevTools
#    - Flipper integration
#
# =============================================================================

# =============================================================================
# OPTIMIZATION NOTES
# =============================================================================
#
# 1. Multi-stage build for different environments
# 2. Alpine Linux base for smaller footprint
# 3. Non-root user for security
# 4. Layer caching optimization
# 5. Separate development and build stages
# 6. Volume mounting for development workflow
# 7. Health checks for container monitoring
# 8. Expo CLI and React Native CLI included
# 9. Android SDK for native builds
# 10. Testing environment with Detox and Appium
# 11. Web export option for PWA deployment
# 12. Proper port exposure for all services
#
# =============================================================================

# =============================================================================
# SECURITY CONSIDERATIONS
# =============================================================================
#
# 1. Non-root user (reactnative:nodejs)
# 2. Minimal base image (Alpine)
# 3. No unnecessary packages
# 4. Proper file permissions
# 5. Environment-specific builds
# 6. Secrets via environment variables
# 7. Regular base image updates
# 8. Vulnerability scanning in CI/CD
# 9. Network isolation in production
# 10. Secure token handling for Expo
#
# =============================================================================

# =============================================================================
# TROUBLESHOOTING
# =============================================================================
#
# Common issues and solutions:
#
# 1. Metro bundler not accessible:
#    - Ensure REACT_NATIVE_PACKAGER_HOSTNAME=0.0.0.0
#    - Check port mappings (8081)
#    - Verify firewall settings
#
# 2. Expo DevTools not loading:
#    - Check port 19002 mapping
#    - Verify EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0
#
# 3. Device connection issues:
#    - Use tunnel mode for remote devices
#    - Check network connectivity
#    - Verify QR code scanning
#
# 4. Build failures:
#    - Check Android SDK installation
#    - Verify environment variables
#    - Review build logs
#
# 5. Permission errors:
#    - Ensure proper file ownership
#    - Check volume mount permissions
#    - Verify user/group settings
#
# =============================================================================