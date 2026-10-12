import apiClient from './client';
import type {
  ReceiptCommitPayload,
  ReceiptCommitResult,
  ReceiptDraft,
  SupplierOption,
} from '@/types/receipts';

// All receipt endpoints go through the shared ApiClient axios instance
// (src/lib/api/client.ts), which attaches the Bearer token via its request
// interceptor and normalises failures into thrown Error with a friendly
// message. The instance-level `Content-Type: application/json` default is
// overridden per-request for the multipart upload; browsers generate the
// multipart boundary themselves when the header is `multipart/form-data`.

// Digitize runs server-side OCR on a PDF/image and commit writes the whole
// purchase — both need a longer timeout than the 30s instance default.
const LONG_TIMEOUT_MS = 120_000;

export const receiptsApi = {
  // Upload a single supplier receipt (.pdf/.png/.jpg/.webp) under the
  // multipart field `file` and get the OCR draft back.
  async digitizeReceipt(file: File): Promise<ReceiptDraft> {
    const form = new FormData();
    form.append('file', file);

    const res = await apiClient.post<ReceiptDraft>('/receipts/digitize', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: LONG_TIMEOUT_MS,
    });
    return res.data;
  },

  // Re-fetch a draft by id (e.g. after a page reload mid-review).
  async getDraft(draftId: string): Promise<ReceiptDraft> {
    const res = await apiClient.get<ReceiptDraft>(
      `/receipts/draft/${encodeURIComponent(draftId)}`,
      { timeout: LONG_TIMEOUT_MS },
    );
    return res.data;
  },

  // Full supplier list for the review picker. The contract says the body is
  // the array directly, but a paginated `{ data: [...] }` envelope is
  // tolerated defensively.
  async listSuppliers(): Promise<SupplierOption[]> {
    const res = await apiClient.get<SupplierOption[] | { data?: SupplierOption[] }>(
      '/receipts/suppliers',
    );
    if (Array.isArray(res.data)) return res.data;
    return Array.isArray(res.data?.data) ? res.data.data : [];
  },

  // Create the purchase from a reviewed draft.
  async commitReceipt(payload: ReceiptCommitPayload): Promise<ReceiptCommitResult> {
    const res = await apiClient.post<ReceiptCommitResult>(
      '/receipts/commit',
      payload,
      { timeout: LONG_TIMEOUT_MS },
    );
    return res.data;
  },
};

// Product summary as needed by the receipt line-matching picker. The picker
// reuses the existing products search endpoint (GET /products?search=&limit=)
// rather than a receipts-specific one.
export interface ProductSearchResult {
  id: string;
  name: string;
  sku: string | null;
}

// Loose shape of the paginated products response; only id/name/sku are read.
interface ProductsSearchResponse {
  data?: { id?: string; name?: string; sku?: string }[];
}

export async function searchProducts(query: string): Promise<ProductSearchResult[]> {
  const res = await apiClient.get<ProductsSearchResponse>('/products', {
    params: { search: query, limit: 8 },
  });
  const rows = Array.isArray(res.data?.data) ? res.data.data : [];

  const results: ProductSearchResult[] = [];
  for (const row of rows) {
    if (typeof row.id === 'string' && typeof row.name === 'string') {
      results.push({ id: row.id, name: row.name, sku: typeof row.sku === 'string' ? row.sku : null });
    }
    if (results.length >= 8) break;
  }
  return results;
}
