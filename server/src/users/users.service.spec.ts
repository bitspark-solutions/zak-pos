import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { DatabaseService } from '../database/database.service';
import * as bcrypt from 'bcryptjs';

describe('UsersService', () => {
  let service: UsersService;
  let databaseService: DatabaseService;

  beforeEach(async () => {
    const mockDatabaseService = {
      createUser: jest.fn(),
      findUserByEmail: jest.fn(),
      findUserById: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      findAllUsers: jest.fn(),
    };

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
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      const createUserDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        role: 'cashier',
        tenantId: 'tenant-1',
      };

      const mockUser = {
        id: '123',
        email: createUserDto.email,
        password: createUserDto.password,
        name: createUserDto.name,
        role: createUserDto.role,
        tenantId: createUserDto.tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (databaseService.createUser as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.create(createUserDto);

      expect(databaseService.createUser).toHaveBeenCalledWith({
        email: createUserDto.email,
        password: createUserDto.password,
        name: createUserDto.name,
        role: createUserDto.role,
        tenantId: createUserDto.tenantId,
      });

      expect(result).toMatchObject({
        id: mockUser.id,
        email: createUserDto.email,
        name: createUserDto.name,
        role: createUserDto.role,
        tenantId: createUserDto.tenantId,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('should generate unique IDs for different users', async () => {
      const mockUser1 = {
        id: '123',
        email: 'user1@example.com',
        password: 'password123',
        name: 'User 1',
        role: 'cashier',
        tenantId: 'tenant-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUser2 = {
        id: '456',
        email: 'user2@example.com',
        password: 'password123',
        name: 'User 2',
        role: 'manager',
        tenantId: 'tenant-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (databaseService.createUser as jest.Mock)
        .mockResolvedValueOnce(mockUser1)
        .mockResolvedValueOnce(mockUser2);

      const user1 = await service.create({
        email: 'user1@example.com',
        password: 'password123',
        name: 'User 1',
        role: 'cashier',
        tenantId: 'tenant-1',
      });

      const user2 = await service.create({
        email: 'user2@example.com',
        password: 'password123',
        name: 'User 2',
        role: 'manager',
        tenantId: 'tenant-1',
      });

      expect(user1.id).not.toBe(user2.id);
    });
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        password: 'hashedpassword',
        name: 'Test User',
        role: 'cashier',
        tenantId: 'tenant-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (databaseService.findUserByEmail as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(databaseService.findUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(result).toEqual(mockUser);
    });

    it('should return undefined when user not found', async () => {
      (databaseService.findUserByEmail as jest.Mock).mockResolvedValue(undefined);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(databaseService.findUserByEmail).toHaveBeenCalledWith('nonexistent@example.com');
      expect(result).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        password: 'hashedpassword',
        name: 'Test User',
        role: 'cashier',
        tenantId: 'tenant-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (databaseService.findUserById as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findOne('123');

      expect(databaseService.findUserById).toHaveBeenCalledWith('123');
      expect(result).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        tenantId: mockUser.tenantId,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('should return null when user not found', async () => {
      (databaseService.findUserById as jest.Mock).mockResolvedValue(null);

      const result = await service.findOne('nonexistent-id');

      expect(databaseService.findUserById).toHaveBeenCalledWith('nonexistent-id');
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all users without passwords', async () => {
      const mockUsers = [
        {
          id: '1',
          email: 'user1@example.com',
          name: 'User 1',
          role: 'cashier',
          tenantId: 'tenant-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          email: 'user2@example.com',
          name: 'User 2',
          role: 'manager',
          tenantId: 'tenant-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (databaseService.findAllUsers as jest.Mock).mockResolvedValue(mockUsers);

      const result = await service.findAll();

      expect(databaseService.findAllUsers).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
      expect(result.length).toBe(2);
      
      // Ensure no passwords are returned
      result.forEach(user => {
        expect(user).not.toHaveProperty('password');
      });
    });
  });

  describe('update', () => {
    it('should update user data', async () => {
      const updateData = {
        name: 'Updated Name',
        role: 'manager',
      };

      const mockUpdatedUser = {
        id: '123',
        email: 'test@example.com',
        password: 'hashedpassword',
        name: updateData.name,
        role: updateData.role,
        tenantId: 'tenant-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (databaseService.updateUser as jest.Mock).mockResolvedValue(mockUpdatedUser);

      const result = await service.update('123', updateData);

      expect(databaseService.updateUser).toHaveBeenCalledWith('123', updateData);
      expect(result).toMatchObject({
        id: mockUpdatedUser.id,
        email: mockUpdatedUser.email,
        name: updateData.name,
        role: updateData.role,
        tenantId: mockUpdatedUser.tenantId,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('should return null when user not found', async () => {
      (databaseService.updateUser as jest.Mock).mockResolvedValue(null);

      const result = await service.update('nonexistent-id', { name: 'New Name' });

      expect(databaseService.updateUser).toHaveBeenCalledWith('nonexistent-id', { name: 'New Name' });
      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should remove user', async () => {
      const mockDeletedUser = {
        id: '123',
        email: 'test@example.com',
        password: 'hashedpassword',
        name: 'Test User',
        role: 'cashier',
        tenantId: 'tenant-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (databaseService.deleteUser as jest.Mock).mockResolvedValue(mockDeletedUser);

      const result = await service.remove('123');

      expect(databaseService.deleteUser).toHaveBeenCalledWith('123');
      expect(result).toMatchObject({
        id: mockDeletedUser.id,
        email: mockDeletedUser.email,
        name: mockDeletedUser.name,
        role: mockDeletedUser.role,
        tenantId: mockDeletedUser.tenantId,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('should return null when user not found', async () => {
      (databaseService.deleteUser as jest.Mock).mockResolvedValue(null);

      const result = await service.remove('nonexistent-id');

      expect(databaseService.deleteUser).toHaveBeenCalledWith('nonexistent-id');
      expect(result).toBeNull();
    });
  });
});
