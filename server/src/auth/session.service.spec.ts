import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SessionService],
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
      expect(updated?.lastActivity.getTime()).toBeGreaterThanOrEqual(initialTime.getTime());
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

  describe('cleanupExpiredSessions', () => {
    it('should clean up sessions whose expiresAt has passed', async () => {
      const session = await service.createSession('u1', 'dev-1', 'tok-exp');
      session.expiresAt = new Date(Date.now() - 1000); // Expired in past

      const cleaned = await service.cleanupExpiredSessions();
      expect(cleaned).toBe(1);

      const retrieved = await service.getSession(session.id);
      expect(retrieved?.isActive).toBe(false);
    });
  });
});
