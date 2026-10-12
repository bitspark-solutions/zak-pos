"""
Shared pytest configuration for the ZakPOS OCR service.

Keeps the service root importable (`import app...`) when running
`python -m pytest tests` from services/ocr, and ensures heavy/model
modules are never needed for parser tests.
"""

import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))
