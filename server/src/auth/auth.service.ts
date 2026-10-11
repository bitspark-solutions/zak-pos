import { randomInt } from 'crypto';
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { Auth0Service, Auth0UserInfo } from './auth0.service';
import { DatabaseService } from '../database/database.service';
import { TenantService } from './tenant.service';
import { SessionService } from './session.service';
import { RedisService } from '../redis/redis.service';
import { InvitationsService } from '../invitations/invitations.service';
import type { InvitationRecord } from '../invitations/interfaces/invitation.interface';
import { ROLE_PERMISSIONS, Role } from './enums/permissions.enum';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

interface Auth0Result {
  userInfo: Auth0UserInfo;
}

interface UserWithPassword {
  id: string;
  email: string;
  name: string;
  password?: string | null;
  role: string;
  tenantId: string;
  phone?: string | null;
  externalId?: string | null;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  permissions: string[];
  auth0Id?: string;
}

/** One row returned by the admin client for password operations. */
interface PasswordUserRow {
  id: string;
  email: string;
  password?: string | null;
  externalId?: string | null;
}

/** Redis record stored under `pwdreset:<email>` by forgot-password. */
interface PasswordResetRecord {
  codeHash: string;
  attempts: number;
}

export interface PasswordUpdateResult {
  message: string;
  /** False when the local DB was updated but the Auth0 mirror call failed. */
  auth0Synced: boolean;
  auth0SyncError?: string;
}

export interface ForgotPasswordResult {
  message: string;
  /** Only present when NODE_ENV=development so E2E tests can consume the code. */
  devCode?: string;
}

const BCRYPT_SALT_ROUNDS = 10;
const PASSWORD_RESET_TTL_SECONDS = 30 * 60;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_GENERIC_MESSAGE =
  'If an account exists for this email, a password reset code has been sent.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private auth0Service: Auth0Service,
    private databaseService: DatabaseService,
    private tenantService: TenantService,
    private sessionService: SessionService,
    private redis: RedisService,
    private invitationsService: InvitationsService,
  ) {}

  private isAuth0Result(result: unknown): result is Auth0Result {
    return (
      typeof result === 'object' &&
      result !== null &&
      'userInfo' in result &&
      typeof (result as { userInfo: unknown }).userInfo === 'object' &&
      (result as { userInfo: { email?: unknown } }).userInfo !== null &&
      typeof (result as { userInfo: { email: unknown } }).userInfo.email ===
        'string'
    );
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser | null> {
    // Try Auth0 authentication first (if configured)
    let auth0Result: Auth0Result | null = null;
    try {
      // Type assertion needed because validateUser returns Promise<Auth0ValidationResult | null>
      // but we check with type guard to ensure type safety
      const result = (await this.auth0Service.validateUser(
        email,
        password,
      )) as Auth0Result | null;
      if (result && this.isAuth0Result(result)) {
        auth0Result = result;
      }
    } catch (error: unknown) {
      // If Auth0 fails for any reason, log and fall back to PostgreSQL
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.warn(
        'Auth0 validation error, falling back to PostgreSQL:',
        errorMessage,
      );
      auth0Result = null;
    }

    if (auth0Result && auth0Result.userInfo) {
      // Credentials verified by Auth0. The local DB is the source of truth for
      // tenant/role/status - both must agree before login succeeds.
      const userInfo = auth0Result.userInfo;
      const userEmail = userInfo.email;
      const localUser = (await this.usersService.findByEmail(
        userEmail,
      )) as UserWithPassword | null;

      if (!localUser) {
        // Self-service Auth0 accounts are not provisioned here; deny until an
        // owner/admin registers the user (register flow writes both stores).
        this.logger.warn(
          `Auth0 user ${userEmail} has no local DB record - rejecting login`,
        );
        return null;
      }

      if (localUser.status && localUser.status !== 'active') {
        throw new UnauthorizedException('User account is disabled');
      }

      // Backfill Auth0 user_id mapping if register/codes created the row first
      if (!localUser.externalId && userInfo.sub) {
        await this.databaseService
          .getPrisma()
          .prisma.user.update({
            where: { id: localUser.id },
            data: { externalId: userInfo.sub },
          })
          .catch((err: unknown) =>
            this.logger.warn(
              `Failed to backfill externalId for ${localUser.id}: ${String(err)}`,
            ),
          );
        localUser.externalId = userInfo.sub;
      }

      return {
        id: localUser.id,
        email: localUser.email,
        name: localUser.name,
        role: localUser.role,
        tenantId: localUser.tenantId,
        auth0Id: localUser.externalId || userInfo.sub,
        permissions: this.getUserPermissions(localUser.role),
      };
    }

    // Fallback to PostgreSQL authentication (for local-only users registered
    // before Auth0, or when Auth0 is unavailable)
    const user = (await this.usersService.findByEmail(
      email,
    )) as UserWithPassword | null;
    if (
      user &&
      user.password &&
      user.password !== 'auth0-managed' &&
      (await bcrypt.compare(password, user.password))
    ) {
      if (user.status && user.status !== 'active') {
        throw new UnauthorizedException('User account is disabled');
      }
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        auth0Id: user.externalId || undefined,
        permissions: this.getUserPermissions(user.role),
      };
    }

    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      email: user.email,
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      permissions: user.permissions || this.getUserPermissions(user.role),
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        permissions: user.permissions || this.getUserPermissions(user.role),
      },
    };
  }

  async register(registerDto: RegisterDto) {
    // Step 1: Validate input
    if (!registerDto.email || !registerDto.password || !registerDto.name) {
      throw new BadRequestException('Email, password, and name are required');
    }

    // Step 1b: Resolve the invitation token up front. An invalid/expired
    // token is a hard error — invited registrations must never silently
    // fall back to self-provisioning a new tenant.
    let invitation: InvitationRecord | null = null;
    if (registerDto.inviteToken) {
      invitation = await this.invitationsService.findValid(
        registerDto.inviteToken,
      );
      if (!invitation) {
        throw new BadRequestException('Invalid or expired invitation token');
      }
      if (invitation.email.toLowerCase() !== registerDto.email.toLowerCase()) {
        throw new BadRequestException('Email does not match the invitation');
      }
    }

    // Step 2: Check if user already exists in local database
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Determine default role:
    // - Invited registration: the invitation's role is authoritative
    // - If tenantId is provided (legacy staff join), use provided role or default to 'cashier'
    // - If no tenantId (public registration), default to 'owner' (business owner registration)
    const defaultRole = registerDto.tenantId ? 'cashier' : 'owner';
    const userRole = invitation
      ? invitation.role
      : registerDto.role || defaultRole;

    // Step 3: Resolve the tenant (real provisioning, no fallback IDs).
    // Owner self-registration creates tenant + first shop + chart of accounts;
    // staff joining an existing tenant is validated against the DB.
    // An invitation always joins the inviter's tenant — no new tenant is
    // provisioned, and registerDto.tenantId is ignored in that path.
    if (
      !invitation &&
      registerDto.tenantId &&
      registerDto.role === Role.OWNER
    ) {
      throw new BadRequestException(
        'Owners provision their own store; remove tenantId to create a new one',
      );
    }

    let tenantId: string;
    let shopId: string | undefined;
    if (invitation) {
      try {
        const ensured = await this.tenantService.ensureTenant(
          invitation.tenantId,
        );
        tenantId = ensured.tenantId;
        shopId = invitation.shopId ?? ensured.shopId ?? undefined;
      } catch {
        throw new BadRequestException(
          `The workspace behind this invitation no longer exists (${invitation.tenantId})`,
        );
      }
    } else if (!registerDto.tenantId) {
      const store = await this.tenantService.provisionStore(
        registerDto.name,
        registerDto.storeName,
      );
      tenantId = store.tenantId;
      shopId = store.shopId;
    } else {
      try {
        const ensured = await this.tenantService.ensureTenant(
          registerDto.tenantId,
        );
        tenantId = ensured.tenantId;
        shopId = ensured.shopId;
      } catch {
        throw new BadRequestException(
          `Unknown tenant ${registerDto.tenantId} - ask the owner for a valid workspace ID`,
        );
      }
    }

    // Step 4: Create user in Auth0 (credential authority), then mirror into
    // the local DB with the Auth0 user_id as externalId
    let auth0UserId: string | null = null;
    try {
      const auth0User = await this.auth0Service.createUser({
        email: registerDto.email,
        password: registerDto.password,
        name: registerDto.name,
        role: userRole,
        tenantId,
      });
      auth0UserId = auth0User.auth0Id;
    } catch (error: unknown) {
      // If Auth0 creation fails, check if it's a user conflict
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      if (
        errorMessage.includes('already exists') ||
        errorMessage.includes('User already exists')
      ) {
        throw new ConflictException('User with this email already exists');
      }
      // If Auth0 Management API is not enabled or unavailable, fall back to local-only registration
      if (
        errorMessage.includes('Service not enabled') ||
        errorMessage.includes('access_denied') ||
        errorMessage.includes('Management API') ||
        errorMessage.includes('not configured')
      ) {
        this.logger.warn(
          'Auth0 Management API not available, falling back to local-only registration',
        );
      } else {
        // For other errors, still throw
        throw new BadRequestException(`Failed to create user: ${errorMessage}`);
      }
    }

    // Step 5: Create user in local database (source of truth for tenant/role/status)
    // Password is mirrored as a bcrypt hash so API login works even when Auth0
    // rejects the direct grant (ROPG is disabled on new tenants).
    const passwordToStore = await bcrypt.hash(registerDto.password, 10);

    const localUser = (await this.usersService.create(
      {
        email: registerDto.email,
        name: registerDto.name,
        password: passwordToStore,
        role: userRole,
        phone: registerDto.phone,
        externalId: auth0UserId || undefined,
      },
      tenantId,
    )) as UserWithPassword;

    // Step 5b: The invitation is single-use; only consumed once the user row
    // exists, so a failed registration leaves the token reusable.
    if (invitation) {
      await this.invitationsService.consume(invitation.token);
    }

    // Step 6: Generate JWT with full context
    const permissions = this.getUserPermissions(localUser.role);
    const payload = {
      email: localUser.email,
      sub: localUser.id,
      tenantId: localUser.tenantId,
      shopId,
      role: localUser.role,
      permissions: permissions,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: localUser.id,
        email: localUser.email,
        name: localUser.name,
        role: localUser.role,
        tenantId: localUser.tenantId,
        shopId,
        permissions: permissions,
      },
    };
  }

  async validateToken(token: string): Promise<unknown> {
    try {
      return await Promise.resolve(this.jwtService.verify(token));
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  // -------------------------------------------------------------------------
  // Self-service password flows. Users live in BOTH the local DB (bcrypt hash,
  // used by the API login fallback) and Auth0 (credential authority for
  // Universal Login), so every password write must hit both stores. A DB write
  // failure always throws; an Auth0 mirror failure is surfaced via the
  // auth0Synced flag + error message instead of silently swallowing it.
  // -------------------------------------------------------------------------

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
    currentToken: string,
  ): Promise<PasswordUpdateResult> {
    // Admin client (RLS-bypassing) is the sanctioned path for auth flows,
    // same as login/registration.
    const { prisma } = this.databaseService.getPrisma();
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user?.password || user.password === 'auth0-managed') {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const currentMatches = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );
    if (!currentMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const result = await this.applyNewPassword(
      user,
      changePasswordDto.newPassword,
      'Password changed successfully',
    );

    await this.invalidateOtherSessions(userId, currentToken);

    return result;
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResult> {
    const email = forgotPasswordDto.email;
    // Same admin-path lookup login uses: forgot-password runs before any
    // tenant context exists. Never reveal whether the account exists.
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return { message: PASSWORD_RESET_GENERIC_MESSAGE };
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = await bcrypt.hash(code, BCRYPT_SALT_ROUNDS);
    await this.redis.setJson(
      this.resetKey(email),
      { codeHash, attempts: 0 } satisfies PasswordResetRecord,
      PASSWORD_RESET_TTL_SECONDS,
    );

    // No email transport is wired up yet; the dev-only echo lets E2E tests
    // complete the reset flow without a mail provider.
    if (process.env.NODE_ENV === 'development') {
      return {
        message: PASSWORD_RESET_GENERIC_MESSAGE,
        devCode: code,
      };
    }
    return { message: PASSWORD_RESET_GENERIC_MESSAGE };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<PasswordUpdateResult> {
    const { email, code, newPassword } = resetPasswordDto;
    const key = this.resetKey(email);
    const record = await this.redis.getJson<PasswordResetRecord>(key);

    if (!record?.codeHash) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    const codeMatches = await bcrypt.compare(code, record.codeHash);
    if (!codeMatches) {
      await this.registerFailedAttempt(key, record);
      throw new BadRequestException('Invalid or expired reset code');
    }

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      await this.redis.del(key);
      throw new BadRequestException('Invalid or expired reset code');
    }

    const result = await this.applyNewPassword(
      user,
      newPassword,
      'Password reset successfully',
    );

    await this.redis.del(key);
    return result;
  }

  /**
   * Write the new bcrypt hash to the local DB (throw on failure), then mirror
   * to Auth0 when the row carries an externalId. Auth0 failures do not roll
   * back the DB or throw; they are logged and reported via auth0Synced=false.
   */
  private async applyNewPassword(
    user: PasswordUserRow,
    newPassword: string,
    message: string,
  ): Promise<PasswordUpdateResult> {
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    const { prisma } = this.databaseService.getPrisma();
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: passwordHash },
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new BadRequestException(
        `Failed to update password in the local store: ${errorMessage}`,
      );
    }

    if (!user.externalId) {
      // Local-only account: nothing to mirror, the DB update completed the job.
      return { message, auth0Synced: true };
    }

    try {
      await this.auth0Service.updateUser(user.externalId, {
        password: newPassword,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Password updated in DB for ${user.email} but Auth0 sync failed: ${errorMessage}`,
      );
      return { message, auth0Synced: false, auth0SyncError: errorMessage };
    }

    return { message, auth0Synced: true };
  }

  private async registerFailedAttempt(
    key: string,
    record: PasswordResetRecord,
  ): Promise<void> {
    const attempts = record.attempts + 1;
    if (attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
      await this.redis.del(key);
      return;
    }
    const remainingTtl = await this.redis.ttl(key);
    await this.redis.setJson(
      key,
      { codeHash: record.codeHash, attempts } satisfies PasswordResetRecord,
      remainingTtl > 0 ? remainingTtl : undefined,
    );
  }

  /**
   * Revoke every active session of the user except the one carrying the
   * current bearer token. SessionService exposes no revokeAllForUser, so this
   * iterates the active sessions; failures are logged and skipped (the
   * password itself is already rotated in both stores).
   */
  private async invalidateOtherSessions(
    userId: string,
    currentToken: string,
  ): Promise<void> {
    try {
      const sessions =
        await this.sessionService.getActiveSessionsByUser(userId);
      for (const session of sessions) {
        if (session.token === currentToken) {
          continue;
        }
        await this.sessionService.revokeSession(session.id);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Session invalidation skipped for user ${userId}: ${errorMessage}`,
      );
    }
  }

  private resetKey(email: string): string {
    return `pwdreset:${email}`;
  }

  private getUserPermissions(role: string): string[] {
    return ROLE_PERMISSIONS[role as Role] || [];
  }
}
