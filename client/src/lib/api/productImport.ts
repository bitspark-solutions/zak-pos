import apiClient from './client';
import type { ProductImportPreview } from '@/types/productImport';

// All product-import endpoints go through the shared ApiClient axios instance
// (src/lib/api/client.ts), which attaches the Bearer token via its request
// interceptor and normalises failures into thrown Error with a friendly
// message. The instance-level `Content-Type: application/json` default is
// overridden per-request for the multipart upload; browsers generate the
// multipart boundary themselves when the header is `multipart/form-data`.

// Preview can take a while (server-side OCR), and commit creates many rows —
// both need a longer timeout than the 30s instance default.
const LONG_TIMEOUT_MS = 120_000;

export interface CommitResponse {
  created: { id: string; name: string; sku: string | null }[];
  conflicts: { candidateId: number; name: string; reason: string }[];
  skipped: { candidateId?: number; name?: string; reason?: string }[];
}

// Per-candidate inline edit sent with commit; omitted fields keep their
// preview values. Mirrors CandidateOverrideDto on the server.
export interface CandidateOverride {
  candidateId: number;
  name?: string;
  sku?: string;
  basePrice?: number;
  unit?: string;
}

export const productImportApi = {
  // Upload one or more files (.csv/.xlsx/.png/.jpg/.webp/.pdf) under the
  // multipart field `files` and get parsed candidates back.
  async preview(files: File[]): Promise<ProductImportPreview> {
    const form = new FormData();
    files.forEach((file) => form.append('files', file));

    const res = await apiClient.post<ProductImportPreview>(
      '/product-import/preview',
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: LONG_TIMEOUT_MS,
      },
    );
    return res.data;
  },

  // Re-fetch candidates for a previous upload (e.g. after a page reload or a
  // partial OCR failure).
  async getPreview(uploadId: string): Promise<ProductImportPreview> {
    const res = await apiClient.get<ProductImportPreview>(
      `/product-import/preview/${encodeURIComponent(uploadId)}`,
    );
    return res.data;
  },

  // Import the checked candidates. Inline edits made on the review table are
  // sent as per-candidate overrides (only the fields that actually changed);
  // the server applies them to its cached candidates before commit.
  async commit(
    uploadId: string,
    candidateIds: number[],
    overrides: CandidateOverride[] = [],
  ): Promise<CommitResponse> {
    const res = await apiClient.post<CommitResponse>(
      '/product-import/commit',
      { uploadId, candidateIds, overrides },
      { timeout: LONG_TIMEOUT_MS },
    );
    return res.data;
  },
};
