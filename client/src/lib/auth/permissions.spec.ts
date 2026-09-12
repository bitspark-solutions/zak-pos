import { hasPermission, hasRole } from './permissions';
import { User } from '@/types/auth';

describe('permissions', () => {
  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'manager',
    tenantId: 'tenant-1',
    permissions: ['products:read', 'products:write'],
  };

  describe('hasPermission', () => {
    it('should return true when user has specific permission', () => {
      expect(hasPermission(mockUser, 'products:read')).toBe(true);
    });

    it('should return false when user lacks permission', () => {
      expect(hasPermission(mockUser, 'users:delete')).toBe(false);
    });

    it('should return false when user is null', () => {
      expect(hasPermission(null, 'products:read')).toBe(false);
    });

    it('should return true when user has wildcard permission', () => {
      const adminUser: User = {
        ...mockUser,
        role: 'admin',
        permissions: ['*'],
      };
      expect(hasPermission(adminUser, 'any:permission')).toBe(true);
    });
  });

  describe('hasRole', () => {
    it('should return true when user role matches', () => {
      expect(hasRole(mockUser, 'manager')).toBe(true);
    });

    it('should return false when user role does not match', () => {
      expect(hasRole(mockUser, 'cashier')).toBe(false);
    });

    it('should return false when user is null', () => {
      expect(hasRole(null, 'manager')).toBe(false);
    });
  });
});
