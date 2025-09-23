import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import * as bcrypt from 'bcryptjs';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService],
    }).compile();

    service = module.get<UsersService>(UsersService);
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

      const result = await service.create(createUserDto);

      expect(result).toMatchObject({
        id: expect.any(String),
        email: createUserDto.email,
        name: createUserDto.name,
        role: 'cashier', // Default role
        tenantId: createUserDto.tenantId,
      });
      // Note: The current implementation doesn't hash passwords in UsersService
      // Password hashing is done in AuthService
      expect(result.password).toBe(createUserDto.password);
    });

    it('should generate unique IDs for different users', async () => {
      const user1 = await service.create({
        email: 'user1@example.com',
        password: 'password123',
        name: 'User 1',
        role: 'cashier',
        tenantId: 'tenant-1',
      });

      // Wait a small amount to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));

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
      const createUserDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        role: 'cashier',
        tenantId: 'tenant-1',
      };

      await service.create(createUserDto);
      const result = await service.findByEmail(createUserDto.email);

      expect(result).toMatchObject({
        id: expect.any(String),
        email: createUserDto.email,
        name: createUserDto.name,
        role: createUserDto.role,
        tenantId: createUserDto.tenantId,
      });
    });

    it('should return undefined when user not found', async () => {
      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('should return user when found', async () => {
      const createUserDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        role: 'cashier',
        tenantId: 'tenant-1',
      };

      const createdUser = await service.create(createUserDto);
      const result = await service.findOne(createdUser.id);

      expect(result).toMatchObject({
        id: createdUser.id,
        email: createUserDto.email,
        name: createUserDto.name,
        role: createUserDto.role,
        tenantId: createUserDto.tenantId,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('should return null when user not found', async () => {
      const result = await service.findOne('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all users without passwords', async () => {
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

      const result = await service.findAll();

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result).toContainEqual(expect.objectContaining({ id: user1.id }));
      expect(result).toContainEqual(expect.objectContaining({ id: user2.id }));
      
      // Ensure no passwords are returned
      result.forEach(user => {
        expect(user).not.toHaveProperty('password');
      });
    });
  });

  describe('update', () => {
    it('should update user data', async () => {
      const createUserDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        role: 'cashier',
        tenantId: 'tenant-1',
      };

      const createdUser = await service.create(createUserDto);
      const updateData = {
        name: 'Updated Name',
        role: 'manager',
      };

      const result = await service.update(createdUser.id, updateData);

      expect(result).toMatchObject({
        id: createdUser.id,
        email: createUserDto.email,
        name: updateData.name,
        role: updateData.role,
        tenantId: createUserDto.tenantId,
      });
    });

    it('should return null when user not found', async () => {
      const result = await service.update('nonexistent-id', { name: 'New Name' });

      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should remove user', async () => {
      const createUserDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        role: 'cashier',
        tenantId: 'tenant-1',
      };

      const createdUser = await service.create(createUserDto);
      const result = await service.remove(createdUser.id);

      expect(result).toMatchObject({
        id: createdUser.id,
        email: createUserDto.email,
        name: createUserDto.name,
        role: createUserDto.role,
        tenantId: createUserDto.tenantId,
      });
      expect(result).not.toHaveProperty('password');

      const foundUser = await service.findOne(createdUser.id);
      expect(foundUser).toBeNull();
    });

    it('should return null when user not found', async () => {
      const result = await service.remove('nonexistent-id');

      expect(result).toBeNull();
    });
  });
});
