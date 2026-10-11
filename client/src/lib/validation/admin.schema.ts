import { z } from 'zod';

// Staff roles the API accepts (lowercase values; displayed uppercase in the UI).
export const STAFF_ROLES = ['owner', 'manager', 'cashier'] as const;

export const createStaffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  // Server requires min length 6; keep 8 to match the app's register rule.
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(STAFF_ROLES),
  phone: z.string().optional(),
});

export type CreateStaffFormData = z.infer<typeof createStaffSchema>;

export const createShopSchema = z.object({
  name: z.string().min(2, 'Shop name must be at least 2 characters'),
  address: z.string().optional(),
});

export type CreateShopFormData = z.infer<typeof createShopSchema>;
