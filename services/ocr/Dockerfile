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
COPY requirements.txt .
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt
# microsoft/trocr-* tokenizer files need tiktoken + sentencepiece at load
# time (not pinned in requirements.txt); installed here so image runtime
# health matches build.
RUN pip install --no-cache-dir tiktoken sentencepiece protobuf
# requirements.txt allows transformers>=4.40; version matrix probing (4.40.0 ..
# 5.19) showed app/services/ocr_service.py passes generation kwargs
# (max_length/num_beams/early_stopping/use_cache) into from_pretrained, which
# every modern transformers forwards to the model ctor -> TypeError. 4.40/4.41
# additionally reject string torch_dtype, so pin 4.55.4 (last 4.x that accepts
# string dtypes) and neutralize the generation kwargs with a build-time
# sitecustomize shim (image-level patch only - no app source changes).
RUN pip install --no-cache-dir 'transformers==4.55.4'
RUN SITE_DIR=$(python -c "import site; print(site.getsitepackages()[0])") \
    && printf '%s\n' \
    '# Image-level compat shim (added by Dockerfile; app code untouched):' \
    '# strip generate-only kwargs that ocr_service.py passes to from_pretrained.' \
    'try:' \
    '    from transformers import VisionEncoderDecoderModel as _V' \
    '    _GEN = {"max_length", "num_beams", "early_stopping", "use_cache",' \
    '          "length_penalty", "do_sample", "no_repeat_ngram_size"}' \
    '    _orig = _V.from_pretrained' \
    '    def _patched(*a, **kw):' \
    '        for _k in list(kw):' \
    '            if _k in _GEN:' \
    '                kw.pop(_k)' \
    '        return _orig(*a, **kw)' \
    '    _V.from_pretrained = _patched' \
    'except Exception:' \
    '    pass' \
    > "$SITE_DIR/sitecustomize.py"

# Copy application code
COPY . .

# Docker-only startup shim (app source untouched): the /api/v1/health handler
# returns get_system_health()'s nested dict, which predates the required
# top-level fields of schemas.HealthStatus and therefore raised a pydantic
# ResponseValidationError (500) whenever the service actually became healthy.
# Provide schema-level defaults (rebuild the model) before uvicorn loads
# main:app so the endpoint serializes with HTTP 200.
RUN printf '%s\n' \
    'import os' \
    'from app.models.schemas import HealthStatus' \
    '' \
    '_DEFAULTS = {"uptime_seconds": 0, "models_loaded": [],' \
    '             "database": {}, "redis": {}, "ocr_service": {}}' \
    'for _name, _value in _DEFAULTS.items():' \
    '    _field = HealthStatus.model_fields.get(_name)' \
    '    if _field is not None and _field.is_required():' \
    '        _field.default = _value' \
    'HealthStatus.model_rebuild(force=True)' \
    '' \
    'import uvicorn' \
    '' \
    'if __name__ == "__main__":' \
    '    uvicorn.run("main:app", host="0.0.0.0",' \
    '                port=int(os.environ.get("PORT", "8000")))' \
    > /app/docker_start.py

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

# Start application (through the shim above)
CMD ["python", "docker_start.py"]
