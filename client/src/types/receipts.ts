// Types for the receipt-digitization API (POST/GET /receipts/*).
// Mirrors the NestJS contract exactly (snake_case server fields exposed as
// camelCase here); kept separate from server code so the UI can be built
// before the backend is fully live.

/** One OCR line proposed by the digitizer, before user review. */
export interface ReceiptLine {
  lineId: number;
  /** Product name as read from the receipt (display-only in the UI). */
  name: string;
  qty: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
  /** Product auto-matched by the server line-matcher, if any. */
  matchedProductId: string | null;
  matchedProductName: string | null;
}

/** A known supplier offered as a match suggestion. */
export interface SupplierOption {
  id: string;
  name: string;
}

/** Response of POST /receipts/digitize and GET /receipts/draft/:draftId. */
export interface ReceiptDraft {
  draftId: string;
  vendor: string | null;
  /** Document date as read from the receipt (free-form; normalised in the UI). */
  documentDate: string | null;
  currency: string | null;
  subtotal: number | null;
  discount: number | null;
  tax: number | null;
  total: number | null;
  /** OCR engine name reported by the server (shown as a badge). */
  engine: string;
  lines: ReceiptLine[];
  supplierSuggestions: SupplierOption[];
}

/** A reviewed line ready for commit. */
export interface ReceiptCommitLine {
  lineId: number;
  productId: string;
  qty: number;
  unitCost: number;
}

/** Body of POST /receipts/commit. Omitted optional fields are not sent. */
export interface ReceiptCommitPayload {
  draftId: string;
  supplierId?: string;
  newSupplierName?: string;
  date?: string;
  notes?: string;
  receive?: boolean;
  discount?: number;
  tax?: number;
  lines: ReceiptCommitLine[];
}

/** Response of POST /receipts/commit. */
export interface ReceiptCommitResult {
  purchaseId: string;
  status: string;
  linesCreated: number;
  total: number;
}
