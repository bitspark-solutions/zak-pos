// POS domain types mirroring the server contracts (READ from server/src,
// same shapes the mobile app relies on):
//  - server/src/cart/interfaces/cart.interface.ts   (Cart, CartLine, AddLineDto, UpdateLineDto)
//  - server/src/product/interfaces/product.interface.ts (IProductWithDetails, IBarcode)
//  - server/src/sales/interfaces/sales.interface.ts (ISale, ISaleLine, CommitSaleDto)
//  - server/src/invoice/dto/invoice.dto.ts          (CreateInvoiceFromSaleDto)
// The server returns RAW objects (no response envelope); only GET /shops and
// GET /products are paginated ({ data, total, page, limit }).

export type CartStatus = 'active' | 'tendered' | 'completed' | 'cancelled';

export type PaymentMethod = 'cash' | 'card' | 'bkash' | 'nagad' | 'bank_transfer';

/** Cart line as returned by every cart mutation (server-computed lineTotal). */
export interface CartLine {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;
  sku: string;
  barcode?: string;
  qty: number;
  unitPrice: number;
  /** ABSOLUTE discount amount (not a percent) — see lib/pos/pos-helpers.ts. */
  discount: number;
  taxId?: string;
  taxRate?: number;
  taxAmount: number;
  lineTotal: number;
}

/** POST /carts/:token/lines body. */
export interface AddCartLineDto {
  productId: string;
  variantId?: string;
  barcode?: string;
  qty: number;
  unitPrice?: number;
  discount?: number;
  taxId?: string;
}

/** PUT /carts/:token/lines/:lineId body (qty <= 0 removes the line). */
export interface UpdateCartLineDto {
  qty?: number;
  unitPrice?: number;
  discount?: number;
  taxId?: string;
}

/** Raw Cart (Redis-backed, 1h TTL) returned by all /carts endpoints. */
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

/** GET /products/barcode/:code -> IProductWithDetails | null (raw). */
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
  barcodes?: { id: string; productId: string; value: string; isPrimary: boolean }[];
}

/** Row shape needed by the manual product-search picker (GET /products?search=). */
export interface PosProductResult {
  id: string;
  name: string;
  sku: string | null;
  basePrice: number;
}

/** POST /sales/commit body (cart must be tendered first). */
export interface CommitSaleDto {
  cartToken: string;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  amountTendered?: number;
}

/** POST /sales/commit -> 201 { sale, lines } (raw). */
export interface CommitSaleResult {
  sale: Sale;
  lines: SaleLine[];
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

/** Minimal IInvoice fields read after POST /invoices/from-sale. */
export interface Invoice {
  id: string;
  saleId?: string;
  status?: string;
  total?: number;
}
