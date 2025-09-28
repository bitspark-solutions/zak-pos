import { Injectable } from '@nestjs/common';

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

@Injectable()
export class SessionService {
  private sessions: Map<string, SessionInfo> = new Map();

  async createSession(userId: string, deviceId: string, token: string): Promise<SessionInfo> {
    const session: SessionInfo = {
      id: Date.now().toString(),
      userId,
      deviceId,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      isActive: true,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    this.sessions.set(session.id, session);
    return session;
  }

  async getSession(sessionId: string): Promise<SessionInfo | null> {
    return this.sessions.get(sessionId) || null;
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      this.sessions.set(sessionId, session);
    }
  }

  async revokeSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.sessions.set(sessionId, session);
      return true;
    }
    return false;
  }

  async getActiveSessionsByUser(userId: string): Promise<SessionInfo[]> {
    return Array.from(this.sessions.values()).filter(
      session => session.userId === userId && session.isActive
    );
  }

  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        session.isActive = false;
        this.sessions.set(sessionId, session);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }
}
