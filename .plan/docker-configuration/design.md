# Docker Configuration Design for Pocket POS System

## 1. Architecture Overview

### 1.1 System Architecture

```mermaid
graph TB
    subgraph "Docker Network: zakpos-network"
        subgraph "Frontend Services"
            WEB["NextJS Web Client<br/>Port: 41923"]
            MOBILE["React Native Mobile<br/>Port: 19006"]
        end
        
        subgraph "Backend Services"
            API["NestJS API Server<br/>Port: 39847"]
        end
        
        subgraph "Data Layer"
            PG[("PostgreSQL<br/>Port: 5432")]
            REDIS[("Redis Cache<br/>Port: 6379")]
            KAFKA["Apache Kafka<br/>Port: 9092")]
        end
        
        subgraph "Infrastructure"
            NGINX["Nginx Reverse Proxy<br/>Port: 80/443"]
        end
    end
    
    WEB --> NGINX
    MOBILE --> NGINX
    NGINX --> API
    API --> PG
    API --> REDIS
    API --> KAFKA
```

### 1.2 Container Architecture

```mermaid
graph LR
    subgraph "zakpos-postgres"
        PG_DATA["Data Volume<br/>/var/lib/postgresql/data"]
        PG_INIT["Init Scripts<br/>/docker-entrypoint-initdb.d"]
    end
    
    subgraph "zakpos-redis"
        REDIS_DATA["Data Volume<br/>/data"]
        REDIS_CONF["Config<br/>/usr/local/etc/redis"]
    end
    
    subgraph "zakpos-kafka"
        KAFKA_DATA["Data Volume<br/>/var/lib/kafka/data"]
        KAFKA_LOGS["Logs Volume<br/>/kafka"]
    end
    
    subgraph "zakpos-api"
        API_SRC["Source Code<br/>/app"]
        API_LOGS["Logs<br/>/app/logs"]
    end
    
    subgraph "zakpos-web"
        WEB_SRC["Source Code<br/>/app"]
        WEB_BUILD["Build Output<br/>/app/.next"]
    end
    
    subgraph "zakpos-mobile"
        MOBILE_SRC["Source Code<br/>/app"]
        MOBILE_EXPO["Expo Cache<br/>/root/.expo"]
    end
```

## 2. Service Specifications

### 2.1 PostgreSQL Database

**Image:** `postgres:16-alpine`
**Container Name:** `zakpos-postgres`
**Port Mapping:** `5432:5432`

**Environment Variables:**
- `POSTGRES_DB=zakpos_db`
- `POSTGRES_USER=zakpos_user`
- `POSTGRES_PASSWORD=zakpos_secure_password_2024`
- `POSTGRES_INITDB_ARGS=--encoding=UTF-8 --lc-collate=C --lc-ctype=C`

**Volumes:**
- `zakpos_postgres_data:/var/lib/postgresql/data`
- `./database/init:/docker-entrypoint-initdb.d:ro`

**Health Check:**
```bash
pg_isready -U zakpos_user -d zakpos_db
```

### 2.2 Redis Cache

**Image:** `redis:7-alpine`
**Container Name:** `zakpos-redis`
**Port Mapping:** `6379:6379`

**Environment Variables:**
- `REDIS_PASSWORD=redis_secure_password_2024`

**Volumes:**
- `zakpos_redis_data:/data`
- `./redis/redis.conf:/usr/local/etc/redis/redis.conf:ro`

**Health Check:**
```bash
redis-cli --no-auth-warning -a $REDIS_PASSWORD ping
```

### 2.3 Apache Kafka

**Image:** `confluentinc/cp-kafka:7.5.0`
**Container Name:** `zakpos-kafka`
**Port Mapping:** `9092:9092`

**Environment Variables:**
- `KAFKA_BROKER_ID=1`
- `KAFKA_ZOOKEEPER_CONNECT=zakpos-zookeeper:2181`
- `KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092`
- `KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1`
- `KAFKA_AUTO_CREATE_TOPICS_ENABLE=true`

**Volumes:**
- `zakpos_kafka_data:/var/lib/kafka/data`
- `zakpos_kafka_logs:/kafka`

**Dependencies:** `zakpos-zookeeper`

### 2.4 Zookeeper (Kafka Dependency)

**Image:** `confluentinc/cp-zookeeper:7.5.0`
**Container Name:** `zakpos-zookeeper`
**Port Mapping:** `2181:2181`

**Environment Variables:**
- `ZOOKEEPER_CLIENT_PORT=2181`
- `ZOOKEEPER_TICK_TIME=2000`

**Volumes:**
- `zakpos_zookeeper_data:/var/lib/zookeeper/data`
- `zakpos_zookeeper_logs:/var/lib/zookeeper/log`

### 2.5 NestJS API Server

**Image:** Custom build from `node:20-alpine`
**Container Name:** `zakpos-api`
**Port Mapping:** `39847:3000`

**Environment Variables:**
- `NODE_ENV=production`
- `PORT=3000`
- `DATABASE_URL=postgresql://zakpos_user:zakpos_secure_password_2024@zakpos-postgres:5432/zakpos_db`
- `REDIS_URL=redis://:redis_secure_password_2024@zakpos-redis:6379`
- `KAFKA_BROKERS=zakpos-kafka:9092`
- `JWT_SECRET=jwt_super_secure_secret_key_2024`
- `API_PREFIX=api/v1`

**Volumes:**
- `./server:/app`
- `zakpos_api_logs:/app/logs`
- `/app/node_modules` (anonymous volume)

**Dependencies:** `zakpos-postgres`, `zakpos-redis`, `zakpos-kafka`

### 2.6 NextJS Web Client

**Image:** Custom build from `node:20-alpine`
**Container Name:** `zakpos-web`
**Port Mapping:** `41923:3000`

**Environment Variables:**
- `NODE_ENV=production`
- `NEXT_PUBLIC_API_URL=http://localhost:39847/api/v1`
- `NEXT_PUBLIC_WS_URL=ws://localhost:39847`
- `PORT=3000`

**Volumes:**
- `./client:/app`
- `/app/node_modules` (anonymous volume)
- `/app/.next` (anonymous volume)

**Dependencies:** `zakpos-api`

### 2.7 React Native Mobile App

**Image:** Custom build from `node:22.19-alpine`
**Container Name:** `zakpos-mobile`
**Port Mapping:** `19006:19006`

**Environment Variables:**
- `NODE_ENV=development`
- `EXPO_PUBLIC_API_URL=http://localhost:39847/api/v1`
- `EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0`

**Volumes:**
- `./mobile-app:/app`
- `/app/node_modules` (anonymous volume)
- `zakpos_expo_cache:/root/.expo`

**Dependencies:** `zakpos-api`

## 3. Network Configuration

### 3.1 Docker Network

**Network Name:** `zakpos-network`
**Driver:** `bridge`
**Subnet:** `172.20.0.0/16`

**Static IP Assignments:**
- PostgreSQL: `172.20.0.10`
- Redis: `172.20.0.11`
- Zookeeper: `172.20.0.12`
- Kafka: `172.20.0.13`
- NestJS API: `172.20.0.20`
- NextJS Web: `172.20.0.30`
- React Native: `172.20.0.31`

### 3.2 Service Discovery

Services communicate using container names as hostnames:
- Database: `zakpos-postgres:5432`
- Cache: `zakpos-redis:6379`
- Message Queue: `zakpos-kafka:9092`
- API: `zakpos-api:3000`

## 4. Data Models

### 4.1 Volume Definitions

```yaml
volumes:
  zakpos_postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./data/postgres
  
  zakpos_redis_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./data/redis
  
  zakpos_kafka_data:
    driver: local
  
  zakpos_kafka_logs:
    driver: local
  
  zakpos_zookeeper_data:
    driver: local
  
  zakpos_zookeeper_logs:
    driver: local
  
  zakpos_api_logs:
    driver: local
  
  zakpos_expo_cache:
    driver: local
```

### 4.2 Database Schema

```sql
-- Initial database setup
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Core tables will be managed by NestJS migrations
-- This is just the initial setup
```

## 5. Security Configuration

### 5.1 Environment Security

**Secrets Management:**
- Use `.env` files for development
- Use Docker secrets for production
- Rotate passwords regularly
- Use strong, unique passwords for each service

**Network Security:**
- Internal communication only within Docker network
- Expose only necessary ports to host
- Use TLS for external communications

### 5.2 Container Security

**Image Security:**
- Use official Alpine-based images
- Regular security updates
- Minimal attack surface
- Non-root user execution where possible

**Runtime Security:**
- Read-only root filesystems where applicable
- Resource limits (CPU, memory)
- Health checks for all services
- Restart policies for resilience

## 6. Development vs Production

### 6.1 Development Configuration

```yaml
# Development overrides
services:
  zakpos-api:
    volumes:
      - ./server:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
    command: npm run start:dev
  
  zakpos-web:
    volumes:
      - ./client:/app
      - /app/node_modules
      - /app/.next
    environment:
      - NODE_ENV=development
    command: npm run dev
```

### 6.2 Production Configuration

```yaml
# Production optimizations
services:
  zakpos-api:
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
  
  zakpos-web:
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

## 7. Monitoring and Logging

### 7.1 Health Checks

All services include comprehensive health checks:
- Database connectivity
- Service responsiveness
- Resource utilization
- Custom application health endpoints

### 7.2 Logging Strategy

**Log Aggregation:**
- Centralized logging with Docker logging drivers
- Structured JSON logging
- Log rotation and retention policies

**Monitoring:**
- Container resource monitoring
- Application performance metrics
- Database performance tracking
- Real-time alerting

## 8. Deployment Strategy

### 8.1 Multi-Stage Builds

All custom images use multi-stage builds:
1. **Build Stage:** Install dependencies, compile code
2. **Production Stage:** Copy artifacts, minimal runtime

### 8.2 Deployment Process

```bash
# Development
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Testing
docker-compose -f docker-compose.yml -f docker-compose.test.yml up --abort-on-container-exit
```

### 8.3 CI/CD Integration

**Build Pipeline:**
1. Code checkout
2. Run tests
3. Build Docker images
4. Security scanning
5. Push to registry
6. Deploy to staging
7. Integration tests
8. Deploy to production

## 9. Backup and Recovery

### 9.1 Database Backup

```bash
# Automated backup script
docker exec zakpos-postgres pg_dump -U zakpos_user zakpos_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 9.2 Volume Backup

```bash
# Backup all persistent data
docker run --rm -v zakpos_postgres_data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/postgres_$(date +%Y%m%d).tar.gz -C /data .
```

## 10. Performance Optimization

### 10.1 Resource Allocation

**Memory Limits:**
- PostgreSQL: 2GB
- Redis: 512MB
- Kafka: 1GB
- NestJS API: 1GB
- NextJS Web: 512MB
- React Native: 256MB

### 10.2 Caching Strategy

**Redis Configuration:**
- Session storage
- API response caching
- Real-time data caching
- Pub/sub for real-time features

**Application Caching:**
- NextJS static generation
- API response caching
- Database query optimization

## 11. Error Handling

### 11.1 Container Restart Policies

```yaml
restart: unless-stopped
```

### 11.2 Graceful Shutdown

All services implement graceful shutdown:
- SIGTERM handling
- Connection draining
- Data consistency checks
- Clean resource cleanup

## 12. Testing Strategy

### 12.1 Container Testing

```bash
# Health check testing
docker-compose exec zakpos-postgres pg_isready
docker-compose exec zakpos-redis redis-cli ping
docker-compose exec zakpos-api curl -f http://localhost:39847/health
```

### 12.2 Integration Testing

```bash
# Full stack testing
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

This design provides a robust, scalable, and secure Docker configuration for the Pocket POS system with proper separation of concerns, comprehensive monitoring, and production-ready deployment strategies.