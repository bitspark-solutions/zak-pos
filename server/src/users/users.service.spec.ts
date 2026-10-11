import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { DatabaseService } from '../database/database.service';

describe('UsersService', () => {
  let service: UsersService;

  const mockUser = {
    id: '123',
    email: 'test@example.com',
    password: 'hashedpassword',
    name: 'Test User',
    role: 'cashier',
    tenantId: 'tenant-1',
    status: 'active',
    locale: 'en',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrisma = {
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockDatabaseService = {
    // admin-path dependencies
    createUser: jest.fn(),
    findUserByEmail: jest.fn(),
    findAllUsers: jest.fn(),
    // tenant-path (RLS) dependency
    withTenant: jest.fn((tenantId: string, fn: any) => fn(mockPrisma)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDatabaseService.withTenant.mockImplementation((tenantId: string, fn: any) => fn(mockPrisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('create (admin path — registration)', () => {
    it('should delegate to the admin DatabaseService.createUser', async () => {
      const createUserDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        role: 'cashier',
      };

      mockDatabaseService.createUser.mockResolvedValue({ ...mockUser, ...createUserDto });

      const result = await service.create(createUserDto, 'tenant-1');

      expect(mockDatabaseService.createUser).toHaveBeenCalledWith({
        email: createUserDto.email,
        password: createUserDto.password,
        name: createUserDto.name,
        role: createUserDto.role,
        tenantId: 'tenant-1',
      });
      expect(mockDatabaseService.withTenant).not.toHaveBeenCalled();

      expect(result).toMatchObject({
        id: mockUser.id,
        email: createUserDto.email,
        tenantId: 'tenant-1',
      });
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('createForTenant (tenant path — staff admin)', () => {
    it('should create the user through withTenant with the tenant id', async () => {
      const createUserDto = {
        email: 'staff@example.com',
        password: 'password123',
        name: 'Staff User',
        role: 'cashier',
      };

      mockPrisma.user.create.mockResolvedValue({ ...mockUser, ...createUserDto });

      const result = await service.createForTenant(createUserDto as any, 'tenant-1');

      expect(mockDatabaseService.withTenant).toHaveBeenCalledWith('tenant-1', expect.any(Function));
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: createUserDto.email,
          password: createUserDto.password,
          name: createUserDto.name,
          phone: undefined,
          role: 'cashier',
          tenantId: 'tenant-1',
          externalId: undefined,
          status: 'active',
          locale: 'en',
        },
      });
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('findAll (tenant path)', () => {
    it('should list only tenant users, without passwords', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await service.findAll('tenant-1');

      expect(mockDatabaseService.withTenant).toHaveBeenCalledWith('tenant-1', expect.any(Function));
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1' } });
      expect(result.length).toBe(1);
      result.forEach((user) => {
        expect(user).not.toHaveProperty('password');
      });
    });
  });

  describe('findOne (tenant path)', () => {
    it('should return user found within the tenant scope', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.findOne('123', 'tenant-1');

      expect(mockDatabaseService.withTenant).toHaveBeenCalledWith('tenant-1', expect.any(Function));
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: '123', tenantId: 'tenant-1' },
      });
      expect(result).toMatchObject({ id: mockUser.id, tenantId: 'tenant-1' });
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundException when RLS hides the user (other tenant)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.findOne('123', 'tenant-2')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id', 'tenant-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update (tenant path)', () => {
    it('should update user inside the tenant scope', async () => {
      const updateData = { name: 'Updated Name', role: 'manager' };
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, ...updateData });

      const result = await service.update('123', updateData, 'tenant-1');

      expect(mockDatabaseService.withTenant).toHaveBeenCalledWith('tenant-1', expect.any(Function));
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: '123', tenantId: 'tenant-1' },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({ where: { id: '123' }, data: updateData });
      expect(result).not.toHaveProperty('password');
    });

    it('should throw and not update when user is in another tenant', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.update('123', { name: 'New Name' }, 'tenant-2'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('remove (tenant path)', () => {
    it('should delete user inside the tenant scope', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.user.delete.mockResolvedValue(mockUser);

      const result = await service.remove('123', 'tenant-1');

      expect(mockDatabaseService.withTenant).toHaveBeenCalledWith('tenant-1', expect.any(Function));
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: '123', tenantId: 'tenant-1' },
      });
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: '123' } });
      expect(result).not.toHaveProperty('password');
    });

    it('should throw and not delete when user is in another tenant', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.remove('123', 'tenant-2')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });
  });

  describe('count (admin path)', () => {
    it('should count across tenants via admin client for registration bootstrap', async () => {
      mockDatabaseService.findAllUsers.mockResolvedValue([mockUser]);

      const result = await service.count();

      expect(mockDatabaseService.findAllUsers).toHaveBeenCalled();
      expect(result).toBe(1);
    });
  });
});
