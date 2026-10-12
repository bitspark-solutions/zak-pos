import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import type { OcrExtractResponse } from './interfaces/product-import.interface';

/** Default OCR service base when OCR_SERVICE_URL is not configured. */
const DEFAULT_OCR_BASE = 'http://localhost:58000';

export interface OcrFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

/** One line of an OCR'd supplier receipt (snake_case mirrors the OCR wire contract). */
export interface OcrReceiptItem {
  name: string;
  qty: number | null;
  unit_price: number | null;
  line_total: number | null;
}

/** Raw OCR extract-receipt response contract. */
export interface OcrReceipt {
  vendor: string | null;
  document_date: string | null;
  currency: string | null;
  subtotal: number | null;
  discount: number | null;
  tax: number | null;
  total: number | null;
  items: OcrReceiptItem[];
  raw_text: string;
  engine: string;
}

/**
 * Thin client for the external OCR `extract-products` service. The service is
 * optional: when `OCR_SERVICE_URL` is unset the caller should skip OCR and
 * surface a per-file error instead (see ProductImportService).
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  isEnabled(): boolean {
    return Boolean(process.env.OCR_SERVICE_URL);
  }

  private baseUrl(): string {
    const url = process.env.OCR_SERVICE_URL;
    return (url && url.trim()) || DEFAULT_OCR_BASE;
  }

  /**
   * POST {OCR_SERVICE_URL}/api/v1/extract-products as multipart with the file
   * under field `file` and an `X-API-Key` header from `OCR_API_KEY`.
   */
  async extractProducts(file: OcrFile): Promise<OcrExtractResponse> {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], {
      type: file.mimetype || 'application/octet-stream',
    });
    form.append('file', blob, file.originalname);

    const headers: Record<string, string> = {};
    const apiKey = process.env.OCR_API_KEY;
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    const url = `${this.baseUrl()}/api/v1/extract-products`;
    const response = await axios.post<OcrExtractResponse>(url, form, {
      headers,
      // FormData sets its own multipart boundary; a generous but bounded wait.
      timeout: 60_000,
      maxContentLength: 20 * 1024 * 1024,
    });
    return response.data;
  }

  /**
   * POST {OCR_SERVICE_URL}/api/v1/extract-receipt as multipart with the file
   * under field `file` and an `X-API-Key` header from `OCR_API_KEY`. Used by
   * the receipts module to digitise supplier receipts/invoices.
   */
  async extractReceipt(file: Express.Multer.File): Promise<OcrReceipt> {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], {
      type: file.mimetype || 'application/octet-stream',
    });
    form.append('file', blob, file.originalname);

    const headers: Record<string, string> = {};
    const apiKey = process.env.OCR_API_KEY;
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    const url = `${this.baseUrl()}/api/v1/extract-receipt`;
    const response = await axios.post<OcrReceipt>(url, form, {
      headers,
      // FormData sets its own multipart boundary; a generous but bounded wait.
      timeout: 60_000,
      maxContentLength: 20 * 1024 * 1024,
    });
    return response.data;
  }

  /** Human-readable reason for a failed OCR round-trip. */
  describeError(error: unknown): string {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      return status
        ? `OCR service responded ${status}`
        : `OCR service unreachable (${error.code ?? error.message})`;
    }
    return error instanceof Error ? error.message : String(error);
  }

  logFailure(fileName: string, message: string): void {
    this.logger.warn(`OCR failed for ${fileName}: ${message}`);
  }
}
