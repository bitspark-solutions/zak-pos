import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { auth0Config } from '../../auth/auth0.config';
import type { CustomerOtpProvider } from './customer-otp-provider.interface';

/**
 * Auth0 passwordless SMS delivery (`POST /passwordless/start` with
 * connection=sms, send=code). Reuses the same AUTH0_* config as staff auth.
 * Requires the Auth0 "SMS" connection with a phone provider (see README notes
 * in the G2a report): Twilio SID/token or the free Auth0 test provider (dev
 * numbers only).
 */
@Injectable()
export class Auth0CustomerOtpProvider implements CustomerOtpProvider {
  readonly name = 'auth0';
  private readonly logger = new Logger(Auth0CustomerOtpProvider.name);

  async sendOtp(phone: string, code: string): Promise<void> {
    if (
      !auth0Config.domain ||
      !auth0Config.clientId ||
      !auth0Config.clientSecret
    ) {
      throw new InternalServerErrorException(
        'Auth0 OTP provider selected but AUTH0_DOMAIN/AUTH0_CLIENT_ID/AUTH0_CLIENT_SECRET are not configured',
      );
    }

    // send=code + an explicit `code` makes Auth0 deliver OUR generated code,
    // so the value the user receives is exactly the one CustomerAuthService
    // stored (bcrypt-hashed) in Redis for verification.
    const response = await fetch(
      `https://${auth0Config.domain}/passwordless/start`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: auth0Config.clientId,
          client_secret: auth0Config.clientSecret,
          connection: 'sms',
          phone,
          send: 'code',
          code,
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(
        `Auth0 passwordless start failed (${response.status}): ${text}`,
      );
      throw new InternalServerErrorException('Failed to send OTP code');
    }
  }
}
