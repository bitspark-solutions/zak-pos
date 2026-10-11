// Shapes returned by the admin-facing API endpoints (verified against the
// running NestJS server on 2026-10-12).

// POST/PATCH/GET /users record. Mirrors the Prisma User row minus `password`.
export interface AdminUser {
  id: string;
  externalId: string | null;
  name: string;
  phone: string | null;
  email: string;
  role: 'owner' | 'manager' | 'cashier' | 'admin';
  tenantId: string;
  locale?: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

// Role values accepted by the API (lowercase; the Prisma `role` column is a
// string with owner/manager/cashier).
export type StaffRole = 'owner' | 'manager' | 'cashier';

export interface CreateStaffInput {
  name: string;
  email: string;
  password: string;
  role: StaffRole;
  phone?: string;
}

export interface UpdateStaffRoleInput {
  role: StaffRole;
}

// Shop row (Prisma `shops`), served by the tenant-scoped /shops CRUD.
export interface Shop {
  id: string;
  tenantId: string;
  name: string;
  address?: string | null;
  timeZone?: string;
  createdAt?: string;
  updatedAt?: string;
}

// GET/PATCH /tenants/current (owner-only self-service settings).
export interface TenantProfile {
  id: string;
  name: string;
  plan: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}
