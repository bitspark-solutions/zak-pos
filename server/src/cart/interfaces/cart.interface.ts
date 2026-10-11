export interface CartLine {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;
  sku: string;
  barcode?: string;
  qty: number;
  unitPrice: number;
  discount: number;
  taxId?: string;
  taxRate?: number;
  taxAmount: number;
  lineTotal: number;
}

export interface Cart {
  id: string;
  token: string;
  tenantId: string;
  shopId: string;
  customerId?: string;
  cashierId: string;
  status: 'active' | 'tendered' | 'completed' | 'cancelled';
  lines: CartLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface CreateCartDto {
  shopId: string;
  customerId?: string;
}

export interface AddLineDto {
  productId: string;
  variantId?: string;
  barcode?: string;
  qty: number;
  unitPrice?: number;
  discount?: number;
  taxId?: string;
}

export interface UpdateLineDto {
  qty?: number;
  unitPrice?: number;
  discount?: number;
  taxId?: string;
}

export interface TenderDto {
  method: 'cash' | 'card' | 'bkash' | 'nagad' | 'bank_transfer';
  amount?: number; // If not provided, uses cart total
  reference?: string;
}
