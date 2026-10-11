import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { Auth0Service } from './auth0.service';
import { DatabaseService } from '../database/database.service';
import { TenantService } from './tenant.service';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;

  const mockUser = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashedPassword',
    role: 'cashier',
    tenantId: 'tenant-1',
    status: 'active',
  };

  const mockUsersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockPrisma = {
    user: {
      update: jest.fn().mockResolvedValue(undefined),
    },
  };

  const mockDatabaseService = {
    getPrisma: jest.fn().mockReturnValue({ prisma: mockPrisma }),
  };

  const mockAuth0Service = {
    validateUser: jest.fn(),
    createUser: jest.fn(),
    getUser: jest.fn(),
    findUserByEmail: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    getUsersByTenant: jest.fn(),
    getConfig: jest.fn(),
  };

  const mockTenantService = {
    provisionStore: jest.fn(),
    ensureTenant: jest.fn(),
    seedAccounts: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: Auth0Service,
          useValue: mockAuth0Service,
        },
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: TenantService,
          useValue: mockTenantService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user from local DB and backfill externalId when Auth0 validates', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      const auth0User = {
        accessToken: 'auth0-access-token',
        idToken: 'auth0-id-token',
        userInfo: {
          sub: 'auth0|123456789',
          email: email,
          name: 'Test User',
        },
      };

      mockAuth0Service.validateUser.mockResolvedValue(auth0User);
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      const result = await service.validateUser(email, password);

      expect(mockAuth0Service.validateUser).toHaveBeenCalledWith(
        email,
        password,
      );
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(email);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { externalId: auth0User.userInfo.sub },
      });
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        tenantId: mockUser.tenantId,
        auth0Id: auth0User.userInfo.sub,
        permissions: expect.any(Array),
      });
    });

    it('should return null when Auth0 validation fails', async () => {
      mockAuth0Service.validateUser.mockResolvedValue(null);

      const result = await service.validateUser(
        'test@example.com',
        'wrongpassword',
      );

      expect(mockAuth0Service.validateUser).toHaveBeenCalledWith(
        'test@example.com',
        'wrongpassword',
      );
      expect(result).toBeNull();
    });

    it('should reject login when Auth0 user has no local DB record', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      const auth0User = {
        accessToken: 'auth0-access-token',
        idToken: 'auth0-id-token',
        userInfo: {
          sub: 'auth0|123456789',
          email: email,
          name: 'Test User',
        },
      };

      mockAuth0Service.validateUser.mockResolvedValue(auth0User);
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(service.validateUser(email, password)).resolves.toBeNull();
      expect(mockUsersService.create).not.toHaveBeenCalled();
    });

    it('should reject login when local user is disabled', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      mockAuth0Service.validateUser.mockResolvedValue({
        accessToken: 't',
        idToken: 't',
        userInfo: { sub: 'auth0|1', email, name: 'Test User' },
      });
      mockUsersService.findByEmail.mockResolvedValue({
        ...mockUser,
        externalId: 'auth0|1',
        status: 'suspended',
      });

      await expect(service.validateUser(email, password)).rejects.toThrow(
        'User account is disabled',
      );
    });
  });

  describe('login', () => {
    it('should return access token and user data', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };
      const user = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'cashier',
        tenantId: 'tenant-1',
      };
      const auth0User = {
        accessToken: 'auth0-access-token',
        idToken: 'auth0-id-token',
        userInfo: {
          sub: 'auth0|123456789',
          email: loginDto.email,
          name: 'Test User',
        },
      };
      const mockToken = 'mock-jwt-token';

      mockAuth0Service.validateUser.mockResolvedValue(auth0User);
      mockUsersService.findByEmail.mockResolvedValue(user);
      mockJwtService.sign.mockReturnValue(mockToken);

      const result = await service.login(loginDto);

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        email: user.email,
        sub: user.id,
        tenantId: user.tenantId,
        role: user.role,
        permissions: expect.any(Array),
      });
      expect(result).toEqual({
        access_token: mockToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          permissions: expect.any(Array),
        },
      });
    });
  });

  describe('register', () => {
    it('should create new user in Auth0 and local database, return access token', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
        role: 'cashier',
        tenantId: 'tenant-1',
      };
      const createdUser = {
        id: '2',
        email: registerDto.email,
        name: registerDto.name,
        role: registerDto.role,
        tenantId: registerDto.tenantId,
      };
      const auth0User = {
        id: 'auth0|123456789',
        email: registerDto.email,
        name: registerDto.name,
        role: registerDto.role,
        tenantId: registerDto.tenantId,
        auth0Id: 'auth0|123456789',
      };
      const mockToken = 'mock-jwt-token';

      mockTenantService.ensureTenant.mockResolvedValue({
        tenantId: 'tenant-1',
        shopId: 'shop-1',
      });
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockAuth0Service.createUser.mockResolvedValue(auth0User);
      mockUsersService.create.mockResolvedValue(createdUser);
      mockJwtService.sign.mockReturnValue(mockToken);

      const result = await service.register(registerDto);

      expect(mockTenantService.ensureTenant).toHaveBeenCalledWith('tenant-1');
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
        registerDto.email,
      );
      expect(mockAuth0Service.createUser).toHaveBeenCalledWith({
        email: registerDto.email,
        password: registerDto.password,
        name: registerDto.name,
        role: registerDto.role,
        tenantId: registerDto.tenantId,
      });
      expect(mockUsersService.create).toHaveBeenCalledWith(
        {
          email: registerDto.email,
          name: registerDto.name,
          password: expect.any(String),
          role: registerDto.role,
          phone: undefined,
          externalId: 'auth0|123456789',
        },
        registerDto.tenantId,
      );
      // Password is mirrored as a bcrypt hash even when Auth0 holds the account
      const createCall = mockUsersService.create.mock.calls[0][0];
      expect(
        await bcrypt.compare(registerDto.password, createCall.password),
      ).toBe(true);
      expect(result).toEqual({
        access_token: mockToken,
        user: {
          id: createdUser.id,
          email: createdUser.email,
          name: createdUser.name,
          role: createdUser.role,
          tenantId: createdUser.tenantId,
          shopId: 'shop-1',
          permissions: expect.any(Array),
        },
      });
    });

    it('should provision a new store when an owner registers without a tenant', async () => {
      const registerDto = {
        email: 'owner@example.com',
        password: 'password123',
        name: 'Owner User',
        storeName: 'Shuvo Mart',
      };
      const createdUser = {
        id: '3',
        email: registerDto.email,
        name: registerDto.name,
        role: 'owner',
        tenantId: 'tenant-new',
      };

      mockTenantService.provisionStore.mockResolvedValue({
        tenantId: 'tenant-new',
        shopId: 'shop-new',
        tenantName: 'Shuvo Mart',
      });
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockAuth0Service.createUser.mockResolvedValue({
        id: 'auth0|owner',
        email: registerDto.email,
        name: registerDto.name,
        role: 'owner',
        tenantId: 'tenant-new',
        auth0Id: 'auth0|owner',
      });
      mockUsersService.create.mockResolvedValue(createdUser);
      mockJwtService.sign.mockReturnValue('mock-token');

      const result = await service.register(registerDto);

      expect(mockTenantService.provisionStore).toHaveBeenCalledWith(
        registerDto.name,
        'Shuvo Mart',
      );
      expect(mockTenantService.ensureTenant).not.toHaveBeenCalled();
      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'owner', externalId: 'auth0|owner' }),
        'tenant-new',
      );
      expect(result.user).toEqual(
        expect.objectContaining({
          tenantId: 'tenant-new',
          shopId: 'shop-new',
          role: 'owner',
        }),
      );
    });

    it('should reject staff registration for an unknown tenant', async () => {
      const registerDto = {
        email: 'cashier@example.com',
        password: 'password123',
        name: 'Cashier',
        role: 'cashier',
        tenantId: 'does-not-exist',
      };

      mockUsersService.findByEmail.mockResolvedValue(null);
      mockTenantService.ensureTenant.mockRejectedValue(
        new Error('Tenant does not exist'),
      );

      await expect(service.register(registerDto)).rejects.toThrow(
        'Unknown tenant does-not-exist',
      );
      expect(mockAuth0Service.createUser).not.toHaveBeenCalled();
    });

    it('should hash password before storing when Auth0 is unavailable', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
        role: 'cashier',
        tenantId: 'tenant-1',
      };
      const createdUser = {
        id: '2',
        email: registerDto.email,
        name: registerDto.name,
        role: registerDto.role,
        tenantId: registerDto.tenantId,
      };

      mockUsersService.findByEmail.mockResolvedValue(null);
      mockTenantService.ensureTenant.mockResolvedValue({
        tenantId: 'tenant-1',
        shopId: 'shop-1',
      });
      // Make Auth0 fail so it falls back to local password hashing
      mockAuth0Service.createUser.mockRejectedValue(
        new Error('Management API not enabled'),
      );
      mockUsersService.create.mockResolvedValue(createdUser);
      mockJwtService.sign.mockReturnValue('mock-token');

      await service.register(registerDto);

      const createCall = mockUsersService.create.mock.calls[0][0];
      expect(createCall.password).not.toBe(registerDto.password);
      expect(
        await bcrypt.compare(registerDto.password, createCall.password),
      ).toBe(true);
    });
  });

  describe('validateToken', () => {
    it('should validate valid token', async () => {
      const validToken = 'valid-jwt-token';
      const decodedPayload = {
        email: 'test@example.com',
        sub: '1',
        tenantId: 'tenant-1',
        role: 'cashier',
      };

      mockJwtService.verify.mockReturnValue(decodedPayload);

      const result = await service.validateToken(validToken);

      expect(mockJwtService.verify).toHaveBeenCalledWith(validToken);
      expect(result).toEqual(decodedPayload);
    });

    it('should throw error for invalid token', async () => {
      const invalidToken = 'invalid-jwt-token';

      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.validateToken(invalidToken)).rejects.toThrow(
        'Invalid token',
      );
    });
  });
});
