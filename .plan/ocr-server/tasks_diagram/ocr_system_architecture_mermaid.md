# OCR Server System Architecture

```mermaid
graph TB
    %% External Clients
    subgraph "Clients"
        MA[Mobile App<br/>React Native]
        WC[Web Client<br/>Next.js]
        API[API Gateway<br/>NestJS]
    end

    %% OCR Server Components
    subgraph "OCR Server"
        direction TB
        FE[FastAPI Server<br/>Request/Response]
        PP[Image Preprocessing<br/>Auto-rotate, crop, enhance]
        OCR[OCR Engine<br/>TrOCR + Tesseract]
        SD[Structured Data<br/>Extraction & Validation]
        BC[Barcode Detection<br/>OpenCV + ZBar]
    end

    %% Infrastructure Components
    subgraph "Infrastructure"
        RQ[Redis Queue<br/>Job Management]
        KB[Kafka<br/>Event Streaming]
        DB[(PostgreSQL<br/>Results & Metrics)]
        FS[MinIO/S3<br/>Image Storage]
        CH[Redis Cache<br/>Results & Features]
    end

    %% Data Flow
    MA -->|Camera Image| FE
    WC -->|File Upload| FE
    API -->|API Request| FE

    FE -->|Validate & Queue| RQ
    RQ -->|Process Image| PP
    PP -->|Preprocessed Image| OCR
    OCR -->|Raw Text| SD
    SD -->|Structured Data| BC
    BC -->|With Barcodes| DB

    %% Async Flow
    FE -->|WebSocket| MA
    FE -->|Events| KB
    KB -->|Product Created| API

    %% Caching
    OCR -.->|Cache Results| CH
    SD -.->|Cache Patterns| CH

    %% Error Handling
    FE -->|Failed| RQ
    RQ -->|Retry| PP

    %% Monitoring
    DB -->|Metrics| MON[Monitoring<br/>Grafana/Prometheus]

    %% Styling
    classDef client fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef server fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef infra fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef flow fill:#fff3e0,stroke:#e65100,stroke-width:2px

    class MA,WC,API client
    class FE,PP,OCR,SD,BC server
    class RQ,KB,DB,FS,CH,CH,DB,FS,CH,CH infra
    class MON flow
```

## Architecture Explanation

### Data Flow
1. **Client Request**: Mobile app or web client uploads image
2. **Preprocessing**: Image validation, format conversion, enhancement
3. **OCR Processing**: Text extraction using TrOCR/Tesseract
4. **Data Structuring**: Parse extracted text into product fields
5. **Barcode Detection**: Identify and decode barcodes/QR codes
6. **Storage & Caching**: Save results, cache for performance
7. **Event Publishing**: Notify other services of completion

### Performance Optimizations
- **GPU Acceleration**: CUDA support for faster model inference
- **Batch Processing**: Process multiple regions simultaneously
- **Model Quantization**: Optimized models for speed vs accuracy trade-off
- **Connection Pooling**: Efficient database and cache connections
- **Async Processing**: Non-blocking I/O operations throughout

### Integration Points
- **Mobile App**: Camera integration with real-time preview
- **Web Client**: Drag-and-drop upload with progress tracking
- **Product Service**: Auto-creation/update of products from OCR results
- **Inventory Service**: Bulk updates from invoice processing
- **Analytics**: Usage metrics and accuracy monitoring
