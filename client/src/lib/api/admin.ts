import apiClient from './client';
import type {
  AdminUser,
  CreateStaffInput,
  Shop,
  TenantProfile,
  UpdateStaffRoleInput,
} from '@/types/admin';
import type { User } from '@/types/auth';

// All admin endpoints go through the shared ApiClient (src/lib/api/client.ts),
// which reads the token from storage and attaches the Bearer header, and
// surfaces API errors as thrown Error with a user-friendly message.

export const adminApi = {
  // Current authenticated user + tenant context.
  async getProfile(): Promise<User> {
    const res = await apiClient.get<User>('/auth/profile');
    return res.data;
  },

  // Staff (users scoped to the caller's tenant). GET is allowed for
  // admin/owner/manager (permission user:read).
  async listUsers(): Promise<AdminUser[]> {
    const res = await apiClient.get<AdminUser[]>('/users');
    return res.data;
  },

  // Create a staff account. POST is allowed for admin/owner (user:create).
  async createStaff(input: CreateStaffInput): Promise<AdminUser> {
    const res = await apiClient.post<AdminUser>('/users', input);
    return res.data;
  },

  // Update a staff member's role. PATCH is allowed for admin/owner/manager
  // (user:update).
  async updateStaffRole(id: string, input: UpdateStaffRoleInput): Promise<AdminUser> {
    const res = await apiClient.patch<AdminUser>(`/users/${id}`, input);
    return res.data;
  },

  // Shops scoped to the caller's tenant (tenant-scoped CRUD live on the server).
  async listShops(): Promise<Shop[]> {
    const res = await apiClient.get<Shop[] | { data: Shop[] }>('/shops');
    return Array.isArray(res.data) ? res.data : res.data.data;
  },

  async createShop(input: { name: string; address?: string }): Promise<Shop> {
    const res = await apiClient.post<Shop>('/shops', input);
    return res.data;
  },

  // Tenant self-service settings (OWNER only on the server).
  async getTenant(): Promise<TenantProfile> {
    const res = await apiClient.get<TenantProfile>('/tenants/current');
    return res.data;
  },

  async updateTenantName(name: string): Promise<TenantProfile> {
    const res = await apiClient.patch<TenantProfile>('/tenants/current', {
      name,
    });
    return res.data;
  },
};
