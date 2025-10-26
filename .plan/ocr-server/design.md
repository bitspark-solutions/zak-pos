# OCR Server Design - ZakPOS

## Architecture Overview

The OCR Server is a Python-based microservice that processes images from mobile and web clients, extracting structured text data using machine learning models. It integrates seamlessly with the existing ZakPOS infrastructure including Kafka for async processing, Redis for caching, and PostgreSQL for data persistence.

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   Web Client    │    │   API Gateway   │
│  (React Native) │    │   (Next.js)     │    │   (NestJS)      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   OCR Server    │
                    │   (FastAPI)     │
                    └─────────┬───────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Image Queue   │ │   ML Models     │ │   Results DB    │
│   (Redis/Kafka) │ │   (TrOCR +      │ │   (PostgreSQL)  │
│                 │ │    Tesseract)   │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   File Storage  │ │   Cache Layer   │ │   Metrics &     │
│   (MinIO/S3)    │ │   (Redis)       │ │   Monitoring    │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Component Design

### 1. OCR Processing Service (FastAPI)

**Primary Responsibilities:**
- Image upload and validation
- OCR processing orchestration
- Result caching and storage
- API endpoint management

**Key Features:**
- Async/await pattern for non-blocking processing
- Request/response validation with Pydantic models
- Automatic image format conversion
- Processing queue management

### 2. ML Processing Engine

**OCR Pipeline:**
1. **Image Preprocessing**: Auto-rotate, crop, enhance
2. **Text Detection**: Identify text regions in image
3. **Text Recognition**: Apply OCR models to text regions
4. **Post-processing**: Clean and structure extracted text
5. **Data Validation**: Verify extracted information

**Model Stack:**
- **Primary**: Microsoft TrOCR (Hugging Face) - 61.4M parameters
- **Fallback**: Tesseract OCR for edge cases
- **Specialized**: Custom models for Bengali text (future)

### 3. Queue Management System

**Async Processing:**
- Redis Queue for immediate processing (< 59ms)
- Kafka for batch processing and high-throughput scenarios
- Dead letter queues for failed processing
- Retry mechanisms with exponential backoff

### 4. Data Persistence Layer

**Storage Strategy:**
- **Original Images**: MinIO/S3 for 90 days retention
- **Processing Results**: PostgreSQL for permanent storage
- **Cache**: Redis for frequent queries and model outputs
- **Metadata**: Elasticsearch for search and analytics

## API Design

### Core Endpoints

#### 1. Synchronous OCR Processing
```typescript
POST /api/v1/ocr/process
Content-Type: multipart/form-data

interface Request {
  image: File;           // Required: Image file
  type: 'product' | 'receipt' | 'invoice' | 'barcode';
  confidence_threshold?: number;  // Optional: 0.0-1.0, default 0.8
  extract_barcodes?: boolean;     // Optional: default true
  language?: 'en' | 'bn';         // Optional: default 'en'
}

interface Response {
  success: boolean;
  data?: {
    id: string;
    text: string;
    confidence: number;
    structured: {
      product_name?: string;
      price?: number;
      currency?: string;
      barcode?: string;
      sku?: string;
      expiry_date?: string;
      quantity?: number;
    };
    barcodes: Array<{
      type: string;
      value: string;
      confidence: number;
      bounding_box: {
        x: number; y: number; width: number; height: number;
      };
    }>;
    processing_time_ms: number;
    model_used: string;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
```

#### 2. Asynchronous OCR Processing
```typescript
POST /api/v1/ocr/process/async

interface AsyncResponse {
  success: boolean;
  data?: {
    job_id: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    estimated_time_seconds: number;
    progress_percentage: number;
  };
}

// WebSocket Events
interface WebSocketEvents {
  job_queued: { job_id: string; queue_position: number };
  job_started: { job_id: string; progress: number };
  job_progress: { job_id: string; progress: number; current_step: string };
  job_completed: { job_id: string; result: OCRResult };
  job_failed: { job_id: string; error: OCRError };
}
```

#### 3. Batch Processing
```typescript
POST /api/v1/ocr/batch

interface BatchRequest {
  images: File[];        // Up to 10 images
  type: 'product' | 'receipt' | 'invoice';
  options?: {
    confidence_threshold: number;
    extract_barcodes: boolean;
    language: string;
  };
}

interface BatchResponse {
  success: boolean;
  data?: {
    batch_id: string;
    total_images: number;
    processed_images: number;
    results: Array<{
      index: number;
      success: boolean;
      result?: OCRResult;
      error?: OCRError;
    }>;
    processing_time_ms: number;
  };
}
```

#### 4. Health & Monitoring
```typescript
GET /api/v1/health
Response: {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime_seconds: number;
  models_loaded: string[];
  queue_status: {
    pending_jobs: number;
    processing_jobs: number;
    failed_jobs: number;
  };
}

GET /api/v1/metrics
Response: {
  total_requests: number;
  successful_requests: number;
  average_processing_time_ms: number;
  model_accuracy: {
    overall: number;
    by_field: Record<string, number>;
  };
  errors_by_type: Record<string, number>;
}
```

## Database Schema

### Core Tables

#### 1. ocr_processing_jobs
```sql
CREATE TABLE ocr_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  job_type VARCHAR(20) NOT NULL, -- 'single', 'batch', 'async'
  image_url TEXT NOT NULL,
  image_size_bytes INTEGER,
  image_format VARCHAR(10),

  -- Processing options
  ocr_type VARCHAR(20) NOT NULL DEFAULT 'product',
  confidence_threshold DECIMAL(3,2) DEFAULT 0.8,
  extract_barcodes BOOLEAN DEFAULT true,
  language VARCHAR(5) DEFAULT 'en',

  -- Results
  extracted_text TEXT,
  confidence_score DECIMAL(3,2),
  structured_data JSONB,
  detected_barcodes JSONB,
  processing_metadata JSONB,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,

  -- Performance
  processing_time_ms INTEGER,
  model_used VARCHAR(50),
  queue_wait_time_ms INTEGER,

  -- Relations
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### 2. ocr_model_metrics
```sql
CREATE TABLE ocr_model_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name VARCHAR(100) NOT NULL,
  model_version VARCHAR(20) NOT NULL,

  -- Accuracy metrics
  total_predictions INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  accuracy_score DECIMAL(5,4),

  -- Field-specific accuracy
  product_name_accuracy DECIMAL(5,4),
  price_accuracy DECIMAL(5,4),
  barcode_accuracy DECIMAL(5,4),

  -- Performance metrics
  average_processing_time_ms INTEGER,
  memory_usage_mb INTEGER,
  cpu_usage_percent DECIMAL(5,2),

  -- Timestamps
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date DATE DEFAULT CURRENT_DATE
);
```

#### 3. ocr_error_logs
```sql
CREATE TABLE ocr_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID,
  error_type VARCHAR(50) NOT NULL,
  error_code VARCHAR(20),
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  image_url TEXT,

  -- Context
  model_used VARCHAR(50),
  processing_step VARCHAR(50),
  confidence_score DECIMAL(3,2),

  -- User context
  shop_id UUID,
  user_id UUID,
  user_agent TEXT,
  ip_address INET,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  FOREIGN KEY (job_id) REFERENCES ocr_processing_jobs(id) ON DELETE CASCADE
);
```

## Integration Patterns

### 1. Mobile App Integration

**Camera Integration:**
```typescript
// React Native camera with OCR
const captureImage = async () => {
  const result = await OCRService.processImage(imageUri, {
    type: 'product',
    confidence_threshold: 0.9,
    extract_barcodes: true
  });

  if (result.success) {
    // Auto-populate product form
    setProductName(result.data.structured.product_name);
    setPrice(result.data.structured.price);
    setBarcode(result.data.structured.barcode);
  }
};
```

**Offline Queue:**
```typescript
// Queue images when offline
if (!isConnected) {
  await OCRQueue.add(imageUri, options);
} else {
  await OCRService.processImage(imageUri, options);
}
```

### 2. Kafka Integration

**Event Publishing:**
```python
# Success event
await kafka_producer.send('ocr.completed', {
  'job_id': job_id,
  'shop_id': shop_id,
  'result': ocr_result,
  'timestamp': datetime.utcnow()
})

# Error event
await kafka_producer.send('ocr.failed', {
  'job_id': job_id,
  'error': error_details,
  'shop_id': shop_id
})
```

**Event Consumption:**
```python
# Product service listens for OCR results
@consumer.topic('ocr.completed')
async def handle_ocr_result(message):
  result = message.value
  if result['structured']['product_name']:
    await product_service.create_or_update_product(result)
```

### 3. Database Integration

**Product Auto-Creation:**
```sql
-- Trigger function to auto-create products from OCR results
CREATE OR REPLACE FUNCTION auto_create_product_from_ocr()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.structured_data->>'product_name' IS NOT NULL THEN
    INSERT INTO products (
      shop_id,
      name,
      price,
      barcode,
      sku,
      created_by_ocr
    ) VALUES (
      NEW.shop_id,
      NEW.structured_data->>'product_name',
      (NEW.structured_data->>'price')::DECIMAL,
      NEW.structured_data->>'barcode',
      NEW.structured_data->>'sku',
      true
    ) ON CONFLICT (shop_id, barcode) DO UPDATE SET
      name = EXCLUDED.name,
      price = EXCLUDED.price,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Error Handling Strategy

### 1. Graceful Degradation
- **Primary Model Fails** → Fallback to secondary OCR engine
- **Network Issues** → Queue for retry when connection restored
- **High Load** → Return processing estimate, process asynchronously
- **Invalid Image** → Return helpful error message with suggestions

### 2. Error Classification
```python
class OCRError(Exception):
  def __init__(self, code: str, message: str, details: dict = None):
    self.code = code
    self.message = message
    self.details = details

# Error codes
OCR_ERRORS = {
  'INVALID_IMAGE': 'Image format not supported or corrupted',
  'LOW_QUALITY': 'Image quality too low for reliable OCR',
  'MODEL_ERROR': 'OCR model processing failed',
  'TIMEOUT': 'Processing took longer than expected',
  'QUOTA_EXCEEDED': 'Daily OCR quota exceeded',
  'NETWORK_ERROR': 'Unable to connect to OCR services'
}
```

### 3. Retry Strategy
```python
RETRY_CONFIG = {
  'max_retries': 3,
  'backoff_multiplier': 2,
  'initial_delay_seconds': 1,
  'max_delay_seconds': 30,
  'retryable_errors': ['MODEL_ERROR', 'NETWORK_ERROR', 'TIMEOUT']
}
```

## Deployment Architecture

### Docker Configuration

**Dockerfile:**
```dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    libtesseract-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd --create-home --shell /bin/bash app
USER app

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Start application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Kubernetes Deployment

**deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ocr-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ocr-server
  template:
    metadata:
      labels:
        app: ocr-server
    spec:
      containers:
      - name: ocr-server
        image: zakpos/ocr-server:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: ocr-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: ocr-secrets
              key: redis-url
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /api/v1/health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/v1/health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Environment Configuration

**docker-compose.yml integration:**
```yaml
services:
  ocr-server:
    build:
      context: ./services/ocr
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=${NODE_ENV:-production}
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/zakpos_dev
      - REDIS_URL=redis://redis:6379
      - KAFKA_BROKERS=kafka:29092
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=minioadmin
      - MINIO_SECRET_KEY=minioadmin
      - OCR_MODEL_PRIMARY=microsoft/trocr-small-printed
      - OCR_MODEL_FALLBACK=tesseract
      - MAX_IMAGE_SIZE_MB=10
      - PROCESSING_TIMEOUT_SECONDS=30
      - ENABLE_GPU=false
    depends_on:
      - postgres
      - redis
      - kafka
    ports:
      - "8000:8000"
    networks:
      - zakpos-backend
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2'
        reservations:
          memory: 1G
          cpus: '0.5'
```

## Monitoring & Observability

### 1. Application Metrics
- **Processing Performance**: Average processing time, throughput
- **Model Accuracy**: Field-level accuracy, confidence distributions
- **Error Rates**: Error types, frequencies, recovery rates
- **Resource Usage**: CPU, memory, GPU utilization

### 2. Business Metrics
- **Usage Patterns**: Requests per shop, peak usage hours
- **Success Rates**: Successful vs failed processing
- **User Satisfaction**: Processing speed satisfaction
- **Cost Analysis**: Processing cost per image

### 3. Alerting Rules
```yaml
# High error rate alert
- name: High OCR Error Rate
  condition: error_rate > 0.05
  severity: warning
  description: OCR error rate exceeded 5%

# Processing timeout alert
- name: OCR Processing Timeout
  condition: average_processing_time > 59ms
  severity: critical
  description: OCR processing taking longer than 59ms

# Model accuracy degradation
- name: Model Accuracy Degradation
  condition: accuracy_score < 0.90
  severity: warning
  description: OCR accuracy dropped below 90%
```

## Security Considerations

### 1. Image Data Protection
- **Encryption**: All images encrypted at rest (AES-256)
- **Access Control**: Shop-level data isolation
- **Retention Policy**: Auto-delete images after 90 days
- **Audit Logging**: All image access logged for compliance

### 2. API Security
- **Authentication**: JWT tokens required for all endpoints
- **Rate Limiting**: 100 requests/minute per user, 1000/hour per shop
- **Input Validation**: Strict validation of image formats and sizes
- **CORS**: Configured for mobile and web clients only

### 3. Infrastructure Security
- **Network Isolation**: Internal network only, no public internet access
- **Vulnerability Scanning**: Regular security scanning of containers
- **Access Logging**: All API access logged with user context
- **Data Sanitization**: Remove metadata from uploaded images

## Performance Optimization

### 1. Caching Strategy
- **Model Outputs**: Cache frequent OCR results (Redis, 1 hour TTL)
- **Image Features**: Cache processed image features (Redis, 24 hours TTL)
- **Configuration**: Cache model configurations and thresholds
- **Negative Cache**: Cache failed processing results to avoid retries

### 2. Processing Optimization
- **Batch Processing**: Process multiple images in parallel
- **Model Quantization**: Use optimized model versions for production
- **GPU Acceleration**: Enable CUDA when available
- **Image Compression**: Compress images before processing

### 3. Database Optimization
- **Indexing**: Optimize queries with proper indexes
- **Partitioning**: Partition tables by date for better performance
- **Connection Pooling**: Use connection pooling for database access
- **Query Optimization**: Monitor and optimize slow queries

## Testing Strategy

### 1. Unit Tests
- **Model Testing**: Test individual OCR model performance
- **Image Processing**: Test image preprocessing pipeline
- **API Testing**: Test all API endpoints with mock data
- **Error Handling**: Test error scenarios and recovery

### 2. Integration Tests
- **End-to-End**: Test complete image processing workflows
- **Database Integration**: Test data persistence and retrieval
- **Queue Integration**: Test async processing with Kafka
- **Mobile Integration**: Test with actual mobile app builds

### 3. Performance Tests
- **Load Testing**: Simulate production load with various image types
- **Stress Testing**: Test system limits and breaking points
- **Scalability Testing**: Test horizontal scaling capabilities
- **Memory Testing**: Monitor memory usage under load

### 4. Accuracy Testing
- **Benchmark Testing**: Compare against known datasets
- **A/B Testing**: Test different models and configurations
- **Field Testing**: Real-world testing with shopkeepers
- **Regression Testing**: Ensure accuracy doesn't degrade over time

## Migration Strategy

### 1. Database Migration
```sql
-- Initial migration
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create indexes for performance
CREATE INDEX idx_ocr_jobs_shop_id ON ocr_processing_jobs(shop_id);
CREATE INDEX idx_ocr_jobs_status ON ocr_processing_jobs(status);
CREATE INDEX idx_ocr_jobs_created_at ON ocr_processing_jobs(created_at);
CREATE INDEX idx_ocr_results_confidence ON ocr_processing_jobs(confidence_score DESC);

-- Enable JSONB indexing for structured data
CREATE INDEX idx_ocr_structured_data ON ocr_processing_jobs USING GIN(structured_data);
```

### 2. Data Migration Scripts
```python
# Migrate existing product data to support OCR
async def migrate_existing_products():
  """Add OCR metadata to existing products"""
  async with database.transaction():
    products = await database.fetch_all("SELECT * FROM products WHERE barcode IS NOT NULL")

    for product in products:
      # Add OCR processing metadata
      await database.execute(
        "UPDATE products SET ocr_processed = true, ocr_confidence = 0.95 WHERE id = :id",
        {"id": product["id"]}
      )
```

## Conclusion

The OCR Server design provides a robust, scalable foundation for image processing in ZakPOS. The architecture supports both real-time and asynchronous processing, integrates seamlessly with existing infrastructure, and provides comprehensive monitoring and error handling.

**Key Success Factors:**
- **Model Selection**: Microsoft TrOCR provides proven accuracy for the target use case
- **Scalability**: Microservice design allows independent scaling
- **Integration**: Seamless integration with existing POS workflows
- **Monitoring**: Comprehensive observability for production operations

**Estimated Implementation Timeline**: 6-8 weeks
**Risk Level**: Medium (proven OCR technology, integration complexity)
**Success Probability**: 90% (clear requirements, proven tech stack)
