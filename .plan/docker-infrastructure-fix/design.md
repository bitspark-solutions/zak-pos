# Docker Infrastructure Fix - Design

## Architecture Overview

Based on the final_plan.md requirements, this design addresses the Docker configuration issues and aligns with the ZakPOS system architecture.

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        ZakPOS System                            │
├─────────────────────────────────────────────────────────────────┤
│  Mobile App (React Native/Expo)  │  Web Backoffice (Next.js)   │
│  - Barcode scanning              │  - Admin interface           │
│  - Cart management               │  - Inventory management      │
│  - BLE printing                  │  - Reports & analytics       │
└─────────────────┬─────────────────┴─────────────────┬───────────┘
                  │                                   │
                  └─────────────┬─────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    Nginx Reverse      │
                    │    Proxy & Load       │
                    │    Balancer           │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   NestJS API Server   │
                    │   - Auth & RBAC       │
                    │   - Cart & Sales      │
                    │   - Inventory         │
                    │   - Accounting        │
                    │   - Real-time events  │
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌───────▼────────┐    ┌────────▼────────┐    ┌────────▼────────┐
│   PostgreSQL   │    │      Redis      │    │     Kafka       │
│   - Multi-tenant│    │   - BullMQ      │    │   - Events      │
│   - RLS        │    │   - Caching     │    │   - Streaming   │
│   - ACID       │    │   - Sessions    │    │   - Real-time   │
└────────────────┘    └─────────────────┘    └─────────────────┘
```

## Docker Configuration Design

### 1. Service Architecture

#### Core Services
- **postgres**: PostgreSQL 15 with RLS support
- **redis**: Redis 7 for caching and BullMQ
- **kafka**: Apache Kafka with Zookeeper for event streaming
- **api**: NestJS backend with modular architecture
- **web**: Next.js frontend with App Router
- **mobile**: React Native/Expo development environment
- **nginx**: Reverse proxy and load balancer

#### Supporting Services
- **pgadmin**: Database administration
- **redis-insight**: Redis management
- **kafka-ui**: Kafka management
- **mailhog**: Email testing (development)
- **minio**: S3-compatible storage

### 2. Network Design

```yaml
networks:
  zakpos-frontend:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/24
  zakpos-backend:
    driver: bridge
    ipam:
      config:
        - subnet: 172.21.0.0/24
  zakpos-monitoring:
    driver: bridge
    ipam:
      config:
        - subnet: 172.22.0.0/24
```

### 3. Volume Management

```yaml
volumes:
  # Database persistence
  postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./data/postgres
  
  # Cache and queues
  redis_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./data/redis
  
  # Event streaming
  kafka_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./data/kafka
  
  # Application data
  api_uploads:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./data/uploads
```

## Service Configuration Details

### 1. PostgreSQL Configuration

#### Key Features
- **Multi-tenant RLS**: Row Level Security for tenant isolation
- **Performance**: Optimized for POS workloads
- **Security**: Encrypted connections, proper user management
- **Monitoring**: Query performance tracking

#### Configuration Files
- `docker/postgres/postgresql.conf`: Performance tuning
- `docker/postgres/pg_hba.conf`: Authentication rules
- `docker/postgres/init.sql`: Database initialization with RLS

### 2. Redis Configuration

#### Key Features
- **BullMQ**: Background job processing
- **Caching**: Session and data caching
- **Persistence**: AOF and RDB snapshots
- **Security**: Password authentication

#### Configuration Files
- `docker/redis/redis.conf`: Redis configuration
- Memory limits and eviction policies
- Persistence settings

### 3. Kafka Configuration

#### Key Features
- **Event Streaming**: Real-time cart and inventory updates
- **Partitioning**: Horizontal scaling
- **Retention**: Configurable data retention
- **Security**: SASL authentication (production)

#### Configuration Files
- `docker/kafka/server.properties`: Kafka broker config
- `docker/kafka/zookeeper.properties`: Zookeeper config

### 4. Nginx Configuration

#### Key Features
- **Reverse Proxy**: Route requests to appropriate services
- **Load Balancing**: Distribute load across API instances
- **SSL Termination**: HTTPS support
- **Static Files**: Serve Next.js static assets
- **Rate Limiting**: Protect against abuse

#### Configuration Files
- `docker/nginx/nginx.conf`: Main configuration
- `docker/nginx/conf.d/`: Service-specific configs
- `docker/nginx/ssl/`: SSL certificates

## Environment-Specific Configurations

### 1. Development Environment

#### Features
- **Hot Reload**: Source code mounting for live development
- **Debug Ports**: Exposed for debugging
- **Development Tools**: pgAdmin, Redis Insight, Kafka UI
- **Relaxed Security**: For easier development

#### Ports
- API: 39847
- Web: 41923
- Mobile: 52764 (Metro), 53851 (Expo)
- PostgreSQL: 47821
- Redis: 58392
- Kafka: 54629

### 2. Production Environment

#### Features
- **Security Hardening**: Non-root users, read-only filesystems
- **Resource Limits**: CPU and memory constraints
- **Health Checks**: Comprehensive monitoring
- **Backup Strategy**: Automated backups
- **SSL/TLS**: Encrypted communications

#### Security Measures
- Container security options
- Network isolation
- Secret management
- Regular security updates

## Dockerfile Optimizations

### 1. Multi-Stage Builds

#### NestJS API
```dockerfile
FROM node:20-alpine AS base
# ... system dependencies

FROM base AS deps
# ... production dependencies

FROM base AS build
# ... build application

FROM base AS runtime
# ... production runtime
```

#### Next.js Client
```dockerfile
FROM node:20-alpine AS base
# ... system dependencies

FROM base AS deps
# ... production dependencies

FROM base AS build
# ... build application

FROM base AS runtime
# ... production runtime with standalone output
```

#### React Native Mobile
```dockerfile
FROM node:20-alpine AS base
# ... system dependencies including Android SDK

FROM base AS development
# ... development environment

FROM base AS build
# ... build environment
```

### 2. Security Hardening

#### Non-Root Users
```dockerfile
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001
USER appuser
```

#### Read-Only Filesystems
```yaml
security_opt:
  - no-new-privileges:true
read_only: true
tmpfs:
  - /tmp
  - /app/.npm
```

## Health Checks and Monitoring

### 1. Service Health Checks

#### PostgreSQL
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres -d zakpos_dev"]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 30s
```

#### Redis
```yaml
healthcheck:
  test: ["CMD", "redis-cli", "--no-auth-warning", "-a", "${REDIS_PASSWORD}", "ping"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 30s
```

#### API
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 60s
```

### 2. Monitoring Integration

#### Prometheus Metrics
- Service health status
- Request latency and throughput
- Error rates
- Resource utilization

#### Logging
- Structured JSON logs
- Tenant-aware logging
- PII redaction
- Centralized log aggregation

## Performance Optimizations

### 1. Container Resource Management

#### Development
```yaml
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '0.5'
    reservations:
      memory: 512M
      cpus: '0.25'
```

#### Production
```yaml
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '1.0'
    reservations:
      memory: 1G
      cpus: '0.5'
```

### 2. Database Optimizations

#### PostgreSQL
- Connection pooling with pgbouncer
- Optimized query plans
- Proper indexing strategy
- Partitioning for high-volume tables

#### Redis
- Memory optimization
- Persistence tuning
- Eviction policies

### 3. Network Optimizations

#### Service Communication
- Internal DNS resolution
- Optimized network topology
- Connection pooling
- Keep-alive connections

## Security Considerations

### 1. Container Security

#### Non-Root Execution
- All containers run as non-root users
- Proper file permissions
- Minimal attack surface

#### Network Security
- Service isolation
- Firewall rules
- TLS encryption
- VPN support (production)

### 2. Data Security

#### Database Security
- Encrypted connections
- Row Level Security (RLS)
- Audit logging
- Regular security updates

#### Secret Management
- Environment variables
- Docker secrets (production)
- Vault integration (future)
- Secret rotation

### 3. Application Security

#### API Security
- JWT authentication
- Rate limiting
- CORS configuration
- Input validation

#### Web Security
- HTTPS enforcement
- Security headers
- CSP policies
- XSS protection

## Deployment Strategy

### 1. Development Deployment

#### Local Development
```bash
# Start all services
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Start specific services
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis api
```

#### Development Tools
- pgAdmin for database management
- Redis Insight for cache management
- Kafka UI for event streaming
- Mailhog for email testing

### 2. Production Deployment

#### Production Setup
```bash
# Deploy to production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Scale services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale api=3
```

#### Production Features
- Load balancing
- Auto-scaling
- Health monitoring
- Backup automation
- Security hardening

## Error Handling and Recovery

### 1. Service Recovery

#### Automatic Restart
```yaml
restart: unless-stopped
deploy:
  restart_policy:
    condition: on-failure
    delay: 5s
    max_attempts: 3
    window: 120s
```

#### Health Check Failures
- Automatic service restart
- Load balancer health checks
- Circuit breaker patterns
- Graceful degradation

### 2. Data Recovery

#### Backup Strategy
- Automated database backups
- Point-in-time recovery
- Cross-region replication
- Disaster recovery procedures

#### Data Integrity
- Transaction consistency
- ACID compliance
- Audit trails
- Data validation

## Testing Strategy

### 1. Container Testing

#### Health Check Validation
- All services start successfully
- Health checks pass
- Service communication works
- Data persistence verified

#### Performance Testing
- Load testing with k6
- Stress testing scenarios
- Resource utilization monitoring
- Latency measurements

### 2. Integration Testing

#### Service Integration
- API endpoint testing
- Database connectivity
- Cache functionality
- Event streaming

#### End-to-End Testing
- Complete user workflows
- Mobile app integration
- Web interface testing
- Payment processing

## Maintenance and Operations

### 1. Regular Maintenance

#### Daily Operations
- Health check monitoring
- Log analysis
- Performance metrics review
- Backup verification

#### Weekly Operations
- Security updates
- Performance optimization
- Capacity planning
- Documentation updates

### 2. Monitoring and Alerting

#### Key Metrics
- Service availability
- Response times
- Error rates
- Resource utilization

#### Alerting Rules
- Service down alerts
- High error rate alerts
- Resource threshold alerts
- Security incident alerts

## Future Enhancements

### 1. Scalability Improvements

#### Horizontal Scaling
- Kubernetes migration
- Service mesh implementation
- Auto-scaling policies
- Multi-region deployment

#### Performance Optimization
- CDN integration
- Database read replicas
- Caching strategies
- Query optimization

### 2. Security Enhancements

#### Advanced Security
- Vault integration
- Zero-trust networking
- Security scanning automation
- Compliance monitoring

#### Monitoring Improvements
- Distributed tracing
- Advanced metrics
- AI-powered alerting
- Predictive analytics

This design provides a comprehensive foundation for the ZakPOS Docker infrastructure that aligns with the system requirements and supports the online-only, multi-tenant POS architecture.
