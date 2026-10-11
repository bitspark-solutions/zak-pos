import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TenantSettingsService } from './tenant-settings.service';
import { DatabaseService } from '../database/database.service';

describe('TenantSettingsService', () => {
  let service: TenantSettingsService;

  const sampleTenant = {
    id: 'tenant-1',
    name: 'Acme POS',
    plan: 'basic',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrisma = {
    tenant: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockDatabaseService = {
    withTenant: jest.fn((tenantId: string, fn: any) => fn(mockPrisma)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDatabaseService.withTenant.mockImplementation(
      (tenantId: string, fn: any) => fn(mockPrisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantSettingsService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<TenantSettingsService>(TenantSettingsService);
  });

  describe('getCurrent', () => {
    it('should return the tenant profile for the current tenant', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(sampleTenant);

      const result = await service.getCurrent('tenant-1');

      expect(result.id).toBe('tenant-1');
      expect(result.name).toBe('Acme POS');
      expect(mockDatabaseService.withTenant).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(Function),
      );
      expect(mockPrisma.tenant.findFirst).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
      });
    });

    it('should throw NotFoundException when the tenant row is missing', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);

      await expect(service.getCurrent('tenant-x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateCurrent', () => {
    it('should update the tenant name after scoping to the tenant', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(sampleTenant);
      mockPrisma.tenant.update.mockResolvedValue({
        ...sampleTenant,
        name: 'Acme Retail',
      });

      const result = await service.updateCurrent('tenant-1', {
        name: 'Acme Retail',
      });

      expect(result.name).toBe('Acme Retail');
      expect(mockPrisma.tenant.findFirst).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
      });
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: { name: 'Acme Retail' },
      });
    });

    it('should throw NotFoundException when the tenant row is missing', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCurrent('tenant-x', { name: 'Nope' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
    });
  });
});
