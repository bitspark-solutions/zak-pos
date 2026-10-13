/**
 * Product + inventory endpoint wrappers for the scan-to-add-product flow (G1c),
 * verified against the server controllers:
 *  - server/src/product/product.controller.ts        (GET /products/:id, PUT /products/:id)
 *  - server/src/category/category.controller.ts      (GET /categories)
 *  - server/src/product-import/product-import.controller.ts
 *      (POST /product-import/preview multipart, POST /product-import/commit)
 *  - server/src/inventory/inventory.controller.ts    (POST /inventory/adjust)
 *
 * WHY creation goes through product-import and NOT POST /products:
 * CreateProductDto requires `sku` as a string, has no barcode field, and the
 * global ValidationPipe is forbidNonWhitelisted — so POST /products can neither
 * auto-generate a SKU nor persist the scanned barcode, and no endpoint exists
 * to attach a barcode afterwards. The product-import preview+commit pair is the
 * closest existing route: it auto-generates blank SKUs and creates Barcode rows
 * (isPrimary, type inferred from length), so GET /products/barcode/:code finds
 * the product on the next scan. Import does not carry `isWeighted`, so we PATCH
 * it with PUT /products/:id right after commit.
 *
 * Style follows lib/api/pos.ts (thin wrappers, raw payloads, no .data envelope).
 */
import { File, Paths } from 'expo-file-system';

import { apiRequest, ApiError } from './client';
import { API_CONFIG, getApiUrl, fetchWithTimeout } from './config';
import { AuthStorage } from '../storage/auth-storage';
import type {
  AdjustStockPayload,
  Category,
  ImportCommitResult,
  ImportPreviewResult,
  ProductWithDetails,
  UpdateProductPayload,
} from './types';

export const ProductApi = {
  /**
   * GET /categories -> ICategory[] (raw array). Guarded by PRODUCT_READ
   * (cashier/manager/owner), so the picker can always be populated for the
   * current tenant.
   */
  async listCategories(): Promise<Category[]> {
    const res = await apiRequest<Category[] | { data?: Category[] }>('/categories');
    if (Array.isArray(res)) return res;
    return Array.isArray(res?.data) ? res.data : [];
  },

  /** GET /products/:id -> IProductWithDetails (raw). Used to reload the product for the cart. */
  async getProduct(id: string): Promise<ProductWithDetails> {
    return apiRequest<ProductWithDetails>(`/products/${encodeURIComponent(id)}`);
  },

  /**
   * PUT /products/:id (UpdateProductDto, all fields optional) -> full product.
   * Guarded OWNER/MANAGER + PRODUCT_UPDATE. Used to apply `isWeighted`
   * (the import CSV cannot carry it).
   */
  async updateProduct(id: string, patch: UpdateProductPayload): Promise<ProductWithDetails> {
    return apiRequest<ProductWithDetails>(`/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: patch,
    });
  },

  /**
   * POST /product-import/preview — multipart upload of a generated one-row CSV
   * (field name: `files`). Returns { uploadId, candidates, ... }; candidates
   * are cached in Redis for 1h. Guarded OWNER/MANAGER + PRODUCT_CREATE.
   *
   * Not using apiRequest (JSON-only): this needs a multipart body, so the
   * Bearer token and base URL are wired the same way client.ts does.
   */
  async uploadProductCsv(csv: string): Promise<ImportPreviewResult> {
    const token = await AuthStorage.getToken();
    if (!token) throw new ApiError('Not authenticated', 401);

    const file = new File(Paths.cache, `zakpos-add-product-${Date.now()}.csv`);
    file.create({ overwrite: true });
    file.write(csv);

    const form = new FormData();
    // RN FormData accepts { uri, name, type } file parts (multipart upload).
    form.append('files', { uri: file.uri, name: 'add-product.csv', type: 'text/csv' } as unknown as Blob);

    try {
      const response = await fetchWithTimeout(
        getApiUrl('/product-import/preview'),
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: form,
        },
        API_CONFIG.timeout
      );
      const text = await response.text();
      const data = text ? (JSON.parse(text) as ImportPreviewResult & { message?: unknown }) : undefined;
      if (!response.ok) {
        const message =
          data && typeof data.message === 'string' && data.message
            ? data.message
            : `Request failed (${response.status})`;
        throw new ApiError(message, response.status, data);
      }
      if (!data) throw new ApiError('Empty preview response', 502);
      return data;
    } finally {
      try {
        await file.delete();
      } catch {
        // best-effort temp-file cleanup
      }
    }
  },

  /**
   * POST /product-import/commit { uploadId, candidateIds } -> CommitResult
   * { created: [{id,name,sku}], conflicts, skipped } (200 OK, raw).
   * Conflicts/skipped are DATA, not HTTP errors — the caller must inspect them.
   */
  async commitImport(uploadId: string, candidateIds: number[]): Promise<ImportCommitResult> {
    return apiRequest<ImportCommitResult>('/product-import/commit', {
      method: 'POST',
      body: { uploadId, candidateIds },
    });
  },

  /**
   * POST /inventory/adjust (AdjustStockDto) -> 200 { inventory, movement } (raw).
   * Guarded OWNER/MANAGER + INVENTORY_UPDATE. An 'IN' movement creates the
   * inventory row (avgCost = unitCost) when absent, so it doubles as the
   * opening-stock path.
   */
  async adjustStock(payload: AdjustStockPayload): Promise<void> {
    await apiRequest<unknown>('/inventory/adjust', { method: 'POST', body: payload });
  },
};
