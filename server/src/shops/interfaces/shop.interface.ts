export interface IShop {
  id: string;
  tenantId: string;
  name: string;
  address: string | null;
  timeZone: string;
  taxProfileId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Pagination envelope mirroring the products controller convention so the admin
// client can read either a raw array or the `.data` wrapper.
export interface PaginatedShopsResult {
  data: IShop[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
