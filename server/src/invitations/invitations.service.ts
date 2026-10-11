import { randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import type {
  CreatedInvitation,
  InvitationListItem,
  InvitationRecord,
  VerifyInvitationResult,
} from './interfaces/invitation.interface';

/** Invitations are valid for 7 days. */
export const INVITATION_TTL_SECONDS = 7 * 60 * 60 * 24;

/** 16 random bytes rendered as hex = a 32-character hex token. */
export const INVITATION_TOKEN_BYTES = 16;

export const invitationKey = (token: string): string => `invite:${token}`;
export const tenantInvitesKey = (tenantId: string): string =>
  `invites:${tenantId}`;

/**
 * Tenant invitations live in Redis (there is no Invitation model in the Prisma
 * schema): the record itself under `invite:<token>` with a 7-day TTL, plus a
 * per-tenant JSON array of tokens under `invites:<tenantId>` used as the
 * pending-list index. The admin client is never needed here; the only DB work
 * (resolving the tenant name, validating shopId) goes through
 * DatabaseService.withTenant so it stays RLS-scoped.
 */
@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly databaseService: DatabaseService,
  ) {}

  async create(
    createInvitationDto: CreateInvitationDto,
    user: AuthUser,
  ): Promise<CreatedInvitation> {
    const tenantId = user.tenantId;
    const tenant = await this.databaseService.withTenant(
      tenantId,
      async (tx) => {
        const tenantRow = await tx.tenant.findUnique({
          where: { id: tenantId },
        });
        if (createInvitationDto.shopId) {
          const shop = await tx.shop.findFirst({
            where: { id: createInvitationDto.shopId },
          });
          if (!shop) {
            throw new BadRequestException(
              `Shop ${createInvitationDto.shopId} does not exist in this tenant`,
            );
          }
        }
        return tenantRow;
      },
    );

    if (!tenant) {
      throw new BadRequestException(
        'The tenant behind the current user does not exist',
      );
    }

    const token = randomBytes(INVITATION_TOKEN_BYTES).toString('hex');
    const createdAt = new Date();
    const expiresAt = new Date(
      createdAt.getTime() + INVITATION_TTL_SECONDS * 1000,
    );
    const record: InvitationRecord = {
      token,
      tenantId,
      tenantName: tenant.name,
      email: createInvitationDto.email,
      role: createInvitationDto.role,
      shopId: createInvitationDto.shopId ?? null,
      invitedBy: user.id,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await this.redis.setJson(
      invitationKey(token),
      record,
      INVITATION_TTL_SECONDS,
    );
    await this.addToIndex(tenantId, token);

    const result: CreatedInvitation = {
      email: record.email,
      role: record.role,
      shopId: record.shopId,
      tenantName: record.tenantName,
      inviteUrl: this.buildInviteUrl(token),
      expiresAt: record.expiresAt,
    };
    if (process.env.NODE_ENV === 'development') {
      // Dev/E2E convenience: the invite link needs no email transport here,
      // so echo the raw token only when running locally.
      result.token = token;
    }
    return result;
  }

  async list(tenantId: string): Promise<InvitationListItem[]> {
    const indexedTokens = await this.readIndex(tenantId);
    const items: InvitationListItem[] = [];
    const liveTokens: string[] = [];

    for (const token of indexedTokens) {
      const record = await this.redis.getJson<InvitationRecord>(
        invitationKey(token),
      );
      if (!record || record.tenantId !== tenantId) {
        continue;
      }
      const remaining = await this.redis.ttl(invitationKey(token));
      if (remaining <= 0) {
        // Redis-side expiry (-2) or a record that lost its TTL (-1).
        continue;
      }
      liveTokens.push(token);
      items.push({
        token,
        email: record.email,
        role: record.role,
        shopId: record.shopId,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        expiresIn: remaining,
        inviteUrl: this.buildInviteUrl(token),
      });
    }

    if (liveTokens.length !== indexedTokens.length) {
      await this.writeIndex(tenantId, liveTokens);
    }
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async revoke(tenantId: string, token: string): Promise<{ message: string }> {
    const record = await this.redis.getJson<InvitationRecord>(
      invitationKey(token),
    );
    if (!record || record.tenantId !== tenantId) {
      // Never reveal whether the token exists in another tenant.
      throw new NotFoundException('Invitation not found');
    }
    await this.redis.del(invitationKey(token));
    await this.removeFromIndex(tenantId, token);
    return { message: 'Invitation revoked' };
  }

  /** Public check used by the register page before the invitee signs up. */
  async verify(token: string): Promise<VerifyInvitationResult> {
    const record = await this.findValid(token);
    if (!record) {
      return { valid: false };
    }
    return {
      valid: true,
      tenantName: record.tenantName,
      role: record.role,
      email: record.email,
    };
  }

  /** Returns the invitation for a token, or null when missing/expired. */
  async findValid(token: string): Promise<InvitationRecord | null> {
    if (!token) {
      return null;
    }
    const record = await this.redis.getJson<InvitationRecord>(
      invitationKey(token),
    );
    if (!record) {
      return null;
    }
    const remaining = await this.redis.ttl(invitationKey(token));
    if (remaining <= 0) {
      await this.redis.del(invitationKey(token));
      await this.removeFromIndex(record.tenantId, token);
      return null;
    }
    return record;
  }

  /** Single-use consumption after a successful invited registration. */
  async consume(token: string): Promise<void> {
    const record = await this.redis.getJson<InvitationRecord>(
      invitationKey(token),
    );
    if (!record) {
      return;
    }
    await this.redis.del(invitationKey(token));
    await this.removeFromIndex(record.tenantId, token);
    this.logger.log(
      `Invitation for ${record.email} consumed in tenant ${record.tenantId}`,
    );
  }

  private async readIndex(tenantId: string): Promise<string[]> {
    const raw = await this.redis.getJson<string[]>(tenantInvitesKey(tenantId));
    return Array.isArray(raw) ? [...raw] : [];
  }

  private async writeIndex(tenantId: string, tokens: string[]): Promise<void> {
    if (tokens.length === 0) {
      await this.redis.del(tenantInvitesKey(tenantId));
      return;
    }
    await this.redis.setJson(
      tenantInvitesKey(tenantId),
      tokens,
      INVITATION_TTL_SECONDS,
    );
  }

  private async addToIndex(tenantId: string, token: string): Promise<void> {
    const tokens = await this.readIndex(tenantId);
    if (!tokens.includes(token)) {
      tokens.push(token);
    }
    await this.writeIndex(tenantId, tokens);
  }

  private async removeFromIndex(
    tenantId: string,
    token: string,
  ): Promise<void> {
    const tokens = await this.readIndex(tenantId);
    const remaining = tokens.filter((t) => t !== token);
    await this.writeIndex(tenantId, remaining);
  }

  private buildInviteUrl(token: string): string {
    const base = (process.env.FRONTEND_URL || 'http://localhost:41923').replace(
      /\/$/,
      '',
    );
    return `${base}/register?token=${token}`;
  }
}
