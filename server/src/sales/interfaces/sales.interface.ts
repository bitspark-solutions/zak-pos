export interface ISale {
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
  createdAt: Date;
  postedAt?: Date;
}

export interface ISaleLine {
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

export interface IJournalEntry {
  id: string;
  tenantId: string;
  date: Date;
  description: string;
  source: string;
  referenceType?: string;
  referenceId?: string;
  status: string;
}

export interface IJournalLine {
  id: string;
  journalId: string;
  accountId: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface CommitSaleDto {
  cartToken: string;
  paymentMethod: 'cash' | 'card' | 'bkash' | 'nagad' | 'bank_transfer';
  paymentReference?: string;
  amountTendered?: number;
}

export interface RefundSaleDto {
  reason: string;
  refundMethod: 'cash' | 'card' | 'bkash' | 'nagad' | 'bank_transfer';
  lines?: { lineId: string; qty: number }[]; // If not provided, full refund
}
