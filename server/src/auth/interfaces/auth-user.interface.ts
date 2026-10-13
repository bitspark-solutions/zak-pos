import type { Request } from 'express';

/**
 * Decoded JWT payload issued by AuthService/AuthController.
 * `sub` is the local DB user id; shopId/auth0Id are optional context claims.
 * `type` is only ever set on CUSTOMER tokens ('customer'); the staff strategy
 * must reject those so the staff and customer audiences are never
 * interchangeable (see CustomerJwtStrategy for the counterpart).
 */
export interface TokenPayload {
  sub: string;
  email: string;
  tenantId: string;
  role: string;
  shopId?: string;
  auth0Id?: string;
  permissions?: string[];
  type?: string;
}

/**
 * User object attached to the request by JwtStrategy#validate after the
 * DB re-read (source of truth for tenant/role/status).
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  role: string;
  permissions: string[];
}

/**
 * Express Request narrowed at the auth boundary: routes guarded by
 * JwtAuthGuard always have `user` attached by passport.
 */
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
