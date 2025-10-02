# Product Catalog Management - Design

## 🏗️ Architecture Overview

### System Architecture
The Product Catalog Management system follows a modular design with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │   API Gateway   │    │   Microservices │
│   (React/TS)    │◄──►│   (NestJS)      │◄──►│   (Node.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                        ┌─────────────────┐
                        │   PostgreSQL    │
                        │   (Multi-tenant │
                        │    with RLS)    │
                        └─────────────────┘
```

### Module Structure
```
src/
├── catalog/
│   ├── controllers/     # HTTP endpoints
│   ├── services/        # Business logic
│   ├── entities/        # Database entities
│   ├── dto/            # Data transfer objects
│   ├── guards/         # Permission guards
│   └── modules/        # NestJS modules
├── categories/
│   ├── controllers/
│   ├── services/
│   └── dto/
└── products/
    ├── controllers/
    ├── services/
    └── dto/
```

## 🗄️ Data Models & Schema

### Categories
```sql
-- Categories table with materialized path for hierarchy
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    path VARCHAR(1000), -- Materialized path: "/electronics/phones"
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Category hierarchy indexes
CREATE INDEX idx_categories_tenant_path ON categories(tenant_id, path);
CREATE INDEX idx_categories_parent ON categories(parent_id) WHERE parent_id IS NOT NULL;
```

### Products
```sql
-- Products table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    base_price DECIMAL(10,2) NOT NULL CHECK (base_price >= 0),
    cost_price DECIMAL(10,2) CHECK (cost_price >= 0),
    tax_rate DECIMAL(5,2) DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
    is_active BOOLEAN DEFAULT true,
    has_variants BOOLEAN DEFAULT false,
    track_inventory BOOLEAN DEFAULT true,
    low_stock_threshold INTEGER DEFAULT 5 CHECK (low_stock_threshold >= 0),
    weight_kg DECIMAL(8,3),
    dimensions JSONB, -- {"length": 10, "width": 5, "height": 2}
    attributes JSONB, -- Custom product attributes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_tenant_sku UNIQUE(tenant_id, sku),
    CONSTRAINT valid_pricing CHECK (cost_price <= base_price OR cost_price IS NULL)
);

-- Product search and filtering indexes
CREATE INDEX idx_products_tenant_search ON products(tenant_id) WHERE is_active = true;
CREATE INDEX idx_products_category ON products(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_products_price ON products(base_price) WHERE is_active = true;
CREATE INDEX idx_products_sku ON products(tenant_id, sku);
```

### Product Variants
```sql
-- Product variants for size, color, etc.
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    attributes JSONB NOT NULL, -- {"color": "red", "size": "L"}
    price_override DECIMAL(10,2) CHECK (price_override >= 0),
    barcode VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_variant_sku UNIQUE(sku) DEFERRABLE INITIALLY DEFERRED
);

-- Variant indexes
CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_barcode ON product_variants(barcode) WHERE barcode IS NOT NULL;
```

### Barcodes
```sql
-- Barcodes table for multiple barcode support
CREATE TABLE barcodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    barcode VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- UPC-A, EAN-13, QR, etc.
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_barcode UNIQUE(barcode) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT barcode_product_xor_variant CHECK (
        (product_id IS NOT NULL AND variant_id IS NULL) OR
        (product_id IS NULL AND variant_id IS NOT NULL)
    )
);

-- Barcode lookup indexes
CREATE INDEX idx_barcodes_lookup ON barcodes(barcode) WHERE is_active = true;
CREATE INDEX idx_barcodes_product ON barcodes(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_barcodes_variant ON barcodes(variant_id) WHERE variant_id IS NOT NULL;
```

## 🔗 API Design

### Category Endpoints
```
GET    /categories                    # List categories with hierarchy
POST   /categories                    # Create category
GET    /categories/{id}               # Get category details
PUT    /categories/{id}               # Update category
DELETE /categories/{id}               # Delete category (soft delete)
GET    /categories/tree               # Get category tree structure
POST   /categories/{id}/move          # Move category in hierarchy
```

### Product Endpoints
```
GET    /products                      # List/search products
POST   /products                      # Create product
GET    /products/{id}                 # Get product details
PUT    /products/{id}                 # Update product
DELETE /products/{id}                 # Delete product (soft delete)
POST   /products/bulk-import          # Bulk import products
GET    /products/{id}/variants        # Get product variants
```

### Variant Endpoints
```
GET    /products/{id}/variants        # List product variants
POST   /products/{id}/variants        # Create variant
GET    /variants/{id}                 # Get variant details
PUT    /variants/{id}                 # Update variant
DELETE /variants/{id}                 # Delete variant
```

### Barcode Endpoints
```
GET    /barcodes                      # List barcodes
POST   /barcodes                      # Create barcode
GET    /barcodes/{id}                 # Get barcode details
PUT    /barcodes/{id}                 # Update barcode
DELETE /barcodes/{id}                 # Delete barcode
GET    /barcodes/lookup/{barcode}     # Lookup product by barcode
POST   /barcodes/generate             # Generate barcode for product
```

## 🔐 Security Measures

### Authentication & Authorization
- **JWT-based Authentication**: All endpoints require valid JWT token
- **RBAC Integration**: Role-based permissions for catalog operations
- **Tenant Isolation**: RLS ensures data access control per tenant
- **API Rate Limiting**: Prevent abuse with per-user rate limits

### Input Validation
- **Schema Validation**: All inputs validated against DTOs
- **SQL Injection Prevention**: Parameterized queries only
- **XSS Protection**: HTML sanitization for product descriptions
- **File Upload Security**: Image validation and virus scanning

### Data Protection
- **Encryption at Rest**: Sensitive product data encrypted
- **Audit Logging**: All catalog changes logged for compliance
- **Backup Strategy**: Automated daily backups with encryption
- **GDPR Compliance**: Data deletion capabilities

## 🚀 Deployment Strategy

### Docker Configuration
```yaml
# docker-compose.prod.yml
services:
  catalog-api:
    image: zakpos/catalog-api:latest
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - postgres
      - redis

  catalog-worker:
    image: zakpos/catalog-worker:latest
    command: ["npm", "run", "worker"]
    environment:
      - DATABASE_URL=${DATABASE_URL}
```

### Kubernetes Deployment
```yaml
# k8s/catalog-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: catalog-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: catalog-api
  template:
    metadata:
      labels:
        app: catalog-api
    spec:
      containers:
      - name: catalog-api
        image: zakpos/catalog-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
```

## 📊 Performance Optimization

### Database Optimizations
- **Materialized Views**: Category paths and product search indexes
- **Partitioning**: Large product tables partitioned by tenant
- **Caching Strategy**: Redis caching for frequently accessed data
- **Connection Pooling**: Efficient database connection management

### API Performance
- **Response Compression**: Gzip compression for API responses
- **CDN Integration**: Static assets served via CDN
- **Database Query Optimization**: Proper indexing and query planning
- **Background Processing**: Heavy operations moved to background jobs

## 🔄 Integration Points

### Inventory System Integration
- **Real-time Updates**: Product changes trigger inventory sync
- **Stock Validation**: Product creation validates against inventory rules
- **Low Stock Alerts**: Integration with inventory alert system

### Sales System Integration
- **Price Lookup**: Real-time price queries for POS operations
- **Product Availability**: Stock level checks during sales
- **Sales Analytics**: Product performance data for reporting

### Mobile App Integration
- **Offline Support**: Product catalog available offline
- **Sync Strategy**: Incremental sync for mobile devices
- **Barcode Scanning**: Integration with device cameras

## 🧪 Testing Strategy

### Unit Tests
- **Service Layer**: Business logic testing with mocked dependencies
- **Entity Validation**: Data model validation testing
- **Utility Functions**: Helper function testing

### Integration Tests
- **API Endpoints**: Full request/response cycle testing
- **Database Operations**: Transaction and rollback testing
- **External Services**: Auth0, Redis, and other service integrations

### E2E Tests
- **User Workflows**: Complete user journey testing
- **Performance Tests**: Load testing for catalog operations
- **Security Tests**: Authentication and authorization testing

## 📈 Monitoring & Observability

### Metrics Collection
- **Response Times**: API endpoint performance monitoring
- **Error Rates**: Error tracking and alerting
- **Database Performance**: Query performance and connection monitoring
- **Business Metrics**: Product creation, search usage, etc.

### Logging Strategy
- **Structured Logging**: JSON logs with consistent format
- **Log Aggregation**: Centralized log collection and analysis
- **Error Tracking**: Integration with error monitoring services
- **Audit Logs**: Complete audit trail for compliance

## 🎯 Success Criteria

### Performance Targets
- **Search Response**: <500ms for product searches
- **Category Tree**: <200ms for hierarchy loading
- **Barcode Lookup**: <100ms for POS operations
- **Bulk Import**: 10,000 products in <30 seconds

### Reliability Targets
- **Uptime**: 99.9% service availability
- **Error Rate**: <0.1% API error rate
- **Data Consistency**: Zero data corruption incidents
- **Backup Success**: 100% successful daily backups

### User Experience Targets
- **Search Accuracy**: >95% relevant search results
- **Navigation Efficiency**: <3 clicks to find products
- **Mobile Performance**: <2s load time on mobile devices
- **Accessibility**: WCAG 2.1 AA compliance


