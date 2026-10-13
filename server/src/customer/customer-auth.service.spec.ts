// auth0Config snapshots process.env at import time; the social-login specs
// need a configured tenant, so mock the config module BEFORE the service loads.
jest.mock('../auth/auth0.config', () => ({
  auth0Config: {
    domain: 'test.us.auth0.com',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CustomerAuthService } from './customer-auth.service';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { Auth0Service } from '../auth/auth0.service';
import { CUSTOMER_OTP_PROVIDER } from './otp/customer-otp-provider.interface';

describe('CustomerAuthService', () => {
  let service: CustomerAuthService;

  const mockPrisma = {
    customerAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockDatabaseService = {
    getPrisma: jest.fn().mockReturnValue({ prisma: mockPrisma }),
    withTenant: jest.fn((tenantId: string, fn: (tx: unknown) => unknown) =>
      fn(mockPrisma),
    ),
  };

  // In-memory stand-in for the RedisService API used by OTP storage.
  const redisStore = new Map<string, { value: unknown; ttl?: number }>();
  const mockRedis = {
    getJson: jest.fn(async (key: string) =>
      key.startsWith('custotp:') && redisStore.has(key)
        ? (redisStore.get(key) as { value: unknown }).value
        : null,
    ),
    setJson: jest.fn(
      async (key: string, value: unknown, ttlSeconds?: number) => {
        redisStore.set(key, { value, ttl: ttlSeconds });
      },
    ),
    ttl: jest.fn(async (key: string) => (redisStore.has(key) ? 300 : -2)),
    del: jest.fn(async (key: string) => {
      redisStore.delete(key);
    }),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('customer.jwt.token'),
  };
  const mockAuth0Service = { getUserInfo: jest.fn() };
  const mockOtpProvider = {
    name: 'mock',
    sendOtp: jest.fn().mockResolvedValue(undefined),
  };

  const accountRow = {
    id: 'acc-1',
    auth0UserId: null,
    phone: '+8801700000000',
    email: null,
    name: '+8801700000000',
    photoUrl: null,
    phoneVerifiedAt: new Date('2026-10-14'),
    createdAt: new Date('2026-10-14'),
    updatedAt: new Date('2026-10-14'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    redisStore.clear();
    mockDatabaseService.getPrisma.mockReturnValue({ prisma: mockPrisma });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerAuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: RedisService, useValue: mockRedis },
        { provide: Auth0Service, useValue: mockAuth0Service },
        { provide: CUSTOMER_OTP_PROVIDER, useValue: mockOtpProvider },
      ],
    }).compile();

    service = module.get(CustomerAuthService);
  });

  describe('requestOtp / verifyOtp (mock provider round-trip)', () => {
    it('stores the code in Redis with a TTL, sends via the provider, and returns a customer JWT on verify', async () => {
      const request = await service.requestOtp('+8801700000000');

      // Outside production the mock provider echoes the code for E2E/dev use.
      expect(request.devCode).toBeDefined();
      expect(request.devCode).toMatch(/^\d{6}$/);
      expect(mockOtpProvider.sendOtp).toHaveBeenCalledWith(
        '+8801700000000',
        request.devCode,
      );
      const stored = redisStore.get('custotp:+8801700000000');
      expect(stored).toBeDefined();
      expect(stored?.ttl).toBe(300);
      const record = stored?.value as { codeHash: string; attempts: number };
      expect(record.codeHash).not.toBe(request.devCode); // hashed, never stored raw

      mockPrisma.customerAccount.findUnique.mockResolvedValue(null);
      mockPrisma.customerAccount.create.mockResolvedValue(accountRow);

      const result = await service.verifyOtp(
        '+8801700000000',
        request.devCode as string,
      );

      // New account is created phone-verified (the auto-share gate).
      expect(mockPrisma.customerAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          phone: '+8801700000000',
          phoneVerifiedAt: expect.any(Date),
        }),
      });
      // JWT claims: customer audience only — NO tenantId/role/permissions.
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: 'acc-1', type: 'customer', audience: 'customer' },
        expect.objectContaining({ expiresIn: expect.any(String) }),
      );
      expect(result.access_token).toBe('customer.jwt.token');
      expect(result.account.id).toBe('acc-1');
      expect(result.account.phoneVerifiedAt).toBeInstanceOf(Date);
      // Single-use: the Redis record is consumed.
      expect(redisStore.has('custotp:+8801700000000')).toBe(false);
    });

    it('updates phoneVerifiedAt on an existing account instead of creating a duplicate', async () => {
      const request = await service.requestOtp('+8801700000000');
      mockPrisma.customerAccount.findUnique.mockResolvedValue(accountRow);
      mockPrisma.customerAccount.update.mockResolvedValue(accountRow);

      await service.verifyOtp('+8801700000000', request.devCode as string);

      expect(mockPrisma.customerAccount.create).not.toHaveBeenCalled();
      expect(mockPrisma.customerAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { phoneVerifiedAt: expect.any(Date) },
      });
    });

    it('rejects a wrong code and enforces the attempt cap', async () => {
      await service.requestOtp('+8801700000000');

      await expect(
        service.verifyOtp('+8801700000000', '000000'),
      ).rejects.toThrow(UnauthorizedException);
      // attempts incremented (4 more allowed before the record is burned)
      const record = redisStore.get('custotp:+8801700000000')?.value as {
        attempts: number;
      };
      expect(record.attempts).toBe(1);

      // 5th failed attempt deletes the record outright.
      for (let i = 0; i < 4; i++) {
        await expect(
          service.verifyOtp('+8801700000000', '000000'),
        ).rejects.toThrow(UnauthorizedException);
      }
      expect(redisStore.has('custotp:+8801700000000')).toBe(false);
      await expect(
        service.verifyOtp('+8801700000000', '000000'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects verification without a prior request (expired/never issued)', async () => {
      await expect(
        service.verifyOtp('+8801700000000', '123456'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.customerAccount.create).not.toHaveBeenCalled();
    });

    it('surfaces a delivery failure as 500 and does not leave a code in Redis', async () => {
      mockOtpProvider.sendOtp.mockRejectedValueOnce(
        new Error('SMS gateway down'),
      );

      await expect(service.requestOtp('+8801700000000')).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(redisStore.has('custotp:+8801700000000')).toBe(false);
    });
  });

  describe('socialLogin (Auth0 access token -> customer JWT)', () => {
    const socialUser = {
      sub: 'google-oauth2|112233',
      email: 'karim@gmail.com',
      name: 'Karim',
      picture: 'https://img.example/karim.jpg',
    };

    it('creates a CustomerAccount keyed by auth0UserId when first seen', async () => {
      mockAuth0Service.getUserInfo.mockResolvedValue(socialUser);
      mockPrisma.customerAccount.findUnique.mockResolvedValue(null);
      mockPrisma.customerAccount.create.mockResolvedValue({
        ...accountRow,
        id: 'acc-2',
        auth0UserId: socialUser.sub,
        name: 'Karim',
        phone: null,
        phoneVerifiedAt: null,
      });

      const result = await service.socialLogin('auth0-access-token');

      expect(mockPrisma.customerAccount.create).toHaveBeenCalledWith({
        data: {
          auth0UserId: socialUser.sub,
          name: 'Karim',
          email: 'karim@gmail.com',
          photoUrl: 'https://img.example/karim.jpg',
        },
      });
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: 'acc-2', type: 'customer', audience: 'customer' },
        expect.any(Object),
      );
      expect(result.account.name).toBe('Karim');
    });

    it('upserts profile fields on an existing auth0UserId (no duplicate)', async () => {
      mockAuth0Service.getUserInfo.mockResolvedValue(socialUser);
      mockPrisma.customerAccount.findUnique.mockResolvedValue({
        ...accountRow,
        auth0UserId: socialUser.sub,
        name: 'Old Name',
      });
      mockPrisma.customerAccount.update.mockResolvedValue({
        ...accountRow,
        name: 'Karim',
      });

      await service.socialLogin('auth0-access-token');

      expect(mockPrisma.customerAccount.create).not.toHaveBeenCalled();
      expect(mockPrisma.customerAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: {
          name: 'Karim',
          email: 'karim@gmail.com',
          photoUrl: 'https://img.example/karim.jpg',
        },
      });
    });

    it('rejects an invalid Auth0 token with 401', async () => {
      mockAuth0Service.getUserInfo.mockRejectedValue(
        new Error('Auth0 userinfo request failed: 401'),
      );

      await expect(service.socialLogin('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('me', () => {
    it('returns the profile of the authenticated account', async () => {
      mockPrisma.customerAccount.findUnique.mockResolvedValue(accountRow);

      const profile = await service.me('acc-1');

      expect(profile).toEqual({
        id: 'acc-1',
        name: '+8801700000000',
        phone: '+8801700000000',
        email: null,
        photoUrl: null,
        phoneVerifiedAt: accountRow.phoneVerifiedAt,
        createdAt: accountRow.createdAt,
      });
    });

    it('401s when the account row vanished', async () => {
      mockPrisma.customerAccount.findUnique.mockResolvedValue(null);
      await expect(service.me('ghost')).rejects.toThrow(UnauthorizedException);
    });
  });
});
