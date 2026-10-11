/**
 * Persisted shape of a tenant invitation. There is no Invitation model in the
 * Prisma schema (nor a matching migration), so invitations live in Redis under
 * `invite:<token>` with a per-tenant token index at `invites:<tenantId>`, each
 * key carrying a 7-day TTL. This record is the single source of truth for the
 * verify / register-with-token flows — it snapshots the tenant name at creation
 * time so the public verify endpoint needs no DB round-trip.
 */
export interface InvitationRecord {
  token: string;
  tenantId: string;
  tenantName: string;
  email: string;
  role: string;
  shopId: string | null;
  invitedBy: string;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of expiry (creation + TTL). */
  expiresAt: string;
}

/** Body of POST /invitations. `token` is echoed back only in development. */
export interface CreatedInvitation {
  token?: string;
  email: string;
  role: string;
  shopId: string | null;
  tenantName: string;
  inviteUrl: string;
  expiresAt: string;
}

/** Row of GET /invitations (pending invitations for the caller's tenant). */
export interface InvitationListItem {
  token: string;
  email: string;
  role: string;
  shopId: string | null;
  createdAt: string;
  expiresAt: string;
  /** Remaining seconds until expiry (Redis TTL). */
  expiresIn: number;
  inviteUrl: string;
}

/** Body of the public GET /invitations/verify endpoint. */
export interface VerifyInvitationResult {
  valid: boolean;
  tenantName?: string;
  role?: string;
  email?: string;
}
