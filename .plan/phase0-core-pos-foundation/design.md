# Phase 0: Core POS Foundation - Design

## Architecture Overview

### High-Level Architecture
The ZakPOS system follows a modular monolith architecture with clear service boundaries, designed for future microservice migration. The system consists of three main applications:

1. **Mobile POS App** (React Native/Expo) - Checkout operations
2. **Web Backoffice** (Next.js 14) - Administration and reporting
3. **Backend API** (NestJS) - Business logic and data management

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile POS    │    │  Web Backoffice │    │   Backend API   │
│  (React Native) │    │   (Next.js 14)  │    │    (NestJS)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                        ┌─────────────────┐
                        │   Load Balancer │
                        │     (Nginx)     │
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │   PostgreSQL    │
                        │   (Multi-tenant │
                        │    with RLS)    │
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │     Redis       │
                        │  (Cache + Queue)│
                        └─────────────────┘
```

## Data Models & Schema

### Core Entities

#### 1. Tenant Management
```sql
-- Tenants table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(50) NOT NULL DEFAULT 'basic',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255) UNIQUE,
    locale VARCHAR(10) DEFAULT 'en',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User-Tenant relationships
CREATE TABLE user_tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    permissions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, tenant_id)
);

-- Devices table
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    model VARCHAR(255),
    device_token VARCHAR(500),
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_fingerprint VARCHAR(255) NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true
);
```

#### 2. Product Catalog
```sql
-- Categories table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(1000), -- Materialized path for hierarchy
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    description TEXT,
    unit VARCHAR(50) DEFAULT 'pcs',
    base_price DECIMAL(10,2) NOT NULL,
    default_cost DECIMAL(10,2),
    tax_id UUID REFERENCES taxes(id) ON DELETE SET NULL,
    is_weighted BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, sku)
);

-- Product variants table
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    attributes JSONB NOT NULL, -- {size: "L", color: "Red"}
    barcode VARCHAR(100),
    price_override DECIMAL(10,2),
    cost_override DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Barcodes table
CREATE TABLE barcodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- EAN13, UPC, CODE128, QR
    value VARCHAR(100) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, value)
);
```

#### 3. Inventory Management
```sql
-- Shops/Locations table
CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    time_zone VARCHAR(50) DEFAULT 'UTC',
    tax_profile_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory table
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    quantity_on_hand DECIMAL(10,3) NOT NULL DEFAULT 0,
    quantity_reserved DECIMAL(10,3) NOT NULL DEFAULT 0,
    valuation_method VARCHAR(20) DEFAULT 'WAVC',
    avg_cost DECIMAL(10,2),
    last_counted_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(shop_id, product_id, variant_id)
);

-- Inventory movements table
CREATE TABLE inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    movement_type VARCHAR(20) NOT NULL, -- IN, OUT, ADJUSTMENT, TRANSFER
    quantity DECIMAL(10,3) NOT NULL,
    unit_cost DECIMAL(10,2),
    reference_type VARCHAR(50), -- SALE, PURCHASE, ADJUSTMENT
    reference_id UUID,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 4. Sales & Transactions
```sql
-- Sales table
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    cashier_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, completed, cancelled, refunded
    channel VARCHAR(20) NOT NULL DEFAULT 'pos', -- pos, web, mobile
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    currency VARCHAR(3) DEFAULT 'BDT',
    fx_rate DECIMAL(10,4) DEFAULT 1.0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    posted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(tenant_id, id)
);

-- Sale lines table
CREATE TABLE sale_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_id UUID REFERENCES taxes(id) ON DELETE SET NULL,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    line_total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    direction VARCHAR(10) NOT NULL, -- IN, OUT
    method VARCHAR(20) NOT NULL, -- CASH, CARD, MOBILE, BANK
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'BDT',
    fx_rate DECIMAL(10,4) DEFAULT 1.0,
    reference VARCHAR(255),
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    posted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 5. Accounting System (Simplified)
```sql
-- Chart of Accounts
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    parent_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    currency VARCHAR(3) DEFAULT 'BDT',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

-- Journal entries
CREATE TABLE journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    source VARCHAR(50) NOT NULL, -- SALE, PURCHASE, ADJUSTMENT
    reference_type VARCHAR(50),
    reference_id UUID,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'draft' -- draft, posted, cancelled
);

-- Journal lines
CREATE TABLE journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id UUID REFERENCES journals(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    debit DECIMAL(10,2) NOT NULL DEFAULT 0,
    credit DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'BDT',
    fx_rate DECIMAL(10,4) DEFAULT 1.0,
    memo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer ledger
CREATE TABLE customer_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    type VARCHAR(50) NOT NULL, -- SALE, PAYMENT, REFUND
    reference_id UUID,
    debit DECIMAL(10,2) NOT NULL DEFAULT 0,
    credit DECIMAL(10,2) NOT NULL DEFAULT 0,
    balance_after DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tenant-specific tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
-- ... (all other tables)

-- Create RLS policies
CREATE POLICY tenant_isolation ON tenants
    USING (id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation ON products
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation ON sales
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
-- ... (similar policies for all tables)
```

## API Design

### Authentication Endpoints (Auth0 API Integration)
```
POST /auth/login          # Validate credentials with Auth0 + Database
POST /auth/register       # Create user in Auth0 + Database
POST /auth/refresh        # Refresh JWT token
POST /auth/logout         # Invalidate session
GET  /auth/profile        # Get user profile with full context
POST /auth/validate       # Validate existing token
POST /devices/register    # Register device for user
POST /sessions/revoke     # Revoke user session
GET  /me                  # Get current user context
```

### Product Catalog Endpoints
```
GET    /products?page=1&limit=20&search=keyword
POST   /products
GET    /products/{id}
PUT    /products/{id}
DELETE /products/{id}
POST   /products/{id}/barcodes
POST   /products/bulk-import
GET    /categories
POST   /categories
```

### Inventory Endpoints
```
GET  /inventory/stock?shopId={id}&productId={id}
POST /inventory/adjustments
GET  /inventory/movements?productId={id}&dateFrom={date}&dateTo={date}
POST /inventory/transfers
```

### Cart & Checkout Endpoints
```
POST /carts                    # Create cart, return cartToken
GET  /carts/{cartToken}        # Get cart details
POST /carts/{cartToken}/lines  # Add/update/remove line items
POST /carts/{cartToken}/price  # Recalculate totals
POST /carts/{cartToken}/tender # Start payment process
POST /carts/{cartToken}/commit # Complete transaction
```

### Sales & Reports Endpoints
```
GET  /sales?dateFrom={date}&dateTo={date}&status={status}
GET  /sales/{id}
POST /sales/{id}/refund
GET  /reports/sales-daily?date={date}
GET  /reports/inventory-summary
GET  /reports/financial-summary
```

## Workflow Diagrams

### Sales Transaction Flow
```
1. Customer arrives at POS
2. Cashier scans/selects products
3. System adds items to server-side cart
4. System calculates totals with tax
5. Customer chooses payment method
6. System processes payment
7. System creates sale record
8. System updates inventory
9. System generates journal entries
10. System prints receipt
11. Transaction complete
```

### Inventory Management Flow
```
1. Product received/returned
2. System creates inventory movement
3. System updates stock levels
4. System checks low stock alerts
5. System updates average cost (WAVC)
6. System logs movement for audit
```

## Security Measures

### Authentication & Authorization (Auth0 API Integration)
- **Auth0 Management API**: Backend validates users through Auth0's secure API
- **Dual Validation**: User must exist in both Auth0 and local database
- **JWT Tokens**: Backend-generated tokens with full user context
- **RBAC**: Role-based access control with fine-grained permissions
- **Device Binding**: Device registration with remote revocation
- **Rate Limiting**: API rate limiting per user/device
- **Session Management**: Backend-controlled session lifecycle

### Data Protection
- **Encryption**: TLS 1.3 for transit, AES-256 for rest
- **RLS**: Row Level Security for tenant isolation
- **Audit Logging**: Complete audit trail for all operations
- **PII Protection**: Minimal PII collection and storage

### Network Security
- **CORS**: Configured CORS policies
- **CSRF**: CSRF protection for web forms
- **Helmet**: Security headers with Helmet.js
- **Input Validation**: Comprehensive input validation and sanitization

## Deployment Plan

### Docker Compose Setup
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: zakpos
      POSTGRES_USER: zakpos
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  api:
    build: ./server
    environment:
      DATABASE_URL: postgresql://zakpos:${DB_PASSWORD}@postgres:5432/zakpos
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

  web:
    build: ./client
    environment:
      NEXT_PUBLIC_API_URL: http://api:3000
    depends_on:
      - api

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - api
      - web
```

### Kubernetes Manifests
- **Namespace**: `zakpos-production`
- **Deployments**: API, Web, Mobile (if needed)
- **Services**: LoadBalancer for external access
- **Ingress**: Nginx ingress controller
- **ConfigMaps**: Environment configuration
- **Secrets**: Database credentials, JWT secrets

### CI/CD Pipeline
```yaml
# GitHub Actions workflow
name: Deploy ZakPOS
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: |
          cd server && npm test
          cd ../client && npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build Docker images
        run: |
          docker build -t zakpos-api ./server
          docker build -t zakpos-web ./client

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          kubectl apply -f k8s/
```

## Testing Strategy

### Unit Testing
- **Backend**: Jest + Supertest for API endpoints
- **Frontend**: Jest + React Testing Library
- **Mobile**: Jest + React Native Testing Library
- **Coverage**: Minimum 80% code coverage

### Integration Testing
- **API Testing**: Postman/Newman collections
- **Database Testing**: Test database with sample data
- **End-to-End**: Playwright for web, Detox for mobile

### Performance Testing
- **Load Testing**: Artillery.js for API load testing
- **Stress Testing**: k6 for system limits
- **Monitoring**: Real-time performance metrics

## Error Handling Strategy

### Error Classification
- **Client Errors**: 4xx status codes with detailed messages
- **Server Errors**: 5xx status codes with error IDs
- **Business Logic Errors**: Custom error types with specific handling

### Error Response Format
```json
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product with ID {id} not found",
    "details": {
      "productId": "uuid",
      "timestamp": "2024-01-01T00:00:00Z"
    },
    "requestId": "req_123456789"
  }
}
```

### Logging Strategy
- **Structured Logging**: JSON format with correlation IDs
- **Log Levels**: ERROR, WARN, INFO, DEBUG
- **Log Aggregation**: Centralized logging with ELK stack
- **Alerting**: Real-time error alerts via Slack/Email

## Monitoring & Observability

### Metrics
- **Application Metrics**: Response time, error rate, throughput
- **Business Metrics**: Sales volume, transaction count, user activity
- **Infrastructure Metrics**: CPU, memory, disk, network

### Dashboards
- **Grafana**: Real-time system dashboards
- **Business Intelligence**: Sales and inventory dashboards
- **Alerting**: Automated alerts for critical issues

### Health Checks
- **API Health**: `/health` endpoint with dependency checks
- **Database Health**: Connection and query performance
- **External Services**: Payment gateway, SMS, email services
