/** DI token for the env-gated OTP delivery provider (CUSTOMER_OTP_PROVIDER). */
export const CUSTOMER_OTP_PROVIDER = 'CUSTOMER_OTP_PROVIDER';

/**
 * Delivery abstraction for customer phone-OTP codes. Selection is env-gated:
 * `CUSTOMER_OTP_PROVIDER=mock` (default, local/dev) or `auth0` (Auth0
 * passwordless SMS). Code storage/verification lives in CustomerAuthService
 * (short-lived Redis records); providers only DELIVER a generated code.
 */
export interface CustomerOtpProvider {
  /** Provider id, e.g. 'mock' | 'auth0' (used for dev-echo gating in specs). */
  readonly name: string;
  sendOtp(phone: string, code: string): Promise<void>;
}
