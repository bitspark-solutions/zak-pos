import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  InvitationsService,
  INVITATION_TTL_SECONDS,
  invitationKey,
  tenantInvitesKey,
} from './invitations.service';
import { RedisService } from '../redis/redis.service';
import { DatabaseService } from '../database/database.service';
import { Role } from '../auth/enums/permissions.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { InvitationRecord } from './interfaces/invitation.interface';

interface StoreEntry {
  value: unknown;
  /** Absolute ms deadline, or null for "no expiry" (mirrors SET without EX). */
  expiresAtMs: number | null;
}

const owner: AuthUser = {
  id: 'user-1',
  email: 'owner@test.dev',
  name: 'Owner',
  tenantId: 'tenant-1',
  role: Role.OWNER,
  permissions: [],
};

describe('InvitationsService', () => {
  let service: InvitationsService;

  // In-memory Redis double: JSON key/value store that honours TTLs on read,
  // same shape (getJson/setJson/ttl/del) as the double in session.service.spec.
  let store: Map<string, StoreEntry>;
  let mockRedis: {
    getJson: jest.Mock;
    setJson: jest.Mock;
    ttl: jest.Mock;
    del: jest.Mock;
  };

  const mockPrismaTx = {
    tenant: { findUnique: jest.fn() },
    shop: { findFirst: jest.fn() },
  };

  const mockDatabaseService = {
    withTenant: jest.fn(
      async (
        _tenantId: string,
        fn: (tx: typeof mockPrismaTx) => Promise<unknown>,
      ): Promise<unknown> => fn(mockPrismaTx),
    ),
  };

  /** Put a record under invite:<token> with an explicit expiry state. */
  function seedInvitation(
    record: InvitationRecord,
    expiresAtMs: number | null = Date.now() + INVITATION_TTL_SECONDS * 1000,
  ): void {
    store.set(invitationKey(record.token), { value: record, expiresAtMs });
    const indexKey = tenantInvitesKey(record.tenantId);
    const existing = store.get(indexKey);
    const tokens =
      existing && Array.isArray(existing.value)
        ? [...(existing.value as string[])]
        : [];
    tokens.push(record.token);
    store.set(indexKey, {
      value: tokens,
      expiresAtMs: Date.now() + INVITATION_TTL_SECONDS * 1000,
    });
  }

  function makeRecord(
    overrides: Partial<InvitationRecord> = {},
  ): InvitationRecord {
    const now = Date.now();
    return {
      token: `tok-${now}-${Math.random().toString(16).slice(2)}`,
      tenantId: 'tenant-1',
      tenantName: 'Test Tenant',
      email: 'invitee@test.dev',
      role: Role.CASHIER,
      shopId: null,
      invitedBy: owner.id,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + INVITATION_TTL_SECONDS * 1000).toISOString(),
      ...overrides,
    };
  }

  beforeEach(async () => {
    store = new Map();
    mockRedis = {
      getJson: jest.fn(async (key: string) => {
        const entry = store.get(key);
        if (!entry) return null;
        if (entry.expiresAtMs !== null && Date.now() >= entry.expiresAtMs) {
          store.delete(key);
          return null;
        }
        return JSON.parse(JSON.stringify(entry.value));
      }),
      setJson: jest.fn(async (key: string, value: unknown, ttl?: number) => {
        store.set(key, {
          value,
          expiresAtMs: ttl && ttl > 0 ? Date.now() + ttl * 1000 : null,
        });
      }),
      ttl: jest.fn(async (key: string) => {
        const entry = store.get(key);
        if (!entry) return -2;
        if (entry.expiresAtMs === null) return -1;
        return Math.max(0, Math.ceil((entry.expiresAtMs - Date.now()) / 1000));
      }),
      del: jest.fn(async (key: string) => {
        store.delete(key);
      }),
    };

    mockPrismaTx.tenant.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) =>
        where.id === 'tenant-1'
          ? { id: 'tenant-1', name: 'Test Tenant' }
          : null,
    );
    mockPrismaTx.shop.findFirst.mockImplementation(
      async ({ where }: { where: { id: string } }) =>
        where.id === 'shop-1' ? { id: 'shop-1', tenantId: 'tenant-1' } : null,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        { provide: RedisService, useValue: mockRedis },
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<InvitationsService>(InvitationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // The service echoes the raw token only when NODE_ENV=development; run the
  // whole suite in dev mode so create() results carry the token under test.
  const originalNodeEnv = process.env.NODE_ENV;
  beforeAll(() => {
    process.env.NODE_ENV = 'development';
  });
  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('create', () => {
    it('stores a 32-hex token record in Redis with a 7-day TTL and indexes it per tenant', async () => {
      const result = await service.create(
        { email: 'invitee@test.dev', role: Role.CASHIER },
        owner,
      );

      const token = result.token as string;
      expect(token).toMatch(/^[0-9a-f]{32}$/);
      expect(mockDatabaseService.withTenant).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(Function),
      );

      const stored = store.get(invitationKey(token));
      expect(stored?.expiresAtMs).not.toBeNull();
      const ttlSeconds = ((stored?.expiresAtMs as number) - Date.now()) / 1000;
      expect(ttlSeconds).toBeGreaterThan(INVITATION_TTL_SECONDS - 60);
      expect(stored?.value).toMatchObject({
        token,
        tenantId: 'tenant-1',
        tenantName: 'Test Tenant',
        email: 'invitee@test.dev',
        role: Role.CASHIER,
        shopId: null,
        invitedBy: 'user-1',
      });

      const index = store.get(tenantInvitesKey('tenant-1'));
      expect(index?.value).toEqual([token]);
    });

    it('builds the invite URL from FRONTEND_URL and echoes the token only in development', async () => {
      const originalFrontend = process.env.FRONTEND_URL;
      process.env.FRONTEND_URL = 'https://app.zakpos.test';
      try {
        const dev = await service.create(
          { email: 'dev@test.dev', role: Role.MANAGER },
          owner,
        );
        expect(dev.token).toBeDefined();
        expect(dev.inviteUrl).toBe(
          `https://app.zakpos.test/register?token=${dev.token}`,
        );
        expect(dev.tenantName).toBe('Test Tenant');
        expect(dev.expiresAt).toContain('T');

        process.env.NODE_ENV = 'production';
        const prod = await service.create(
          { email: 'prod@test.dev', role: Role.MANAGER },
          owner,
        );
        expect(prod.token).toBeUndefined();
        expect(prod.inviteUrl).toMatch(
          /^https:\/\/app\.zakpos\.test\/register\?token=[0-9a-f]{32}$/,
        );
      } finally {
        process.env.NODE_ENV = 'development';
        process.env.FRONTEND_URL = originalFrontend;
      }
    });

    it('validates shopId against the caller tenant through withTenant', async () => {
      await expect(
        service.create(
          {
            email: 'invitee@test.dev',
            role: Role.CASHIER,
            shopId: 'ghost-shop',
          },
          owner,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaTx.shop.findFirst).toHaveBeenCalledWith({
        where: { id: 'ghost-shop' },
      });
    });

    it('accepts a shop that belongs to the tenant and stores it on the record', async () => {
      const result = await service.create(
        { email: 'invitee@test.dev', role: Role.CASHIER, shopId: 'shop-1' },
        owner,
      );
      const stored = store.get(invitationKey(result.token as string))
        ?.value as InvitationRecord;
      expect(stored.shopId).toBe('shop-1');
    });
  });

  describe('list', () => {
    it('returns pending invitations for the tenant with remaining TTL', async () => {
      seedInvitation(makeRecord({ token: 'a'.repeat(32) }));
      seedInvitation(
        makeRecord({ token: 'b'.repeat(32), email: 'second@test.dev' }),
      );

      const items = await service.list('tenant-1');
      expect(items).toHaveLength(2);
      expect(items.map((i) => i.token).sort()).toEqual([
        'a'.repeat(32),
        'b'.repeat(32),
      ]);
      expect(items[0].expiresIn).toBeGreaterThan(0);
      expect(items[0].expiresIn).toBeLessThanOrEqual(INVITATION_TTL_SECONDS);
      expect(items[0].inviteUrl).toContain('/register?token=');
      expect(items[0].email).toBeDefined();
    });

    it('prunes expired invitations from the tenant index', async () => {
      const live = makeRecord({ token: 'l'.repeat(32) });
      const dead = makeRecord({ token: 'd'.repeat(32) });
      seedInvitation(live);
      seedInvitation(dead, Date.now() - 1000); // already past its TTL

      const items = await service.list('tenant-1');
      expect(items.map((i) => i.token)).toEqual(['l'.repeat(32)]);

      const index = store.get(tenantInvitesKey('tenant-1'))?.value as string[];
      expect(index).toEqual(['l'.repeat(32)]);
    });

    it('ignores foreign-tenant records referenced by the index', async () => {
      const foreign = makeRecord({
        token: 'x'.repeat(32),
        tenantId: 'tenant-2',
      });
      seedInvitation(foreign);
      // Tamper: tenant-1's index points at tenant-2's invitation.
      store.set(tenantInvitesKey('tenant-1'), {
        value: [foreign.token],
        expiresAtMs: Date.now() + INVITATION_TTL_SECONDS * 1000,
      });

      const items = await service.list('tenant-1');
      expect(items).toEqual([]);
      // The stale index entry is pruned (index deleted when emptied).
      expect(store.has(tenantInvitesKey('tenant-1'))).toBe(false);
    });

    it('is empty for a tenant with no invitations', async () => {
      await expect(service.list('tenant-empty')).resolves.toEqual([]);
    });
  });

  describe('revoke', () => {
    it('deletes the record and removes the token from the tenant index', async () => {
      seedInvitation(makeRecord({ token: 'r'.repeat(32) }));
      seedInvitation(makeRecord({ token: 'k'.repeat(32) }));

      await service.revoke('tenant-1', 'r'.repeat(32));

      expect(store.has(invitationKey('r'.repeat(32)))).toBe(false);
      const index = store.get(tenantInvitesKey('tenant-1'))?.value as string[];
      expect(index).toEqual(['k'.repeat(32)]);
    });

    it('throws NotFoundException for an unknown token', async () => {
      await expect(service.revoke('tenant-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('does not allow revoking another tenant invitation', async () => {
      const foreign = makeRecord({
        token: 'o'.repeat(32),
        tenantId: 'tenant-2',
      });
      seedInvitation(foreign);

      await expect(service.revoke('tenant-1', foreign.token)).rejects.toThrow(
        NotFoundException,
      );
      expect(store.has(invitationKey(foreign.token))).toBe(true);
    });
  });

  describe('verify', () => {
    it('returns tenant name, role and email for a valid token', async () => {
      seedInvitation(
        makeRecord({
          token: 'v'.repeat(32),
          email: 'invitee@test.dev',
          role: Role.MANAGER,
        }),
      );

      await expect(service.verify('v'.repeat(32))).resolves.toEqual({
        valid: true,
        tenantName: 'Test Tenant',
        role: Role.MANAGER,
        email: 'invitee@test.dev',
      });
    });

    it('returns { valid: false } for unknown or empty tokens', async () => {
      await expect(service.verify('nope')).resolves.toEqual({ valid: false });
      await expect(service.verify('')).resolves.toEqual({ valid: false });
    });

    it('treats a record whose TTL already elapsed as invalid', async () => {
      seedInvitation(makeRecord({ token: 'e'.repeat(32) }), Date.now() - 1);
      await expect(service.verify('e'.repeat(32))).resolves.toEqual({
        valid: false,
      });
    });

    it('treats a record stored without any TTL as invalid and cleans it up', async () => {
      // Mirrors a Redis key that somehow has no expiry: ttl() returns -1.
      seedInvitation(makeRecord({ token: 'n'.repeat(32) }), null);
      await expect(service.verify('n'.repeat(32))).resolves.toEqual({
        valid: false,
      });
      expect(mockRedis.del).toHaveBeenCalledWith(invitationKey('n'.repeat(32)));
    });
  });

  describe('consume', () => {
    it('deletes the invitation and prunes the index (single-use)', async () => {
      seedInvitation(makeRecord({ token: 'c'.repeat(32) }));

      await service.consume('c'.repeat(32));

      expect(store.has(invitationKey('c'.repeat(32)))).toBe(false);
      expect(store.has(tenantInvitesKey('tenant-1'))).toBe(false);
    });

    it('is a no-op for an unknown token', async () => {
      await expect(service.consume('ghost')).resolves.toBeUndefined();
    });
  });

  describe('findValid', () => {
    it('returns the stored record for a live invitation', async () => {
      const record = makeRecord({ token: 'f'.repeat(32) });
      seedInvitation(record);
      await expect(service.findValid('f'.repeat(32))).resolves.toEqual(record);
    });

    it('returns null for an expired invitation', async () => {
      seedInvitation(makeRecord({ token: 'x'.repeat(32) }), Date.now() - 10);
      await expect(service.findValid('x'.repeat(32))).resolves.toBeNull();
    });
  });
});
