-- Phase G2a: customer platform (global CustomerAccount identity + tenant-scoped follows + invoice share axis).
-- Purely ADDITIVE: the tenant-scoped `customers` model is untouched except for one nullable link column.
-- Design notes:
--   * customer_accounts is NOT tenant-scoped: no RLS policy, and the only grant for
--     zakpos_app is SELECT — required so Postgres can run the foreign-key existence
--     check when the tenant-scoped client writes customers."accountId" or
--     customer_follows."accountId". Reads/writes of the row itself go through the
--     admin (RLS-bypassing) client.
--   * customer_follows IS tenant-scoped: it mirrors the direct-tenantId policy style
--     of 20261012100000_add_tenant_rls (equality on "tenantId" = app_tenant_id()).

-- 1. Global customer identity ----------------------------------------------
CREATE TABLE "customer_accounts" (
    "id" TEXT NOT NULL,
    "auth0UserId" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_accounts_pkey" PRIMARY KEY ("id")
);

-- Unique only where present: Postgres permits many NULLs, so social-only
-- accounts without a phone (and phone-only accounts without Auth0) coexist.
CREATE UNIQUE INDEX "customer_accounts_auth0UserId_key" ON "customer_accounts"("auth0UserId");
CREATE UNIQUE INDEX "customer_accounts_phone_key" ON "customer_accounts"("phone");

-- 2. Per-tenant link column -------------------------------------------------
ALTER TABLE "customers" ADD COLUMN     "accountId" TEXT;

ALTER TABLE "customers" ADD CONSTRAINT "customers_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "customer_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Tenant-scoped follow rows ----------------------------------------------
CREATE TABLE "customer_follows" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_follows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_follows_accountId_tenantId_key" ON "customer_follows"("accountId", "tenantId");

ALTER TABLE "customer_follows" ADD CONSTRAINT "customer_follows_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "customer_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_follows" ADD CONSTRAINT "customer_follows_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Invoice portal-share axis ---------------------------------------------
ALTER TABLE "invoices" ADD COLUMN     "sharedAt" TIMESTAMP(3);

-- 5. RLS for the new direct-tenantId table (same style as add_tenant_rls) ---
ALTER TABLE public.customer_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_follows_tenant_isolation ON public.customer_follows
  USING ("tenantId" = app_tenant_id())
  WITH CHECK ("tenantId" = app_tenant_id());

-- 6. Grants (deny-by-default otherwise) --------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_follows TO zakpos_app;
GRANT SELECT ON public.customer_accounts TO zakpos_app;
