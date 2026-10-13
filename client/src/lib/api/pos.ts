import { API_BASE_URL } from '@/lib/utils/constants';
import { tokenStorage } from '@/lib/auth/storage';
import apiClient from './client';
import type {
  AddCartLineDto,
  Cart,
  CommitSaleDto,
  CommitSaleResult,
  Invoice,
  PosProductResult,
  ProductWithDetails,
  UpdateCartLineDto,
} from '@/types/pos';
import type { Shop } from '@/types/admin';

// All POS endpoints go through the shared ApiClient (src/lib/api/client.ts),
// which attaches the Bearer token and normalises failures into thrown Error
// with a readable message. The server returns RAW objects with no envelope;
// only GET /shops and GET /products are paginated ({ data, total, ... }) —
// tolerated defensively below, mirroring lib/api/admin.ts and receipts.ts.

interface Paginated<T> {
  data: T[];
}

export const posApi = {
  // GET /shops (paginated) -> first shop is the counter's shop for single-shop
  // tenants. Same idiom the mobile app uses; there is no /tenants/current use
  // for POS context and adminApi.getTenant is OWNER-only.
  async listShops(): Promise<Shop[]> {
    const res = await apiClient.get<Shop[] | Paginated<Shop>>('/shops');
    return Array.isArray(res.data) ? res.data : res.data.data;
  },

  // GET /products/barcode/:code -> raw IProductWithDetails | null. The service
  // returns null for unknown codes; a 404 is also treated as "not found".
  async getProductByBarcode(code: string): Promise<ProductWithDetails | null> {
    try {
      const res = await apiClient.get<ProductWithDetails | null | ''>(
        `/products/barcode/${encodeURIComponent(code)}`,
      );
      // null body, empty body, or a 404 all mean "no such barcode".
      return res.data && typeof res.data === 'object' ? res.data : null;
    } catch (err) {
      if (err instanceof Error && /not found/i.test(err.message)) return null;
      throw err;
    }
  },

  // GET /products?search=&limit= (paginated) for the manual tap-to-add picker.
  async searchProducts(query: string): Promise<PosProductResult[]> {
    const res = await apiClient.get<Paginated<Partial<ProductWithDetails>> | Partial<ProductWithDetails>[]>('/products', {
      params: { search: query, limit: 8 },
    });
    const rows = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    const results: PosProductResult[] = [];
    for (const row of rows) {
      if (typeof row.id === 'string' && typeof row.name === 'string') {
        results.push({
          id: row.id,
          name: row.name,
          sku: typeof row.sku === 'string' ? row.sku : null,
          basePrice: Number(row.basePrice ?? 0),
        });
      }
      if (results.length >= 8) break;
    }
    return results;
  },

  // POST /carts { shopId } -> 201 raw Cart incl. token (Redis, 1h TTL).
  async createCart(shopId: string): Promise<Cart> {
    const res = await apiClient.post<Cart>('/carts', { shopId });
    return res.data;
  },

  // Every mutation below returns the raw updated Cart with server-computed
  // totals, so the UI never re-fetches after add/update/remove.
  async addLine(token: string, line: AddCartLineDto): Promise<Cart> {
    const res = await apiClient.post<Cart>(`/carts/${token}/lines`, line);
    return res.data;
  },

  // PUT /carts/:token/lines/:lineId — qty <= 0 removes the line server-side.
  async updateLine(token: string, lineId: string, patch: UpdateCartLineDto): Promise<Cart> {
    const res = await apiClient.put<Cart>(`/carts/${token}/lines/${lineId}`, patch);
    return res.data;
  },

  async removeLine(token: string, lineId: string): Promise<Cart> {
    const res = await apiClient.delete<Cart>(`/carts/${token}/lines/${lineId}`);
    return res.data;
  },

  async cancelCart(token: string): Promise<Cart> {
    const res = await apiClient.post<Cart>(`/carts/${token}/cancel`);
    return res.data;
  },

  // POST /carts/:token/tender — REQUIRED before /sales/commit (no body).
  async tenderCart(token: string): Promise<Cart> {
    const res = await apiClient.post<Cart>(`/carts/${token}/tender`);
    return res.data;
  },

  // POST /sales/commit -> 201 { sale, lines }. amountTendered < total is
  // rejected by the server.
  async commitSale(dto: CommitSaleDto): Promise<CommitSaleResult> {
    const res = await apiClient.post<CommitSaleResult>('/sales/commit', dto);
    return res.data;
  },

  // POST /invoices/from-sale { saleId } -> raw IInvoice (201 first time, 200
  // idempotent when an invoice already exists).
  async createInvoiceFromSale(saleId: string): Promise<Invoice> {
    const res = await apiClient.post<Invoice>('/invoices/from-sale', { saleId });
    return res.data;
  },
};

// PDF downloads (GET /sales/:id/receipt, GET /invoices/:id/pdf) return raw
// application/pdf bytes, which axios can only read through a separate entry
// point: the shared instance's response interceptor would hand binary back
// mangled. We fetch with the Bearer token from tokenStorage and blob-download
// via an object URL — keep it outside the ApiClient envelope entirely.
export async function downloadPdf(path: string, filename: string): Promise<void> {
  const token = tokenStorage.getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`Could not fetch the PDF (${res.status}).`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
