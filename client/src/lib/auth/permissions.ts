import { User } from '@/types/auth';

export function hasPermission(user: User | null, permission: string): boolean {
  if (!user || !user.permissions) return false;
  return user.permissions.includes(permission) || user.permissions.includes('*');
}

export function hasRole(user: User | null, role: string): boolean {
  if (!user) return false;
  return user.role === role;
}
