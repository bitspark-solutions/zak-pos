export interface IProduct {
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
  variantGroupId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductWithDetails extends IProduct {
  category?: ICategory | null;
  tax?: ITax | null;
  variants?: IProductVariant[];
  barcodes?: IBarcode[];
}

export interface ICategory {
  id: string;
  tenantId: string;
  parentId?: string | null;
  name: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITax {
  id: string;
  tenantId: string;
  name: string;
  ratePercent: number;
  inclusive: boolean;
  isActive: boolean;
}

export interface IProductVariant {
  id: string;
  productId: string;
  attributes: Record<string, string>;
  barcode?: string | null;
  priceOverride?: number | null;
  costOverride?: number | null;
  isActive: boolean;
}

export interface IBarcode {
  id: string;
  productId: string;
  variantId?: string | null;
  type: string;
  value: string;
  isPrimary: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
