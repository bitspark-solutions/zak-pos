import type { AuthUser } from '../../auth/interfaces/auth-user.interface';

/**
 * Shapes used by the receipts (supplier receipt / invoice digitisation) module.
 *
 * A `ReceiptDraftPayload` is produced by the digitize step: the OCR receipt is
 * enriched with tenant product matches + supplier suggestions, cached in Redis
 * under `rdigit:<draftId>`, reviewed by the user, and finally materialised into
 * `Purchase` + `PurchaseLine` rows by the commit step. OCR amounts are kept
 * purely for display — commit always recomputes from the user-confirmed lines.
 */

/** AuthUser widened with the optional JWT `shopId` context claim. */
export interface ReceiptsAuthUser extends AuthUser {
  shopId?: string;
}

/** One receipt line as surfaced to the client (snake_case OCR -> camelCase). */
export interface ReceiptDraftLine {
  /** 0-based line index; echoed back unchanged by commit. */
  lineId: number;
  name: string;
  qty: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
  matchedProductId: string | null;
  matchedProductName: string | null;
}

export interface ReceiptSupplierOption {
  id: string;
  name: string;
}

/** Payload persisted in Redis under `rdigit:<draftId>`. */
export interface ReceiptDraftPayload {
  tenantId: string;
  draftId: string;
  vendor: string | null;
  documentDate: string | null;
  currency: string | null;
  subtotal: number | null;
  discount: number | null;
  tax: number | null;
  total: number | null;
  engine: string;
  lines: ReceiptDraftLine[];
  supplierSuggestions: ReceiptSupplierOption[];
  createdAt: string;
}

/** Public draft shape returned by digitize and GET draft/:draftId (exact wire names). */
export interface ReceiptDraftResponse {
  draftId: string;
  vendor: string | null;
  documentDate: string | null;
  currency: string | null;
  subtotal: number | null;
  discount: number | null;
  tax: number | null;
  total: number | null;
  engine: string;
  lines: ReceiptDraftLine[];
  supplierSuggestions: ReceiptSupplierOption[];
}

/** Result of committing a reviewed draft into a Purchase (exact wire names). */
export interface ReceiptCommitResult {
  purchaseId: string;
  status: string;
  linesCreated: number;
  total: number;
}
