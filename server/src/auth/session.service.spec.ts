import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from './session.service';
import { RedisService } from '../redis/redis.service';

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // mirrors SessionService TTL

describe('SessionService', () => {
  let service: SessionService;

  // In-memory Redis double: key/value JSON store + set indexes for the
  // user -> session-id index used by getActiveSessionsByUser.
  let kv: Map<string, unknown>;
  let sets: Map<string, Set<string>>;
  let mockRedis: {
    getJson: jest.Mock;
    setJson: jest.Mock;
    ttl: jest.Mock;
    del: jest.Mock;
    client: {
      sadd: jest.Mock;
      smembers: jest.Mock;
      srem: jest.Mock;
    };
  };

  beforeEach(async () => {
    kv = new Map();
    sets = new Map();

    mockRedis = {
      getJson: jest.fn(async (key: string) =>
        kv.has(key) ? JSON.parse(JSON.stringify(kv.get(key))) : null,
      ),
      setJson: jest.fn(async (key: string, value: unknown, _ttl?: number) => {
        kv.set(key, value);
      }),
      ttl: jest.fn(async (_key: string) => SESSION_TTL_SECONDS),
      del: jest.fn(async (key: string) => {
        kv.delete(key);
      }),
      client: {
        sadd: jest.fn(async (key: string, member: string) => {
          if (!sets.has(key)) sets.set(key, new Set());
          sets.get(key)!.add(member);
          return 1;
        }),
        smembers: jest.fn(async (key: string) =>
          Array.from(sets.get(key) ?? []),
        ),
        srem: jest.fn(async (key: string, member: string) => {
          sets.get(key)?.delete(member);
          return 1;
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSession and getSession', () => {
    it('should create and retrieve an active session', async () => {
      const session = await service.createSession('u1', 'dev-1', 'tok-abc');
      expect(session.id).toBeDefined();
      expect(session.userId).toBe('u1');
      expect(session.deviceId).toBe('dev-1');
      expect(session.token).toBe('tok-abc');
      expect(session.isActive).toBe(true);

      const retrieved = await service.getSession(session.id);
      expect(retrieved).toEqual(session);
    });

    it('should store the session in Redis with a TTL and index it under the user', async () => {
      const session = await service.createSession('u1', 'dev-1', 'tok-abc');

      expect(mockRedis.setJson).toHaveBeenCalledWith(
        `session:${session.id}`,
        expect.objectContaining({ userId: 'u1', isActive: true }),
        SESSION_TTL_SECONDS,
      );
      expect(mockRedis.client.sadd).toHaveBeenCalledWith(
        'user:u1:sessions',
        session.id,
      );
    });

    it('should return null for non-existent session', async () => {
      const retrieved = await service.getSession('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('updateSessionActivity', () => {
    it('should update lastActivity timestamp', async () => {
      const session = await service.createSession('u1', 'dev-1', 'tok-abc');
      const initialTime = session.lastActivity;

      // Small tick
      await new Promise((r) => setTimeout(r, 10));
      await service.updateSessionActivity(session.id);

      const updated = await service.getSession(session.id);
      expect(updated?.lastActivity.getTime()).toBeGreaterThanOrEqual(
        initialTime.getTime(),
      );
    });

    it('should be a no-op for an unknown session', async () => {
      await expect(
        service.updateSessionActivity('missing'),
      ).resolves.toBeUndefined();
      expect(mockRedis.setJson).not.toHaveBeenCalled();
    });
  });

  describe('revokeSession and getActiveSessionsByUser', () => {
    it('should deactivate session upon revocation', async () => {
      const s1 = await service.createSession('u1', 'dev-1', 'tok-1');
      await new Promise((r) => setTimeout(r, 5));
      const s2 = await service.createSession('u1', 'dev-2', 'tok-2');

      const activeBefore = await service.getActiveSessionsByUser('u1');
      expect(activeBefore).toHaveLength(2);

      const revoked = await service.revokeSession(s1.id);
      expect(revoked).toBe(true);

      const activeAfter = await service.getActiveSessionsByUser('u1');
      expect(activeAfter).toHaveLength(1);
      expect(activeAfter[0].id).toBe(s2.id);
    });

    it('should return false when revoking non-existent session', async () => {
      const result = await service.revokeSession('fake-id');
      expect(result).toBe(false);
    });
  });

  describe('expiry cleanup (Redis TTL based)', () => {
    it('should treat TTL-expired sessions as gone', async () => {
      const session = await service.createSession('u1', 'dev-1', 'tok-exp');

      // Redis evicts the key once its TTL lapses; simulate that here.
      kv.delete(`session:${session.id}`);

      expect(await service.getSession(session.id)).toBeNull();
    });

    it('should prune expired session ids from the user index', async () => {
      const s1 = await service.createSession('u1', 'dev-1', 'tok-1');
      await service.createSession('u1', 'dev-2', 'tok-2');

      // s1 expired out of Redis, its id remains in the index until pruned.
      kv.delete(`session:${s1.id}`);

      const active = await service.getActiveSessionsByUser('u1');
      expect(active).toHaveLength(1);
      expect(mockRedis.client.srem).toHaveBeenCalledWith(
        'user:u1:sessions',
        s1.id,
      );
    });
  });
});
