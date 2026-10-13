import { Injectable, Logger } from '@nestjs/common';
import type { CustomerOtpProvider } from './customer-otp-provider.interface';

/**
 * Default provider for local/dev. The code is echoed to the server log ONLY
 * when NODE_ENV != 'production'; in production this provider refuses to send
 * (fail-closed) so a misconfigured deployment can never silently ship OTPs to
 * a no-op transport — set CUSTOMER_OTP_PROVIDER=auth0 in real environments.
 */
@Injectable()
export class MockCustomerOtpProvider implements CustomerOtpProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockCustomerOtpProvider.name);

  sendOtp(phone: string, code: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      this.logger.error(
        `MockCustomerOtpProvider called in production for ${phone} - refusing to pretend an SMS was sent`,
      );
      throw new Error('OTP delivery is not configured');
    }
    this.logger.log(`[mock OTP] code ${code} for ${phone}`);
    return Promise.resolve();
  }
}
