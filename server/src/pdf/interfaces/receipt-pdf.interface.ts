/**
 * One printed line on a thermal-slip receipt. Names come from the linked
 * product; `amount` is the line total already rounded to 2 decimals.
 */
export interface ReceiptPdfLine {
  name: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

/**
 * The normalized, presentation-ready shape a receipt PDF is rendered from.
 * Both the invoice PDF and the sale receipt are mapped into this shape so a
 * single renderer backs every slip, and so the renderer stays free of Prisma
 * and Nest concerns (it only receives plain values).
 */
export interface ReceiptPdfPayload {
  /** Display name of the shop, printed as the slip header. */
  shopName: string;
  /** Optional address line under the shop name. */
  shopAddress?: string | null;
  /** Human-facing reference shown on the slip: an invoice or sale number. */
  documentNumber: string;
  /** Header label distinguishing the document, e.g. "TAX INVOICE" / "SALE RECEIPT". */
  documentTitle: string;
  /** Transaction date (issued / posted). */
  date: Date | string;
  customerName?: string | null;
  customerPhone?: string | null;
  lines: ReceiptPdfLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  /** Payment method label, e.g. "CASH", "bKash". */
  paymentMethod?: string | null;
  /** ISO-4217-ish currency label shown next to money, e.g. "BDT". */
  currency?: string | null;
  /** Free-text note rendered above the footer. */
  notes?: string | null;
  /** Slip width in millimetres; defaults to a 80mm thermal roll. */
  widthMm?: number;
}
