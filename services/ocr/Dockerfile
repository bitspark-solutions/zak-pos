FROM python:3.11.11-slim-bookworm

# Install system dependencies for OCR and image processing
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    libtesseract-dev \
    libgl1-mesa-dri \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    curl \
    libgtk-3-0 \
    libglu1-mesa \
    libxrandr2 \
    libxss1 \
    libxcursor1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxi6 \
    libxtst6 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
# Install CPU-only torch/torchvision FIRST, from the PyTorch CPU index, so the
# build never pulls the multi-GB CUDA wheels that requirements.txt would resolve.
# requirements.txt pins transformers==4.55.4 and includes tiktoken /
# sentencepiece / protobuf needed by the trocr tokenizer at load time.
COPY requirements.txt .
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user and a pre-owned cache dir so the named HF-cache volume
# mounts with correct permissions (else huggingface downloads hit EACCES).
RUN useradd --create-home --shell /bin/bash app \
    && mkdir -p /home/app/.cache \
    && chown -R app:app /home/app
USER app

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Start application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
