import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { Auth0Service } from './auth0.service';
import { DatabaseService } from '../database/database.service';
import { TenantService } from './tenant.service';
import { SessionService } from './session.service';
import { RedisService } from '../redis/redis.service';
import { InvitationsService } from '../invitations/invitations.service';
import type { InvitationRecord } from '../invitations/interfaces/invitation.interface';
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
      findUnique: jest.fn(),
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

  const mockSessionService = {
    getActiveSessionsByUser: jest.fn().mockResolvedValue([]),
    revokeSession: jest.fn().mockResolvedValue(true),
  };

  const mockRedisService = {
    getJson: jest.fn(),
    setJson: jest.fn().mockResolvedValue(undefined),
    ttl: jest.fn().mockResolvedValue(1500),
    del: jest.fn().mockResolvedValue(undefined),
  };

  const mockInvitationsService = {
    findValid: jest.fn(),
    consume: jest.fn().mockResolvedValue(undefined),
    verify: jest.fn(),
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
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: InvitationsService,
          useValue: mockInvitationsService,
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

    it('should ignore invitation-less registrations without touching InvitationsService', async () => {
      const registerDto = {
        email: 'plain@example.com',
        password: 'password123',
        name: 'Plain User',
      };

      mockUsersService.findByEmail.mockResolvedValue(null);
      mockTenantService.provisionStore.mockResolvedValue({
        tenantId: 'tenant-new',
        shopId: 'shop-new',
        tenantName: 'Plain Store',
      });
      mockAuth0Service.createUser.mockResolvedValue({
        auth0Id: 'auth0|plain',
      });
      mockUsersService.create.mockResolvedValue({
        id: '9',
        email: registerDto.email,
        name: registerDto.name,
        role: 'owner',
        tenantId: 'tenant-new',
      });
      mockJwtService.sign.mockReturnValue('mock-token');

      await service.register(registerDto);

      expect(mockInvitationsService.findValid).not.toHaveBeenCalled();
      expect(mockInvitationsService.consume).not.toHaveBeenCalled();
    });
  });

  describe('register with an invitation token', () => {
    const invitation: InvitationRecord = {
      token: 'a'.repeat(32),
      tenantId: 'tenant-9',
      tenantName: 'Acme Mart',
      email: 'invited@example.com',
      role: 'manager',
      shopId: 'shop-9',
      invitedBy: 'user-1',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    };

    const baseDto = {
      email: 'invited@example.com',
      password: 'password123',
      name: 'Invited Manager',
      inviteToken: invitation.token,
    };

    function stubSuccessfulCreation() {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockTenantService.ensureTenant.mockResolvedValue({
        tenantId: 'tenant-9',
        shopId: 'shop-ensured',
      });
      mockAuth0Service.createUser.mockResolvedValue({
        auth0Id: 'auth0|invited',
      });
      mockUsersService.create.mockResolvedValue({
        id: '10',
        email: baseDto.email,
        name: baseDto.name,
        role: invitation.role,
        tenantId: 'tenant-9',
      });
      mockJwtService.sign.mockReturnValue('mock-token');
    }

    it('joins the inviter tenant with the invitation role and consumes the token', async () => {
      mockInvitationsService.findValid.mockResolvedValue(invitation);
      stubSuccessfulCreation();

      // role in the body must NOT win over the invitation's role
      const result = await service.register({ ...baseDto, role: 'cashier' });

      expect(mockInvitationsService.findValid).toHaveBeenCalledWith(
        invitation.token,
      );
      expect(mockTenantService.provisionStore).not.toHaveBeenCalled();
      expect(mockTenantService.ensureTenant).toHaveBeenCalledWith('tenant-9');
      expect(mockAuth0Service.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: baseDto.email,
          role: 'manager',
          tenantId: 'tenant-9',
        }),
      );
      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'manager' }),
        'tenant-9',
      );
      const createCall = mockUsersService.create.mock.calls[0][0];
      expect(await bcrypt.compare(baseDto.password, createCall.password)).toBe(
        true,
      );
      expect(mockInvitationsService.consume).toHaveBeenCalledWith(
        invitation.token,
      );
      expect(result.user).toEqual(
        expect.objectContaining({
          role: 'manager',
          tenantId: 'tenant-9',
          shopId: 'shop-9',
        }),
      );
    });

    it('falls back to the ensured shop when the invitation carries none', async () => {
      mockInvitationsService.findValid.mockResolvedValue({
        ...invitation,
        shopId: null,
      });
      stubSuccessfulCreation();

      const result = await service.register(baseDto);

      expect(result.user.shopId).toBe('shop-ensured');
    });

    it('rejects when the register email does not match the invitation email', async () => {
      mockInvitationsService.findValid.mockResolvedValue(invitation);

      await expect(
        service.register({
          ...baseDto,
          email: 'someone-else@example.com',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockUsersService.create).not.toHaveBeenCalled();
      expect(mockAuth0Service.createUser).not.toHaveBeenCalled();
      expect(mockInvitationsService.consume).not.toHaveBeenCalled();
    });

    it('accepts an email that differs only by case', async () => {
      mockInvitationsService.findValid.mockResolvedValue(invitation);
      stubSuccessfulCreation();

      await service.register({
        ...baseDto,
        email: 'Invited@Example.COM',
      });

      expect(mockUsersService.create).toHaveBeenCalled();
      expect(mockInvitationsService.consume).toHaveBeenCalled();
    });

    it('rejects an invalid/expired token instead of falling back to self-provisioning', async () => {
      mockInvitationsService.findValid.mockResolvedValue(null);

      await expect(service.register(baseDto)).rejects.toThrow(
        'Invalid or expired invitation token',
      );

      expect(mockTenantService.provisionStore).not.toHaveBeenCalled();
      expect(mockTenantService.ensureTenant).not.toHaveBeenCalled();
      expect(mockUsersService.create).not.toHaveBeenCalled();
      expect(mockAuth0Service.createUser).not.toHaveBeenCalled();
    });

    it('rejects when the invitation tenant no longer exists and does not consume the token', async () => {
      mockInvitationsService.findValid.mockResolvedValue(invitation);
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockTenantService.ensureTenant.mockRejectedValue(
        new Error('Tenant tenant-9 does not exist'),
      );

      await expect(service.register(baseDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockInvitationsService.consume).not.toHaveBeenCalled();
      expect(mockUsersService.create).not.toHaveBeenCalled();
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

  describe('changePassword', () => {
    const currentPassword = 'current-pass-1';
    let storedHash: string;

    beforeEach(async () => {
      storedHash = await bcrypt.hash(currentPassword, 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: storedHash,
        externalId: 'auth0|123456789',
      });
      mockPrisma.user.update.mockResolvedValue(undefined);
      mockAuth0Service.updateUser.mockResolvedValue(null);
      mockSessionService.getActiveSessionsByUser.mockResolvedValue([]);
    });

    it('should throw UnauthorizedException when current password is wrong', async () => {
      await expect(
        service.changePassword(
          '1',
          { currentPassword: 'totally-wrong', newPassword: 'brand-new-1' },
          'bearer-token',
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockAuth0Service.updateUser).not.toHaveBeenCalled();
    });

    it('should throw when the row has no usable local hash (Auth0-managed only)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: 'auth0-managed',
        externalId: 'auth0|123456789',
      });

      await expect(
        service.changePassword(
          '1',
          { currentPassword, newPassword: 'brand-new-1' },
          'bearer-token',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should update DB bcrypt hash and Auth0 user when externalId exists', async () => {
      const result = await service.changePassword(
        '1',
        { currentPassword, newPassword: 'brand-new-1' },
        'bearer-token',
      );

      expect(result).toEqual({
        message: 'Password changed successfully',
        auth0Synced: true,
      });
      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: '1' });
      expect(
        await bcrypt.compare('brand-new-1', updateCall.data.password),
      ).toBe(true);
      expect(mockAuth0Service.updateUser).toHaveBeenCalledWith(
        'auth0|123456789',
        {
          password: 'brand-new-1',
        },
      );
    });

    it('should skip Auth0 for local-only users', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: storedHash,
        externalId: null,
      });

      const result = await service.changePassword(
        '1',
        { currentPassword, newPassword: 'brand-new-1' },
        'bearer-token',
      );

      expect(result.auth0Synced).toBe(true);
      expect(mockAuth0Service.updateUser).not.toHaveBeenCalled();
    });

    it('should report auth0Synced=false instead of throwing when Auth0 mirror fails', async () => {
      mockAuth0Service.updateUser.mockRejectedValue(
        new Error('management token expired'),
      );

      const result = await service.changePassword(
        '1',
        { currentPassword, newPassword: 'brand-new-1' },
        'bearer-token',
      );

      expect(result).toEqual({
        message: 'Password changed successfully',
        auth0Synced: false,
        auth0SyncError: 'management token expired',
      });
      // DB write still happened
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('should throw when the DB update fails and never touch Auth0', async () => {
      mockPrisma.user.update.mockRejectedValueOnce(new Error('db down'));

      await expect(
        service.changePassword(
          '1',
          { currentPassword, newPassword: 'brand-new-1' },
          'bearer-token',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockAuth0Service.updateUser).not.toHaveBeenCalled();
    });

    it('should revoke other sessions but keep the current one', async () => {
      mockSessionService.getActiveSessionsByUser.mockResolvedValue([
        { id: 'sess-current', token: 'bearer-token' },
        { id: 'sess-other', token: 'stale-token' },
      ]);

      await service.changePassword(
        '1',
        { currentPassword, newPassword: 'brand-new-1' },
        'bearer-token',
      );

      expect(mockSessionService.getActiveSessionsByUser).toHaveBeenCalledWith(
        '1',
      );
      expect(mockSessionService.revokeSession).toHaveBeenCalledWith(
        'sess-other',
      );
      expect(mockSessionService.revokeSession).not.toHaveBeenCalledWith(
        'sess-current',
      );
    });

    it('should not fail the request when session lookup blows up', async () => {
      mockSessionService.getActiveSessionsByUser.mockRejectedValue(
        new Error('redis offline'),
      );

      await expect(
        service.changePassword(
          '1',
          { currentPassword, newPassword: 'brand-new-1' },
          'bearer-token',
        ),
      ).resolves.toMatchObject({ auth0Synced: true });
    });
  });

  describe('forgotPassword', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should return the generic message and store nothing for unknown emails', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: 'ghost@example.com',
      });

      expect(result).toEqual({
        message:
          'If an account exists for this email, a password reset code has been sent.',
      });
      expect(result.devCode).toBeUndefined();
      expect(mockRedisService.setJson).not.toHaveBeenCalled();
    });

    it('should store a hashed 6-digit code with 30min TTL and echo devCode only in development', async () => {
      process.env.NODE_ENV = 'development';
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      const result = await service.forgotPassword({
        email: 'test@example.com',
      });

      expect(result.devCode).toMatch(/^\d{6}$/);
      expect(mockRedisService.setJson).toHaveBeenCalledWith(
        'pwdreset:test@example.com',
        expect.objectContaining({ attempts: 0 }),
        30 * 60,
      );
      const stored = mockRedisService.setJson.mock.calls[0][1] as {
        codeHash: string;
      };
      expect(
        await bcrypt.compare(result.devCode as string, stored.codeHash),
      ).toBe(true);
    });

    it('should not leak devCode outside development', async () => {
      process.env.NODE_ENV = 'production';
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      const result = await service.forgotPassword({
        email: 'test@example.com',
      });

      expect(result.devCode).toBeUndefined();
      expect(mockRedisService.setJson).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const validCode = '246810';
    let codeHash: string;

    beforeEach(async () => {
      codeHash = await bcrypt.hash(validCode, 10);
      mockUsersService.findByEmail.mockResolvedValue({
        ...mockUser,
        externalId: 'auth0|123456789',
      });
      mockPrisma.user.update.mockResolvedValue(undefined);
      mockAuth0Service.updateUser.mockResolvedValue(null);
    });

    it('should throw BadRequestException when no reset record exists', async () => {
      mockRedisService.getJson.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          email: 'test@example.com',
          code: validCode,
          newPassword: 'brand-new-1',
        }),
      ).rejects.toThrow('Invalid or expired reset code');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should increment attempts and throw on a wrong code', async () => {
      mockRedisService.getJson.mockResolvedValue({ codeHash, attempts: 0 });
      mockRedisService.ttl.mockResolvedValue(1234);

      await expect(
        service.resetPassword({
          email: 'test@example.com',
          code: '000000',
          newPassword: 'brand-new-1',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRedisService.setJson).toHaveBeenCalledWith(
        'pwdreset:test@example.com',
        { codeHash, attempts: 1 },
        1234,
      );
      expect(mockRedisService.del).not.toHaveBeenCalled();
    });

    it('should delete the record after the 5th failed attempt', async () => {
      mockRedisService.getJson.mockResolvedValue({ codeHash, attempts: 4 });

      await expect(
        service.resetPassword({
          email: 'test@example.com',
          code: '000000',
          newPassword: 'brand-new-1',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRedisService.del).toHaveBeenCalledWith(
        'pwdreset:test@example.com',
      );
      expect(mockRedisService.setJson).not.toHaveBeenCalled();
    });

    it('should update DB + Auth0 and delete the reset key on success', async () => {
      mockRedisService.getJson.mockResolvedValue({ codeHash, attempts: 1 });

      const result = await service.resetPassword({
        email: 'test@example.com',
        code: validCode,
        newPassword: 'brand-new-1',
      });

      expect(result).toEqual({
        message: 'Password reset successfully',
        auth0Synced: true,
      });
      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: mockUser.id });
      expect(
        await bcrypt.compare('brand-new-1', updateCall.data.password),
      ).toBe(true);
      expect(mockAuth0Service.updateUser).toHaveBeenCalledWith(
        'auth0|123456789',
        {
          password: 'brand-new-1',
        },
      );
      expect(mockRedisService.del).toHaveBeenCalledWith(
        'pwdreset:test@example.com',
      );
    });

    it('should report auth0Synced=false when the Auth0 mirror fails after DB update', async () => {
      mockRedisService.getJson.mockResolvedValue({ codeHash, attempts: 0 });
      mockAuth0Service.updateUser.mockRejectedValue(new Error('auth0 403'));

      const result = await service.resetPassword({
        email: 'test@example.com',
        code: validCode,
        newPassword: 'brand-new-1',
      });

      expect(result).toEqual({
        message: 'Password reset successfully',
        auth0Synced: false,
        auth0SyncError: 'auth0 403',
      });
      expect(mockRedisService.del).toHaveBeenCalled();
    });
  });
});
