export interface IInvoice {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  shopId: string;
  saleId?: string | null;
  customerId?: string | null;
  status: InvoiceStatus;
  dueDate?: Date | null;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string | null;
  /**
   * Portal-share axis (G2a): set by auto-share when the sale's linked tenant
   * contact maps to a phone-verified CustomerAccount that follows this tenant.
   * Independent of `status` (draft/sent/confirmed/paid/cancelled).
   */
  sharedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'confirmed'
  | 'paid'
  | 'cancelled';

export interface IInvoiceWithDetails extends IInvoice {
  shop?: {
    id: string;
    name: string;
  } | null;
  customer?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  sale?: {
    id: string;
    total: number;
    status: string;
  } | null;
}
