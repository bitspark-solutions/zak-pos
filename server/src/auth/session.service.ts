import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface SessionInfo {
  id: string;
  userId: string;
  deviceId: string;
  token: string;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
}

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

@Injectable()
export class SessionService {
  constructor(private readonly redis: RedisService) {}

  private sessionKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  private userSessionsKey(userId: string): string {
    return `user:${userId}:sessions`;
  }

  private revive(raw: SessionInfo): SessionInfo {
    return {
      ...raw,
      expiresAt: new Date(raw.expiresAt),
      createdAt: new Date(raw.createdAt),
      lastActivity: new Date(raw.lastActivity),
    };
  }

  async createSession(userId: string, deviceId: string, token: string): Promise<SessionInfo> {
    const now = new Date();
    const session: SessionInfo = {
      id: now.getTime().toString() + Math.random().toString(36).slice(2, 8),
      userId,
      deviceId,
      token,
      expiresAt: new Date(now.getTime() + SESSION_TTL_SECONDS * 1000),
      isActive: true,
      createdAt: now,
      lastActivity: now,
    };

    await this.redis.setJson(this.sessionKey(session.id), session, SESSION_TTL_SECONDS);
    await this.redis.client.sadd(this.userSessionsKey(userId), session.id);
    return session;
  }

  async getSession(sessionId: string): Promise<SessionInfo | null> {
    const raw = await this.redis.getJson<SessionInfo>(this.sessionKey(sessionId));
    return raw ? this.revive(raw) : null;
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    const raw = await this.redis.getJson<SessionInfo>(this.sessionKey(sessionId));
    if (!raw) return;

    raw.lastActivity = new Date();
    const remainingTtl = await this.redis.ttl(this.sessionKey(sessionId));
    await this.redis.setJson(
      this.sessionKey(sessionId),
      raw,
      remainingTtl > 0 ? remainingTtl : undefined,
    );
  }

  async revokeSession(sessionId: string): Promise<boolean> {
    const raw = await this.redis.getJson<SessionInfo>(this.sessionKey(sessionId));
    if (!raw) return false;

    raw.isActive = false;
    const remainingTtl = await this.redis.ttl(this.sessionKey(sessionId));
    await this.redis.setJson(
      this.sessionKey(sessionId),
      raw,
      remainingTtl > 0 ? remainingTtl : undefined,
    );
    return true;
  }

  async getActiveSessionsByUser(userId: string): Promise<SessionInfo[]> {
    const ids = await this.redis.client.smembers(this.userSessionsKey(userId));
    const sessions: SessionInfo[] = [];

    for (const id of ids) {
      const raw = await this.redis.getJson<SessionInfo>(this.sessionKey(id));
      if (!raw) {
        // Expired from Redis — drop it from the index
        await this.redis.client.srem(this.userSessionsKey(userId), id);
        continue;
      }
      if (raw.isActive) {
        sessions.push(this.revive(raw));
      }
    }

    return sessions;
  }
}
