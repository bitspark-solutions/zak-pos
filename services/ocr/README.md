# ZakPOS OCR Server

A high-performance OCR microservice for processing product labels, receipts, and invoices using Microsoft TrOCR and Tesseract.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Environment
```bash
cp ../env.example .env
# Edit .env with your OCR-specific settings
```

### 3. Run Tests
```bash
python test_ocr.py
```

### 4. Start Development Server
```bash
python main.py
```

The server will be available at `http://localhost:8000`

## 📋 API Endpoints

### Health Check
```bash
GET /api/v1/health
```

### Process Single Image
```bash
POST /api/v1/process
Content-Type: multipart/form-data

Body:
- image: File (JPG, PNG, WebP)
- ocr_type: product | receipt | invoice | barcode
- confidence_threshold: 0.8
- extract_barcodes: true
- language: en | bn
```

### Batch Processing
```bash
POST /api/v1/batch
Content-Type: multipart/form-data

Body:
- images: Multiple files (max 10)
- ocr_type: Processing type
- options: Processing options
```

### Async Processing
```bash
POST /api/v1/process/async
# Returns job_id immediately

GET /api/v1/status/{job_id}
# Check processing status
```

## 🏗️ Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Mobile    │───▶│  FastAPI    │───▶│   TrOCR     │
│   React     │    │   Server    │    │   Model     │
│   Native    │    └─────────────┘    └─────────────┘
└─────────────┘           │                   │
                          ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Web       │───▶│ PostgreSQL  │    │   Redis     │
│   Next.js   │    │   Database  │    │   Cache     │
└─────────────┘    └─────────────┘    └─────────────┘
```

## ⚡ Performance

- **Target Response Time**: <59ms for single images
- **Throughput**: 1000+ requests/minute
- **Accuracy**: >90% on printed text
- **Model**: Microsoft TrOCR (61.4M parameters)

## 🔧 Development

### Running Tests
```bash
# All tests
python -m pytest

# Specific test categories
python -m pytest tests/test_ocr.py -v
python -m pytest tests/test_api.py -v
```

### Docker Development
```bash
# Build and run with Docker
docker build -t zakpos-ocr .
docker run -p 8000:8000 zakpos-ocr

# With Docker Compose (from project root)
docker-compose up -d ocr
```

### Debugging
```bash
# Enable debug logging
export LOG_LEVEL=DEBUG
export DEBUG=true

# Run with hot reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 📊 Monitoring

- **Health Check**: `GET /api/v1/health`
- **Metrics**: `GET /api/v1/metrics`
- **Logs**: Structured logging with request tracing
- **Performance**: Built-in timing and accuracy metrics

## 🔒 Security

- **Authentication**: JWT token validation
- **Rate Limiting**: 100 requests/minute per user
- **Image Validation**: Format and size validation
- **Data Isolation**: Multi-tenant data separation

## 🧪 Testing

Run the test suite to validate functionality:

```bash
python test_ocr.py
```

Expected output:
```
🚀 ZakPOS OCR Server Test Suite
==================================================

📋 Running Import Tests...
✅ Configuration loaded: microsoft/trocr-small-printed
✅ Schema models imported
✅ Database models imported
✅ Redis module imported
✅ Import Tests PASSED

📋 Running Model Configuration...
✅ Primary model: microsoft/trocr-small-printed
✅ Fallback model: tesseract
✅ GPU enabled: False
✅ Confidence threshold: 0.8
✅ Model Configuration PASSED

📋 Running Database Schema...
✅ Database URL configured: postgresql://***:5432/zakpos_dev
✅ Database tables defined: ['ocr_processing_jobs', 'ocr_model_metrics', 'ocr_error_logs']
✅ Database Schema PASSED

📋 Running API Structure...
✅ API router created
✅ FastAPI app created: ZakPOS OCR Server
✅ API Structure PASSED

==================================================
📊 Test Results: 4/4 tests passed
🎉 All tests passed! OCR server is ready for development.
```

## 🚀 Production Deployment

### Environment Variables
```bash
# Required for production
OCR_ENABLE_GPU=true
NODE_ENV=production
LOG_LEVEL=info
OCR_WORKERS=8
```

### Docker Production
```bash
# Build production image
docker build -t zakpos-ocr:latest --target production .

# Run with GPU support
docker run -p 8000:8000 --gpus all zakpos-ocr:latest
```

## 📚 API Examples

### Process Product Label
```python
import requests

files = {'image': open('product_label.jpg', 'rb')}
data = {
    'ocr_type': 'product',
    'confidence_threshold': 0.9,
    'extract_barcodes': 'true'
}

response = requests.post('http://localhost:8000/api/v1/process', files=files, data=data)
result = response.json()

print(f"Product: {result['structured']['product_name']}")
print(f"Price: {result['structured']['price']}")
print(f"Barcode: {result['structured']['barcode']}")
```

### Batch Processing
```python
import requests

files = [
    ('images', open('product1.jpg', 'rb')),
    ('images', open('product2.jpg', 'rb')),
    ('images', open('receipt.jpg', 'rb'))
]

response = requests.post('http://localhost:8000/api/v1/batch', files=files)
batch_result = response.json()

for result in batch_result['results']:
    print(f"Text: {result['text']}")
    print(f"Confidence: {result['confidence']}")
```

## 🔧 Troubleshooting

### Common Issues

1. **Model Loading Errors**
   ```bash
   # Check if models are available
   python -c "from transformers import TrOCRProcessor; print('TrOCR available')"
   ```

2. **Memory Issues**
   ```bash
   # Monitor memory usage
   export OCR_WORKERS=2
   export OCR_BATCH_SIZE=1
   ```

3. **GPU Issues**
   ```bash
   # Disable GPU if having issues
   export OCR_ENABLE_GPU=false
   export CUDA_VISIBLE_DEVICES=""
   ```

### Performance Tuning

1. **Enable GPU**: `OCR_ENABLE_GPU=true`
2. **Increase Workers**: `OCR_WORKERS=8`
3. **Adjust Batch Size**: `OCR_BATCH_SIZE=10`
4. **Tune Cache**: `OCR_CACHE_TTL_SECONDS=7200`

## 📈 Performance Benchmarks

### Target Metrics
- **Response Time**: <59ms (95th percentile)
- **Throughput**: 1000 requests/minute
- **Accuracy**: >90% on product labels
- **Uptime**: 99.9%

### Monitoring Commands
```bash
# Check service health
curl http://localhost:8000/api/v1/health

# View metrics
curl http://localhost:8000/api/v1/metrics

# Monitor logs
docker-compose logs -f ocr
```

## 🤝 Integration

### Mobile App (React Native)
```typescript
const processImage = async (imageUri: string) => {
  const formData = new FormData();
  formData.append('image', { uri: imageUri, type: 'image/jpeg', name: 'product.jpg' });
  formData.append('ocr_type', 'product');
  formData.append('confidence_threshold', '0.9');

  const response = await fetch('http://localhost:8000/api/v1/process', {
    method: 'POST',
    body: formData,
  });

  return await response.json();
};
```

### Web Client (Next.js)
```typescript
const uploadImage = async (file: File) => {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('ocr_type', 'receipt');

  const response = await fetch('/api/ocr/process', {
    method: 'POST',
    body: formData,
  });

  return await response.json();
};
```

## 🎯 Success Criteria

✅ **All tests pass** (`python test_ocr.py`)  
✅ **Health check responds** (`GET /api/v1/health`)  
✅ **Models load successfully** (check logs)  
✅ **API endpoints functional** (test with curl/Postman)  
✅ **Integration with main POS** (Kafka events working)  

## 📞 Support

- **Documentation**: See `/docs` endpoint when server is running
- **Logs**: Check `docker-compose logs ocr`
- **Tests**: Run `python test_ocr.py` for diagnostics
- **Issues**: Check GitHub issues for common problems

---

**Built for ZakPOS** - Multi-tenant SaaS POS platform for Bangladeshi shopkeepers








