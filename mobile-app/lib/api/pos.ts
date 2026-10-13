/**
 * POS endpoint wrappers, verified against the server controllers:
 *  - server/src/product/product.controller.ts  (GET /products/barcode/:code)
 *  - server/src/cart/cart.controller.ts + cart.service.ts
 *  - server/src/sales/sales.controller.ts + sales.service.ts
 *  - server/src/shops/shops.controller.ts
 *
 * NOTE: there is no /tenants/current endpoint on this server. The shop name
 * for the top bar and the required `shopId` for POST /carts come from
 * GET /shops (single-shop tenants take the first entry).
 *
 * Shared by POS screens (G1b) and the scan-to-add-product flow (G1c).
 */
import { apiRequest, apiRequestRaw, ApiError } from './client';
import type {
  AddCartLineDto,
  Cart,
  CommitSaleDto,
  CommitSaleResult,
  ProductWithDetails,
  Shop,
  UpdateCartLineDto,
} from './types';

interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const PosApi = {
  /**
   * GET /shops -> PaginatedShopsResult { data: IShop[], ... } (raw array or
   * `.data` wrapper both tolerated). Guarded by SALE_READ (cashier/manager/owner).
   */
  async listShops(): Promise<Shop[]> {
    const res = await apiRequest<Shop[] | Paginated<Shop>>('/shops');
    if (Array.isArray(res)) return res;
    return Array.isArray(res?.data) ? res.data : [];
  },

  /**
   * GET /products/barcode/:code -> IProductWithDetails | null (raw object,
   * NO .data envelope). The service returns `null` for unknown codes, which
   * Nest serializes as an empty/`null` body -> we normalize to `null` here.
   * 404 is also treated as "not found".
   */
  async getProductByBarcode(code: string): Promise<ProductWithDetails | null> {
    try {
      const product = await apiRequest<ProductWithDetails | undefined>(
        `/products/barcode/${encodeURIComponent(code)}`
      );
      return product ?? null;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 204)) {
        return null;
      }
      throw e;
    }
  },

  /**
   * POST /carts body { shopId, customerId? } -> 201 raw Cart (includes .token).
   * Redis-backed, 1h TTL.
   */
  async createCart(shopId: string, customerId?: string): Promise<Cart> {
    return apiRequest<Cart>('/carts', {
      method: 'POST',
      body: customerId ? { shopId, customerId } : { shopId },
    });
  },

  /** GET /carts/:token -> raw Cart with server-computed totals. */
  async getCart(token: string): Promise<Cart> {
    return apiRequest<Cart>(`/carts/${token}`);
  },

  /**
   * POST /carts/:token/lines (AddLineDto) -> raw updated Cart.
   * The SERVER MERGES duplicate product lines (qty +=) so a rescan is a
   * simple qty:1 add — no PATCH needed.
   */
  async addLine(token: string, line: AddCartLineDto): Promise<Cart> {
    return apiRequest<Cart>(`/carts/${token}/lines`, { method: 'POST', body: line });
  },

  /** PUT /carts/:token/lines/:lineId (UpdateLineDto) -> raw updated Cart. */
  async updateLine(token: string, lineId: string, patch: UpdateCartLineDto): Promise<Cart> {
    return apiRequest<Cart>(`/carts/${token}/lines/${lineId}`, { method: 'PUT', body: patch });
  },

  /** DELETE /carts/:token/lines/:lineId -> raw updated Cart. */
  async removeLine(token: string, lineId: string): Promise<Cart> {
    return apiRequest<Cart>(`/carts/${token}/lines/${lineId}`, { method: 'DELETE' });
  },

  /** POST /carts/:token/tender -> Cart (status 'tendered'). REQUIRED before commit. */
  async tenderCart(token: string): Promise<Cart> {
    return apiRequest<Cart>(`/carts/${token}/tender`, { method: 'POST' });
  },

  /** POST /carts/:token/cancel -> Cart */
  async cancelCart(token: string): Promise<Cart> {
    return apiRequest<Cart>(`/carts/${token}/cancel`, { method: 'POST' });
  },

  /** DELETE /carts/:token -> { success: boolean } (drops the Redis cart) */
  async deleteCart(token: string): Promise<void> {
    await apiRequest<{ success: boolean }>(`/carts/${token}`, { method: 'DELETE' }).catch(
      () => undefined
    );
  },

  /**
   * POST /sales/commit (CommitSaleDto) -> 201 { sale: ISale, lines: ISaleLine[] } (raw).
   * Server validates amountTendered >= cart.total and cart.status === 'tendered'.
   */
  async commitSale(dto: CommitSaleDto): Promise<CommitSaleResult> {
    return apiRequest<CommitSaleResult>('/sales/commit', { method: 'POST', body: dto });
  },

  /**
   * GET /sales/:id/receipt -> PDF bytes (added concurrently by server agent
   * G1a). Returns the raw Response so the caller can check ok/content-type
   * and degrade gracefully while the endpoint is not live yet.
   */
  async fetchSaleReceipt(saleId: string): Promise<Response> {
    return apiRequestRaw(`/sales/${saleId}/receipt`);
  },
};
