-- Multi-tenant row-level security for zakpos_app runtime role.
-- Design:
--   * Helper function app_tenant_id() reads the per-connection GUC app.tenant_id.
--   * 23 direct-tenant tables are isolated via a "tenantId" equality policy.
--   * tenants is isolated on its own id (self row).
--   * 12 child tables are isolated via parent-EXISTS chains.
--   * No FORCE ROW LEVEL SECURITY: the table owner (admin client) intentionally bypasses RLS.

-- 1. Helper function -------------------------------------------------------
CREATE OR REPLACE FUNCTION app_tenant_id() RETURNS text LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')
$$;

-- 2. Direct-tenant tables: ENABLE RLS + tenant_isolation policy ------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'user_tenants', 'devices', 'accounts', 'taxes', 'journals',
    'customers', 'suppliers', 'customer_ledger', 'supplier_ledger',
    'categories', 'products', 'shops', 'inventory_movements',
    'sales', 'sale_lines', 'payments', 'invoices',
    'store_credits', 'gift_cards', 'promotions', 'events', 'audit_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I USING ("tenantId" = app_tenant_id()) WITH CHECK ("tenantId" = app_tenant_id())',
      t || '_tenant_isolation', t
    );
  END LOOP;
END
$$;

-- 3. tenants: only the current tenant row ----------------------------------
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenants_self ON public.tenants
  USING (id = app_tenant_id())
  WITH CHECK (id = app_tenant_id());

-- 4. Child tables: parent-EXISTS policies -----------------------------------
-- sessions -> devices
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_tenant_isolation ON public.sessions
  USING (EXISTS (
    SELECT 1 FROM devices d
    WHERE d.id = sessions."deviceId" AND d."tenantId" = app_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM devices d
    WHERE d.id = sessions."deviceId" AND d."tenantId" = app_tenant_id()
  ));

-- product_variants / barcodes / batches -> products
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_variants_tenant_isolation ON public.product_variants
  USING (EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = product_variants."productId" AND p."tenantId" = app_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = product_variants."productId" AND p."tenantId" = app_tenant_id()
  ));

ALTER TABLE public.barcodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY barcodes_tenant_isolation ON public.barcodes
  USING (EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = barcodes."productId" AND p."tenantId" = app_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = barcodes."productId" AND p."tenantId" = app_tenant_id()
  ));

ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY batches_tenant_isolation ON public.batches
  USING (EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = batches."productId" AND p."tenantId" = app_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = batches."productId" AND p."tenantId" = app_tenant_id()
  ));

-- journal_lines -> journals, and WITH CHECK additionally validates the account
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY journal_lines_tenant_isolation ON public.journal_lines
  USING (EXISTS (
    SELECT 1 FROM journals j
    WHERE j.id = journal_lines."journalId" AND j."tenantId" = app_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM journals j
    WHERE j.id = journal_lines."journalId" AND j."tenantId" = app_tenant_id()
  ) AND EXISTS (
    SELECT 1 FROM accounts a
    WHERE a.id = journal_lines."accountId" AND a."tenantId" = app_tenant_id()
  ));

-- inventory / purchases / cash_sessions -> shops
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_tenant_isolation ON public.inventory
  USING (EXISTS (
    SELECT 1 FROM shops s
    WHERE s.id = inventory."shopId" AND s."tenantId" = app_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM shops s
    WHERE s.id = inventory."shopId" AND s."tenantId" = app_tenant_id()
  ));

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchases_tenant_isolation ON public.purchases
  USING (EXISTS (
    SELECT 1 FROM shops s
    WHERE s.id = purchases."shopId" AND s."tenantId" = app_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM shops s
    WHERE s.id = purchases."shopId" AND s."tenantId" = app_tenant_id()
  ));

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY cash_sessions_tenant_isolation ON public.cash_sessions
  USING (EXISTS (
    SELECT 1 FROM shops s
    WHERE s.id = cash_sessions."shopId" AND s."tenantId" = app_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM shops s
    WHERE s.id = cash_sessions."shopId" AND s."tenantId" = app_tenant_id()
  ));

-- purchase_lines / purchase_returns -> purchases -> shops
ALTER TABLE public.purchase_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchase_lines_tenant_isolation ON public.purchase_lines
  USING (EXISTS (
    SELECT 1 FROM purchases pu
    JOIN shops sh ON sh.id = pu."shopId"
    WHERE pu.id = purchase_lines."purchaseId" AND sh."tenantId" = app_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM purchases pu
    JOIN shops sh ON sh.id = pu."shopId"
    WHERE pu.id = purchase_lines."purchaseId" AND sh."tenantId" = app_tenant_id()
  ));

ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchase_returns_tenant_isolation ON public.purchase_returns
  USING (EXISTS (
    SELECT 1 FROM purchases pu
    JOIN shops sh ON sh.id = pu."shopId"
    WHERE pu.id = purchase_returns."purchaseId" AND sh."tenantId" = app_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM purchases pu
    JOIN shops sh ON sh.id = pu."shopId"
    WHERE pu.id = purchase_returns."purchaseId" AND sh."tenantId" = app_tenant_id()
  ));

-- returns -> sales
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY returns_tenant_isolation ON public.returns
  USING (EXISTS (
    SELECT 1 FROM sales sa
    WHERE sa.id = returns."saleId" AND sa."tenantId" = app_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM sales sa
    WHERE sa.id = returns."saleId" AND sa."tenantId" = app_tenant_id()
  ));

-- cash_movements -> cash_sessions -> shops
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY cash_movements_tenant_isolation ON public.cash_movements
  USING (EXISTS (
    SELECT 1 FROM cash_sessions cs
    JOIN shops sh ON sh.id = cs."shopId"
    WHERE cs.id = cash_movements."cashSessionId" AND sh."tenantId" = app_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM cash_sessions cs
    JOIN shops sh ON sh.id = cs."shopId"
    WHERE cs.id = cash_movements."cashSessionId" AND sh."tenantId" = app_tenant_id()
  ));

-- 5. Grants (deny-by-default; _prisma_migrations is never granted) ----------
GRANT USAGE ON SCHEMA public TO zakpos_app;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    -- 23 direct-tenant tables
    'users', 'user_tenants', 'devices', 'accounts', 'taxes', 'journals',
    'customers', 'suppliers', 'customer_ledger', 'supplier_ledger',
    'categories', 'products', 'shops', 'inventory_movements',
    'sales', 'sale_lines', 'payments', 'invoices',
    'store_credits', 'gift_cards', 'promotions', 'events', 'audit_logs',
    -- tenants
    'tenants',
    -- 12 child tables
    'sessions', 'product_variants', 'barcodes', 'batches', 'journal_lines',
    'inventory', 'purchases', 'cash_sessions', 'purchase_lines',
    'purchase_returns', 'returns', 'cash_movements'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO zakpos_app', t);
  END LOOP;
END
$$;

GRANT SELECT ON currencies, exchange_rates TO zakpos_app;
