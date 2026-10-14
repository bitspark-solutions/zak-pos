-- Schema reconciliation inserted BEFORE 20261012100000_add_tenant_rls.
--
-- Several objects existed only via `prisma db push` on the original
-- development database and were never captured as migrations:
--   * sales."tenantId" / sale_lines."tenantId" (RLS equality columns),
--   * inventory."quantityReserved",
--   * the whole "invoices" table + indexes + FKs.
-- Without this file, `prisma migrate deploy` from a clean clone produces a
-- schema the RLS migration cannot complete against, and the API never boots.
--
-- Timestamped 20261010 so a fresh replay applies it before the RLS
-- migration that depends on these columns. Every statement is guarded so the
-- migration is a no-op on databases where db push already created them.

ALTER TABLE "public"."inventory" ADD COLUMN IF NOT EXISTS "quantityReserved" DECIMAL(15,3) NOT NULL DEFAULT 0;

ALTER TABLE "public"."sale_lines" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;

ALTER TABLE "public"."sales" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL;

CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "saleId" TEXT,
    "customerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "dueDate" TIMESTAMP(3),
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoiceNumber_key" ON "public"."invoices"("invoiceNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_saleId_key" ON "public"."invoices"("saleId");

-- Foreign keys (guarded: IF NOT EXISTS by constraint name).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_tenantId_fkey') THEN
    ALTER TABLE "public"."sales" ADD CONSTRAINT "sales_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_lines_tenantId_fkey') THEN
    ALTER TABLE "public"."sale_lines" ADD CONSTRAINT "sale_lines_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_tenantId_fkey') THEN
    ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_shopId_fkey') THEN
    ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_shopId_fkey"
      FOREIGN KEY ("shopId") REFERENCES "public"."shops"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_saleId_fkey') THEN
    ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_saleId_fkey"
      FOREIGN KEY ("saleId") REFERENCES "public"."sales"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_customerId_fkey') THEN
    ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
