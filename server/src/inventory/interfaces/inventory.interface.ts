export interface IInventory {
  id: string;
  shopId: string;
  productId: string;
  variantId?: string | null;
  quantityOnHand: number;
  valuationMethod: string;
  avgCost: number;
  updatedAt: Date;
}

export interface IInventoryWithProduct extends IInventory {
  product?: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  };
  variant?: {
    id: string;
    attributes: Record<string, string>;
  };
}

export interface IInventoryMovement {
  id: string;
  tenantId: string;
  shopId: string;
  productId: string;
  variantId?: string | null;
  movementType: string;
  quantity: number;
  unitCost?: number | null;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  createdAt: Date;
}

export interface StockCheckResult {
  productId: string;
  variantId?: string;
  available: number;
  reserved: number;
  quantityOnHand: number;
}
