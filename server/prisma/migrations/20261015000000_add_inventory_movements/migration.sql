-- Backfill: schema.prisma model InventoryMovement (@@map "inventory_movements")
-- had no creating migration - it only existed on databases built via
-- `prisma db push`. Without this, `prisma migrate deploy` on a fresh clone
-- produces a DB that the inventory service cannot write movements to, and
-- the earlier RLS migration referenced a table that never existed.
--
-- Idempotent by design: on already-running databases (where the table came
-- from db push) every statement is a no-op.

CREATE TABLE IF NOT EXISTS "public"."inventory_movements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "movementType" TEXT NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL,
    "unitCost" DECIMAL(15,2),
    "referenceType" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_movements_tenantId_fkey'
  ) THEN
    ALTER TABLE "public"."inventory_movements"
      ADD CONSTRAINT "inventory_movements_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- Index used by the movements listing query (shop + product, newest first).

-- RLS + grants for the new table, mirroring 20261012100000_add_tenant_rls.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'inventory_movements'
      AND policyname = 'inventory_movements_tenant_isolation'
  ) THEN
    ALTER TABLE "public"."inventory_movements" ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "inventory_movements_tenant_isolation" ON "public"."inventory_movements"
      USING ("tenantId" = app_tenant_id())
      WITH CHECK ("tenantId" = app_tenant_id());
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zakpos_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON "public"."inventory_movements" TO "zakpos_app";
  END IF;
END
$$;
