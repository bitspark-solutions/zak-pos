/**
 * Typed mirrors of the server DTOs (verified against
 * server/src/{cart,sales,product,shops}/interfaces/*.ts).
 *
 * The server controllers return RAW objects (no `.data` envelope) for every
 * endpoint used here — except GET /shops, which is paginated (see
 * lib/api/pos.ts listShops for the envelope note).
 *
 * Shared by the POS screens (G1b) and the scan-to-add-product flow (G1c).
 */

// ---------------------------------------------------------------------------
// Cart (server/src/cart/interfaces/cart.interface.ts)
// ---------------------------------------------------------------------------

export interface CartLine {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;
  sku: string;
  barcode?: string;
  qty: number;
  unitPrice: number;
  /** Absolute discount amount (NOT a percent) — see pricing.service.ts: lineTotal = unitPrice * qty - discount */
  discount: number;
  taxId?: string;
  taxRate?: number;
  taxAmount: number;
  lineTotal: number;
}

export type CartStatus = 'active' | 'tendered' | 'completed' | 'cancelled';

export interface Cart {
  id: string;
  token: string;
  tenantId: string;
  shopId: string;
  customerId?: string;
  cashierId: string;
  status: CartStatus;
  lines: CartLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  /** JSON dates arrive as ISO strings */
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

/** POST /carts/:token/lines body */
export interface AddCartLineDto {
  productId: string;
  variantId?: string;
  barcode?: string;
  qty: number;
  unitPrice?: number;
  /** absolute amount, not percent */
  discount?: number;
  taxId?: string;
}

/** PUT /carts/:token/lines/:lineId body — qty <= 0 REMOVES the line server-side */
export interface UpdateCartLineDto {
  qty?: number;
  unitPrice?: number;
  discount?: number;
  taxId?: string;
}

// ---------------------------------------------------------------------------
// Products (server/src/product/interfaces/product.interface.ts)
// ---------------------------------------------------------------------------

export interface ProductTax {
  id: string;
  name: string;
  ratePercent: number;
  inclusive: boolean;
}

export interface ProductVariant {
  id: string;
  productId: string;
  attributes: Record<string, string>;
  barcode?: string | null;
  priceOverride?: number | null;
  costOverride?: number | null;
  isActive: boolean;
}

export interface ProductBarcodeRecord {
  id: string;
  productId: string;
  variantId?: string | null;
  type: string;
  value: string;
  isPrimary: boolean;
}

/** GET /products/barcode/:code -> IProductWithDetails | null (raw, no envelope) */
export interface ProductWithDetails {
  id: string;
  tenantId: string;
  name: string;
  sku: string;
  unit: string;
  basePrice: number;
  defaultCost: number;
  categoryId?: string | null;
  taxId?: string | null;
  isWeighted: boolean;
  isActive: boolean;
  tax?: ProductTax | null;
  variants?: ProductVariant[];
  barcodes?: ProductBarcodeRecord[];
}

/** PUT /products/:id body (UpdateProductDto — every field optional) */
export interface UpdateProductPayload {
  name?: string;
  sku?: string;
  unit?: string;
  basePrice?: number;
  defaultCost?: number;
  categoryId?: string;
  taxId?: string;
  isWeighted?: boolean;
  isActive?: boolean;
}

/** POST /inventory/adjust body (AdjustStockDto). 'IN' creates the inventory row when absent. */
export interface AdjustStockPayload {
  shopId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  unitCost?: number;
  reference?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Categories (server/src/category/interfaces/category.interface.ts)
// GET /categories -> ICategory[] raw array (no envelope)
// ---------------------------------------------------------------------------

export interface Category {
  id: string;
  tenantId: string;
  parentId?: string | null;
  name: string;
  path: string;
}

// ---------------------------------------------------------------------------
// Product import (server/src/product-import/interfaces/product-import.interface.ts)
// The ONLY server path that persists Barcode rows with a product
// (POST /products has no barcode field; there is no attach-barcode endpoint).
// ---------------------------------------------------------------------------

export interface ImportCandidate {
  candidateId: number;
  fileName: string;
  name: string;
  sku: string | null;
  basePrice: number | null;
  defaultCost: number | null;
  unit: string;
  categoryName: string | null;
  barcodes: string[];
  flagged: boolean;
  flags: string[];
}

/** POST /product-import/preview -> PreviewResult (raw, 200) */
export interface ImportPreviewResult {
  uploadId: string;
  files: { name: string; kind: 'sheet' | 'ocr'; error?: string }[];
  candidates: ImportCandidate[];
  total: number;
}

export interface ImportCreatedProduct {
  id: string;
  name: string;
  sku: string;
  note?: string;
}

export interface ImportRejectedEntry {
  candidateId: number;
  name: string;
  reason: string;
}

/** POST /product-import/commit -> CommitResult (raw, 200) */
export interface ImportCommitResult {
  created: ImportCreatedProduct[];
  conflicts: ImportRejectedEntry[];
  skipped: ImportRejectedEntry[];
}

// ---------------------------------------------------------------------------
// Shops (server/src/shops/interfaces/shop.interface.ts)
// ---------------------------------------------------------------------------

export interface Shop {
  id: string;
  tenantId: string;
  name: string;
  address: string | null;
  timeZone: string;
  taxProfileId: string | null;
}

// ---------------------------------------------------------------------------
// Sales (server/src/sales/interfaces/sales.interface.ts)
// ---------------------------------------------------------------------------

export type PaymentMethod = 'cash' | 'card' | 'bkash' | 'nagad' | 'bank_transfer';

/** POST /sales/commit body */
export interface CommitSaleDto {
  cartToken: string;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  amountTendered?: number;
}

export interface Sale {
  id: string;
  tenantId: string;
  shopId: string;
  customerId?: string;
  cashierId: string;
  status: string;
  channel: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentStatus: string;
  currency: string;
  createdAt: string;
  postedAt?: string;
}

export interface SaleLine {
  id: string;
  saleId: string;
  productId: string;
  variantId?: string;
  qty: number;
  unitPrice: number;
  discount: number;
  taxId?: string;
  taxAmount: number;
  lineTotal: number;
}

/** POST /sales/commit -> 201 { sale: ISale, lines: ISaleLine[] } (raw) */
export interface CommitSaleResult {
  sale: Sale;
  lines: SaleLine[];
}
