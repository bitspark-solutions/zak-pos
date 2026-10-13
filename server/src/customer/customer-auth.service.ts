import { randomInt } from 'crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { Auth0Service, type Auth0UserInfo } from '../auth/auth0.service';
import { auth0Config } from '../auth/auth0.config';
import {
  CUSTOMER_OTP_PROVIDER,
  type CustomerOtpProvider,
} from './otp/customer-otp-provider.interface';
import type {
  CustomerLoginResult,
  CustomerTokenPayload,
  ICustomerProfile,
} from './interfaces/customer.interface';

/** Redis record stored under `custotp:<phone>` by request-otp (mirrors pwdreset:<email>). */
interface CustomerOtpRecord {
  codeHash: string;
  attempts: number;
}

const OTP_TTL_SECONDS = 5 * 60;
const OTP_MAX_ATTEMPTS = 5;
const BCRYPT_SALT_ROUNDS = 10;

/**
 * Customer-side authentication: phone OTP + social (Auth0) + profile.
 *
 * Every write targets CustomerAccount — the GLOBAL identity table with no
 * tenantId — so it always goes through the admin (RLS-bypassing) client, the
 * same sanctioned path staff auth uses (login/register/JwtStrategy).
 */
@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger(CustomerAuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly databaseService: DatabaseService,
    private readonly redis: RedisService,
    private readonly auth0Service: Auth0Service,
    @Inject(CUSTOMER_OTP_PROVIDER)
    private readonly otpProvider: CustomerOtpProvider,
  ) {}

  // ---------------------------------------------------------------------------
  // Phone OTP
  // ---------------------------------------------------------------------------

  async requestOtp(
    phone: string,
  ): Promise<{ message: string; devCode?: string }> {
    const normalized = phone.trim();
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = await bcrypt.hash(code, BCRYPT_SALT_ROUNDS);
    await this.redis.setJson(
      this.otpKey(normalized),
      { codeHash, attempts: 0 } satisfies CustomerOtpRecord,
      OTP_TTL_SECONDS,
    );

    try {
      await this.otpProvider.sendOtp(normalized, code);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `OTP delivery failed via ${this.otpProvider.name}: ${message}`,
      );
      await this.redis.del(this.otpKey(normalized));
      throw new InternalServerErrorException(
        'Failed to send the verification code',
      );
    }

    // Never echo the code in production; outside production the mock provider
    // (and E2E runs against it) return it so flows can be completed without a
    // real SMS gateway.
    if (
      process.env.NODE_ENV !== 'production' &&
      this.otpProvider.name === 'mock'
    ) {
      return {
        message:
          'Verification code sent. Check the server logs for the mock code.',
        devCode: code,
      };
    }
    return { message: 'Verification code sent.' };
  }

  async verifyOtp(phone: string, code: string): Promise<CustomerLoginResult> {
    const normalized = phone.trim();
    const key = this.otpKey(normalized);
    const record = await this.redis.getJson<CustomerOtpRecord>(key);

    if (!record?.codeHash) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const codeMatches = await bcrypt.compare(code, record.codeHash);
    if (!codeMatches) {
      await this.registerFailedAttempt(key, record);
      throw new UnauthorizedException('Invalid or expired code');
    }
    await this.redis.del(key);

    // Phone possession just proved itself: create-or-update the global account
    // and stamp phoneVerifiedAt (the gate for invoice auto-sharing).
    const { prisma } = this.databaseService.getPrisma();
    const existing = await prisma.customerAccount.findUnique({
      where: { phone: normalized },
    });
    const account = existing
      ? await prisma.customerAccount.update({
          where: { id: existing.id },
          data: { phoneVerifiedAt: new Date() },
        })
      : await prisma.customerAccount.create({
          data: {
            phone: normalized,
            // No name source before the customer completes a profile; the
            // phone doubles as the display name until a social login or later
            // profile edit supplies one.
            name: normalized,
            phoneVerifiedAt: new Date(),
          },
        });

    return this.issueLogin(account);
  }

  // ---------------------------------------------------------------------------
  // Social (Auth0) login
  // ---------------------------------------------------------------------------

  /**
   * Exchanges an Auth0 access token (Google/Apple/phone connection) for a
   * customer JWT by verifying it against Auth0 /userinfo — the same
   * verification pattern staff Auth0 login uses (auth.service.validateUser).
   */
  async socialLogin(accessToken: string): Promise<CustomerLoginResult> {
    if (!auth0Config.domain || !auth0Config.clientId) {
      throw new BadRequestException(
        'Social login is not configured on this server (AUTH0_DOMAIN/AUTH0_CLIENT_ID)',
      );
    }

    const userInfo = await this.verifySocialToken(accessToken);

    const { prisma } = this.databaseService.getPrisma();
    const existing = await prisma.customerAccount.findUnique({
      where: { auth0UserId: userInfo.sub },
    });
    const account = existing
      ? await prisma.customerAccount.update({
          where: { id: existing.id },
          data: {
            name: userInfo.name ?? userInfo.nickname ?? existing.name,
            email: userInfo.email ?? existing.email,
            photoUrl: userInfo.picture ?? existing.photoUrl,
          },
        })
      : await prisma.customerAccount.create({
          data: {
            auth0UserId: userInfo.sub,
            name: userInfo.name ?? userInfo.nickname ?? 'Customer',
            email: userInfo.email ?? null,
            photoUrl: userInfo.picture ?? null,
          },
        });

    return this.issueLogin(account);
  }

  /** Verifies an Auth0 access token via /userinfo; any failure -> 401. */
  private async verifySocialToken(accessToken: string): Promise<Auth0UserInfo> {
    let userInfo: Auth0UserInfo;
    try {
      userInfo = await this.auth0Service.getUserInfo(accessToken);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Customer social login rejected: ${message}`);
      throw new UnauthorizedException('Invalid social login token');
    }
    if (!userInfo.sub) {
      throw new UnauthorizedException('Invalid social login token');
    }
    return userInfo;
  }

  // ---------------------------------------------------------------------------
  // Profile
  // ---------------------------------------------------------------------------

  async me(accountId: string): Promise<ICustomerProfile> {
    const account = await this.databaseService
      .getPrisma()
      .prisma.customerAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      throw new UnauthorizedException('Customer account no longer exists');
    }
    return this.mapProfile(account);
  }

  // ---------------------------------------------------------------------------

  /** Customer JWT: { sub, type:'customer', audience:'customer' } — no tenant/role. */
  private issueLogin(account: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    photoUrl: string | null;
    phoneVerifiedAt: Date | null;
    createdAt: Date;
  }): CustomerLoginResult {
    const payload: Omit<CustomerTokenPayload, 'iat' | 'exp'> = {
      sub: account.id,
      type: 'customer',
      audience: 'customer',
    };
    return {
      access_token: this.jwtService.sign(payload, {
        expiresIn: (process.env.CUSTOMER_JWT_EXPIRES_IN ||
          '30d') as JwtSignOptions['expiresIn'],
      }),
      account: this.mapProfile(account),
    };
  }

  private mapProfile(account: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    photoUrl: string | null;
    phoneVerifiedAt: Date | null;
    createdAt: Date;
  }): ICustomerProfile {
    return {
      id: account.id,
      name: account.name,
      phone: account.phone,
      email: account.email,
      photoUrl: account.photoUrl,
      phoneVerifiedAt: account.phoneVerifiedAt,
      createdAt: account.createdAt,
    };
  }

  private otpKey(phone: string): string {
    return `custotp:${phone}`;
  }

  private async registerFailedAttempt(
    key: string,
    record: CustomerOtpRecord,
  ): Promise<void> {
    const attempts = record.attempts + 1;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      await this.redis.del(key);
      return;
    }
    const remainingTtl = await this.redis.ttl(key);
    await this.redis.setJson(
      key,
      { codeHash: record.codeHash, attempts } satisfies CustomerOtpRecord,
      remainingTtl > 0 ? remainingTtl : undefined,
    );
  }
}
