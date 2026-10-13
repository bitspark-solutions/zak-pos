/**
 * Shapes for the G2a customer platform (server side).
 *
 * Two distinct notions of "customer", deliberately kept apart:
 *  - ICustomerContact  — the TENANT-scoped POS contact row (existing `Customer`
 *    model, table `customers`), optionally linked to a global account.
 *  - ICustomerProfile  — the GLOBAL identity (`CustomerAccount`) that a
 *    customer uses to log in on their own device.
 */
export interface ICustomerContact {
  id: string;
  tenantId: string;
  accountId: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  createdAt: Date;
}

export interface ICustomerProfile {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  photoUrl: string | null;
  phoneVerifiedAt: Date | null;
  createdAt: Date;
}

/** Minimal safe projection of a business for the pre-follow QR scan screen. */
export interface IPublicBusiness {
  id: string;
  name: string;
}

export interface ICustomerFollowSummary {
  tenantId: string;
  businessName: string;
  source: string;
  followedAt: Date;
}

/** Invoice projection exposed to the customer portal (shared invoices only). */
export interface ICustomerPortalInvoice {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  businessName: string;
  shopName: string;
  status: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  dueDate: Date | null;
  sharedAt: Date | null;
  createdAt: Date;
}

/**
 * Customer JWT claims. NO tenantId/role/permissions: the customer audience is
 * separate from the staff audience and both strategies reject the other's
 * tokens (mutual rejection via `type`).
 */
export interface CustomerTokenPayload {
  sub: string;
  type: 'customer';
  audience: 'customer';
  iat?: number;
  exp?: number;
}

/** Request user attached by CustomerJwtStrategy after the DB re-read. */
export interface CustomerAuthUser {
  id: string;
  type: 'customer';
  name: string;
  phone: string | null;
  email: string | null;
}

/** Result of a successful OTP/social login. */
export interface CustomerLoginResult {
  access_token: string;
  account: ICustomerProfile;
}
