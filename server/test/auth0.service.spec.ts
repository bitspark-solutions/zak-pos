import { Test, TestingModule } from '@nestjs/testing';
import { Auth0Service } from '../src/auth/auth0.service';

describe('Auth0Service', () => {
  let service: Auth0Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Auth0Service],
    }).compile();

    service = module.get<Auth0Service>(Auth0Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return null for invalid credentials', async () => {
      const result = await service.validateUser('invalid@example.com', 'wrongpassword');
      expect(result).toBeNull();
    });

    it('should handle Auth0 API errors gracefully', async () => {
      const result = await service.validateUser('test@example.com', 'password');
      expect(result).toBeNull();
    });
  });

  describe('createUser', () => {
    it('should handle Auth0 API errors gracefully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        role: 'cashier',
        tenantId: 'tenant-1'
      };

      try {
        await service.createUser(userData);
      } catch (error) {
        expect(error.message).toContain('Failed to create user in Auth0');
      }
    });
  });

  describe('getUser', () => {
    it('should return null for non-existent user', async () => {
      const result = await service.getUser('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should handle Auth0 API errors gracefully', async () => {
      const result = await service.updateUser('user-id', { name: 'Updated Name' });
      expect(result).toBeNull();
    });
  });

  describe('deleteUser', () => {
    it('should handle Auth0 API errors gracefully', async () => {
      const result = await service.deleteUser('user-id');
      expect(result).toBe(true);
    });
  });

  describe('getUsersByTenant', () => {
    it('should return empty array for non-existent tenant', async () => {
      const result = await service.getUsersByTenant('non-existent-tenant');
      expect(result).toEqual([]);
    });
  });

  describe('assignRoleToUser', () => {
    it('should handle Auth0 API errors gracefully', async () => {
      const result = await service.assignRoleToUser('user-id', 'role-id');
      expect(result).toBe(true);
    });
  });

  describe('createRole', () => {
    it('should handle Auth0 API errors gracefully', async () => {
      const roleData = {
        name: 'test-role',
        description: 'Test role',
        permissions: ['read:users']
      };

      const result = await service.createRole(roleData);
      expect(result).toBeNull();
    });
  });

  describe('getRoles', () => {
    it('should return empty array when Auth0 is not configured', async () => {
      const result = await service.getRoles();
      expect(result).toEqual([]);
    });
  });
});
