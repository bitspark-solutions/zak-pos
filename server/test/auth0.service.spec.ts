import { Test, TestingModule } from '@nestjs/testing';
import { Auth0Service } from '../src/auth/auth0.service';

describe('Auth0Service', () => {
  let service: Auth0Service;

  // getManagementApiToken throws when the machine-to-machine client is not
  // configured, and every Management API method surfaces that error.
  const notConfigured = /Auth0 Management API client not configured/;

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
      const result = await service.validateUser(
        'invalid@example.com',
        'wrongpassword',
      );
      expect(result).toBeNull();
    });
  });

  describe('Management API (unconfigured)', () => {
    it('createUser wraps the configuration error', async () => {
      await expect(
        service.createUser({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          role: 'cashier',
          tenantId: 'tenant-1',
        }),
      ).rejects.toThrow('Failed to create user in Auth0');
    });

    it('getUser rejects when not configured', async () => {
      await expect(service.getUser('non-existent-id')).rejects.toThrow(
        notConfigured,
      );
    });

    it('findUserByEmail rejects when not configured', async () => {
      await expect(service.findUserByEmail('test@example.com')).rejects.toThrow(
        notConfigured,
      );
    });

    it('updateUser rejects when not configured', async () => {
      await expect(
        service.updateUser('user-id', { name: 'Updated Name' }),
      ).rejects.toThrow(notConfigured);
    });

    it('deleteUser rejects when not configured', async () => {
      await expect(service.deleteUser('user-id')).rejects.toThrow(
        notConfigured,
      );
    });

    it('getUsersByTenant rejects when not configured', async () => {
      await expect(
        service.getUsersByTenant('non-existent-tenant'),
      ).rejects.toThrow(notConfigured);
    });
  });
});
