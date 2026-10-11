import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ShopsService } from './shops.service';
import { DatabaseService } from '../database/database.service';

describe('ShopsService', () => {
  let service: ShopsService;

  const sampleShop = {
    id: 's1',
    tenantId: 'tenant-1',
    name: 'Main Store',
    address: '123 High St',
    timeZone: 'Asia/Dhaka',
    taxProfileId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrisma = {
    shop: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    inventory: { count: jest.fn() },
    purchase: { count: jest.fn() },
    sale: { count: jest.fn() },
    cashSession: { count: jest.fn() },
    invoice: { count: jest.fn() },
  };

  const mockDatabaseService = {
    getPrisma: jest.fn().mockReturnValue({ prisma: mockPrisma }),
    withTenant: jest.fn((tenantId: string, fn: any) => fn(mockPrisma)),
  };

  const resetReferenceCounts = (value = 0): void => {
    mockPrisma.inventory.count.mockResolvedValue(value);
    mockPrisma.purchase.count.mockResolvedValue(value);
    mockPrisma.sale.count.mockResolvedValue(value);
    mockPrisma.cashSession.count.mockResolvedValue(value);
    mockPrisma.invoice.count.mockResolvedValue(value);
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDatabaseService.withTenant.mockImplementation(
      (tenantId: string, fn: any) => fn(mockPrisma),
    );
    resetReferenceCounts(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopsService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<ShopsService>(ShopsService);
  });

  describe('create', () => {
    it('should create a shop scoped to the tenant', async () => {
      mockPrisma.shop.create.mockResolvedValue(sampleShop);

      const result = await service.create(
        { name: 'Main Store', address: '123 High St' },
        'tenant-1',
      );

      expect(result.id).toBe('s1');
      expect(mockDatabaseService.withTenant).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(Function),
      );
      expect(mockPrisma.shop.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          name: 'Main Store',
          address: '123 High St',
          timeZone: undefined,
          taxProfileId: undefined,
        },
      });
    });
  });

  describe('findAll', () => {
    it('should return a paginated-shaped wrapper with the tenant shops', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([sampleShop]);

      const result = await service.findAll('tenant-1');

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(mockPrisma.shop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-1' }),
        }),
      );
    });

    it('should add a name filter when searching', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([]);

      await service.findAll('tenant-1', 'Main');

      expect(mockPrisma.shop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            name: { contains: 'Main', mode: 'insensitive' },
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return the shop by id', async () => {
      mockPrisma.shop.findFirst.mockResolvedValue(sampleShop);

      const result = await service.findOne('s1', 'tenant-1');

      expect(result.id).toBe('s1');
      expect(mockPrisma.shop.findFirst).toHaveBeenCalledWith({
        where: { id: 's1', tenantId: 'tenant-1' },
      });
    });

    it('should throw NotFoundException for a foreign/missing id', async () => {
      mockPrisma.shop.findFirst.mockResolvedValue(null);

      await expect(service.findOne('s999', 'tenant-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update the shop after scoping by tenant', async () => {
      mockPrisma.shop.findFirst.mockResolvedValue(sampleShop);
      mockPrisma.shop.update.mockResolvedValue({
        ...sampleShop,
        name: 'Renamed Store',
      });

      const result = await service.update(
        's1',
        { name: 'Renamed Store' },
        'tenant-1',
      );

      expect(result.name).toBe('Renamed Store');
      expect(mockPrisma.shop.findFirst).toHaveBeenCalledWith({
        where: { id: 's1', tenantId: 'tenant-1' },
      });
      expect(mockPrisma.shop.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { name: 'Renamed Store' },
      });
    });

    it('should throw NotFoundException when shop does not belong to tenant', async () => {
      mockPrisma.shop.findFirst.mockResolvedValue(null);

      await expect(
        service.update('s999', { name: 'Nope' }, 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.shop.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete the shop when it has no references', async () => {
      mockPrisma.shop.findFirst.mockResolvedValue(sampleShop);
      resetReferenceCounts(0);
      mockPrisma.shop.delete.mockResolvedValue(sampleShop);

      const result = await service.remove('s1', 'tenant-1');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.shop.delete).toHaveBeenCalledWith({
        where: { id: 's1' },
      });
    });

    it('should refuse deletion with BadRequest when the shop is referenced', async () => {
      mockPrisma.shop.findFirst.mockResolvedValue(sampleShop);
      resetReferenceCounts(0);
      mockPrisma.sale.count.mockResolvedValue(3);

      await expect(service.remove('s1', 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.shop.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when shop is not owned by tenant', async () => {
      mockPrisma.shop.findFirst.mockResolvedValue(null);

      await expect(service.remove('s999', 'tenant-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.shop.delete).not.toHaveBeenCalled();
    });
  });
});
