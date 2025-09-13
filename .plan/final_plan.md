Scope and principles
Core goals: Fast online POS, accurate inventory, rigorous accounting, multi-tenant SaaS.

Design stance: Provider-agnostic auth, modular domains, single database with strict tenant isolation, event-driven postings.

Performance targets: p95 line-add <100 ms UI add and <300 ms server confirm on mid-range Android with 4G; end-to-end sale commit <1.2 s.

Extensibility: Clear service boundaries, optional microservice split later; adapters for identity and payments.

Auditability: Double-entry accounting; immutable event logs for inventory, cash, and payments.

Commercial control: No offline checkout; checkout requires live server confirmation to ensure integrity and enforce subscriptions.

System overview
Platforms: Android-first mobile app (checkout), web backoffice (setup, inventory, accounting, reports).

Capabilities: Camera barcode scanning (local decode, server verify), catalog with variants, purchasing/AP, sales and returns, cash sessions, store credit/gift cards, VAT, receipts/labels, real-time inventory and pricing, robust reporting.

Primary stack: NestJS API + workers (Node 20+), PostgreSQL + RLS, Redis, Next.js web (App Router), React Native/Expo mobile, OpenTelemetry, Docker + Compose/IaC.

Architecture
High-level components
Mobile app: React Native/Expo; camera scanning with local barcode decode, server-driven product/pricing/stock; BLE ESC/POS printing; thin client with ephemeral cache only.

Web backoffice: Next.js (SSR/ISR); admin for catalog, inventory, purchasing, accounting, reports.

Backend API and workers: NestJS modular monolith; REST + OpenAPI; outbox; workers for postings, receipts, imports, reconciliation.

Database: PostgreSQL (single-DB, multi-tenant with TenantId and RLS); targeted indexes; partitioning-ready for high-volume tables.

Cache and queues: Redis (BullMQ) for carts, sessions, hot lookups, background jobs; optional Kafka later.

Storage: S3-compatible object storage for PDFs, exports, backups.

Observability: OpenTelemetry, Prometheus metrics, Loki + Sentry.

Edge and latency: Nginx/Traefik reverse proxy; optional CDN for static assets; read replicas for reports; pgbouncer for pooling.

Online-only implications
No local DB or offline mutation queue.

Server-owned carts: Every sale operates on a server-side cart keyed by a session token; the client shows an optimistic preview but waits for server confirmation before tender.

Connectivity policy: If the device loses connectivity, checkout is blocked; the UI shows a reconnect prompt. Manual price entry still hits the server to create/update the cart, otherwise it’s disallowed.

Stock integrity: All stock checks and inventory deductions occur server-side on commit; line additions perform availability checks and pricing rules centrally.

Auth, tenancy, and RBAC (provider-agnostic)
Tenancy model: Single database; TenantId discriminator; RLS policies.

Auth: Built-in OAuth 2.1/PKCE + JWT by default; optional IAuthProvider adapters (Auth0).

RBAC: Roles (Owner, Manager, Cashier) + fine-grained permissions; enforced on server via guards.

Device trust: Device registration, remote revoke, per-device cashier PIN, rate limiting.

Core identity tables
sql
Tenants(id, name, plan, status, created_at, updated_at)
Users(id, external_id, name, phone, email, locale, status, created_at, updated_at)
UserTenants(user_id, tenant_id, role, permissions_json, created_at)

Devices(id, tenant_id, user_id, platform, model, registered_at, revoked_at)
Sessions(id, device_id, user_id, issued_at, expires_at, token_fingerprint)
NestJS enforcement
Guards: JwtAuthGuard, TenantScopeGuard, RbacGuard.

Interceptors: TenantContextInterceptor sets Postgres app.tenant_id.

Validation: class-validator/class-transformer or zod.

Accounting-first domain model
Chart of accounts, taxes, currencies
sql
Accounts(id, tenant_id, code, name, type, parent_id, currency, is_active, created_at)
Taxes(id, tenant_id, name, rate_percent, inclusive, account_collected_id, account_input_id, is_active)
Currencies(code, symbol, decimal_places)
ExchangeRates(base_code, quote_code, rate, valid_from)
Journals and postings
sql
Journals(id, tenant_id, date, description, source, reference_type, reference_id, created_by, created_at, status)
JournalLines(id, journal_id, account_id, debit, credit, currency, fx_rate, memo)
Parties and ledgers
sql
Customers(id, tenant_id, name, phone, email, tax_id, credit_limit, created_at)
Suppliers(id, tenant_id, name, phone, email, tax_id, created_at)

CustomerLedger(id, tenant_id, customer_id, date, type, reference_id, debit, credit, balance_after)
SupplierLedger(id, tenant_id, supplier_id, date, type, reference_id, debit, credit, balance_after)
Catalog, inventory, valuation
sql
Categories(id, tenant_id, parent_id, name, path)
Products(id, tenant_id, name, sku, unit, base_price, default_cost, tax_id, is_weighted, variant_group_id, is_active)
ProductVariants(id, product_id, attributes_json, barcode, price_override, cost_override)
Barcodes(id, product_id, variant_id, type, value, is_primary)

Shops(id, tenant_id, name, address, time_zone, tax_profile_id)

Inventory(id, shop_id, product_id, variant_id, quantity_on_hand, valuation_method, avg_cost, fifo_layers_json, updated_at)
Batches(id, product_id, lot_no, expiry_date, is_active)
Purchasing and returns
sql
Purchases(id, shop_id, supplier_id, status, terms, due_date, currency, fx_rate, subtotal, discount, tax, total, notes, created_at, posted_at)
PurchaseLines(id, purchase_id, product_id, variant_id, batch_id, qty, unit_cost, discount, tax_id, tax_amount, line_total)
PurchaseReturns(id, purchase_id, status, subtotal, tax, total, notes, created_at, posted_at)
Sales, payments, refunds, cash
sql
Sales(id, shop_id, customer_id, cashier_id, status, channel, subtotal, discount, tax, total, payment_status, currency, fx_rate, created_at, posted_at)
SaleLines(id, sale_id, product_id, variant_id, batch_id, qty, unit_price, discount, tax_id, tax_amount, line_total)

Payments(id, tenant_id, sale_id, supplier_id, customer_id, direction, method, amount, currency, fx_rate, reference, received_at, posted_at)

Returns(id, sale_id, status, subtotal, tax, total, refund_method, handler_id, created_at, posted_at)

CashSessions(id, shop_id, opened_by, opening_float, opened_at, closed_by, closing_total, closed_at, notes)
CashMovements(id, cash_session_id, type, amount, method, reference, created_at)
Store credit, gift cards, promotions
sql
StoreCredits(id, tenant_id, customer_id, balance, created_at)
GiftCards(id, tenant_id, code, balance, issued_at, expires_at, status)
Promotions(id, tenant_id, rules_json, start_at, end_at, status)
Events and audit
sql
Events(id, tenant_id, aggregate, aggregate_id, type, payload_json, occurred_at, outbox_status)
AuditLogs(id, tenant_id, user_id, action, entity, entity_id, timestamp, metadata_json)
Posting rules and operational flows
Sale commit
Inventory/COGS:

Posting: Debit COGS; Credit Inventory.

Revenue/Tax/Payments:

Posting: Debit Cash/Bank/AR; Credit Sales Revenue; Credit VAT Payable (exclusive) or reclass inclusive amounts.

Credit sales:

Posting: Debit AR; customer payments later clear AR.

Sale refund
Posting: Debit Sales Returns; Debit/Credit VAT Receivable/Payable; Credit Cash/Bank/Store Credit; Debit Inventory; Credit COGS.

Purchase receive and invoice
Receiving: Debit Inventory; Debit VAT Input; Credit GRNI/AP.

Invoicing: Reclass GRNI → AP.

Supplier payment
Posting: Debit AP; Credit Cash/Bank.

Cash session
Variance: Post differences to Cash Short/Over on close.

Online-only POS flow
Cart lifecycle:

Start: Client requests a server-side cart token.

Scan: Client decodes barcode locally; sends to server to resolve product, price, tax, availability; server responds with cart snapshot.

Unknown barcode: Quick-add allowed but still created server-side; permissions gate price overrides.

Locks: Optional soft-lock per cart to prevent concurrent edits.

Tender: Payment initiation only after server validates totals, taxes, promotions, stock.

Commit: Server transactionally creates sale, lines, payments, postings, and inventory deductions; prints receipt.

Connectivity policy:

If disconnected: UI blocks checkout; shows reconnect prompt and “save cart as pending” (server cannot save if offline, so pending carts exist only while connected).

Manual price entry: Allowed only via server-confirmed quick-add.

Real-time updates:

Channels: EMQX/MQTT for cart updates, price rule changes, and stock alerts.

Inventory freshness: Recent sales in other devices broadcast deltas to keep quantities current.

NestJS backend specifics
Modules
AuthModule: OAuth2/PKCE, JWT rotation, device registration; Passport strategies.

TenantModule: Tenant resolution, invites, RLS context.

CatalogModule: Products, categories, variants, barcodes, CSV import.

InventoryModule: Stock, adjustments, batches, valuation (WAVG default; FIFO optional).

PurchaseModule: Purchases, receive, invoice, returns; supplier ledger.

CartModule: Server-side carts, line operations, pricing/tax validation, concurrency.

SalesModule: Commit sales, returns, promotions.

PaymentModule: PSP adapters (bKash, Nagad, card PSP), payment intents, webhooks, reconciliation.

AccountingModule: Journals, postings engine, COA, tax engine.

DocumentsModule: Receipt PDFs (e.g., PDFKit), label printing payloads, S3 storage.

RealtimeModule: EMQX/MQTT for cart and stock updates.

ReportingModule: Sales daily, VAT, stock ledger, profit, AR/AP ledgers.

ObservabilityModule: OTel tracer, metrics, structured logs.

Libraries and patterns
ORM: Prisma (recommended) or TypeORM.

Queues: BullMQ (Redis) for receipts, postings, imports, reconciliation; DLQs.

OpenAPI: @nestjs/swagger; generate client SDKs.

Security: Helmet, CORS, rate limiter, IP allow/deny lists, CSRF for web forms if used.

Multi-tenancy and RLS
Postgres RLS: USING (tenant_id = current_setting('app.tenant_id')::uuid); set per request with SET app.tenant_id = $id.

Defense-in-depth: Repositories still filter by tenantId.

API design (online-only)
Auth and tenancy
POST /auth/otp/request

POST /auth/otp/verify

POST /auth/token/refresh

POST /devices/register

POST /sessions/revoke

GET /me

POST /tenants

POST /tenants/{id}/invite

Catalog and inventory
GET/POST /categories

GET/POST /products

POST /products/{id}/barcodes

POST /products/bulk-import

GET /inventory/stock?shopId=&productId=

POST /inventory/adjustments

GET/POST /batches

POST /transfers (Phase 2)

Carts and checkout
POST /carts — create cart and return cartToken

POST /carts/{cartToken}/lines — add/update/remove lines

GET /carts/{cartToken} — fetch cart snapshot

POST /carts/{cartToken}/price — server recalculates totals, discounts, VAT

POST /carts/{cartToken}/tender — start payment intent (bKash/Nagad/card)

POST /carts/{cartToken}/commit — finalize sale; create postings; inventory deduction

WS/SSE /realtime — cart and stock channel

Purchasing
POST /purchases (draft), /receive, /invoice

POST /purchase-returns

Sales and payments
GET /sales/{id}

POST /returns

POST /payments (sales or suppliers)

Accounting and reports
GET/POST /journals

GET /ledgers/customers/{id}

GET /ledgers/suppliers/{id}

GET /reports/sales-daily

GET /reports/stock-ledger

GET /reports/vat

GET /reports/profit

Documents
POST /receipts/{saleId}/print

GET /receipts/{saleId}.pdf

POST /labels/print

All endpoints require tenant-scoped claims and pass RLS; carts require idempotency keys per mutation.

Data constraints and indexing
Indexes:

Products: (tenant_id, barcode), (tenant_id, sku), (tenant_id, updated_at)

Inventory: (shop_id, product_id, variant_id)

Journals/Lines: (tenant_id, date), partition-ready

Uniqueness: (tenant_id, products.sku), (tenant_id, barcodes.value)

FKs: No cross-tenant cascades; soft-deletes (is_active) where needed.

Security and compliance
Transport: TLS 1.2+; HSTS; secure cookies (web).

Storage: Encryption at rest; secrets in vault; token hashing; PII minimization.

Sessions: Short-lived access tokens; refresh rotation with reuse detection; device binding.

Abuse protection: Rate limits; IP throttling; per-tenant quotas; anomaly detection on payments.

Pharmacy: Batch/expiry mandatory for configured categories; expiry alerts; batch on receipt when enabled.

Observability, reliability, backups
Metrics: Sales/sec, scan success rate, cart operation latency, commit latency, posting latency, error budgets.

Tracing: Scan → cart line add → price → tender → commit → receipt.

Logging: Tenant-aware, PII redaction, idempotency key correlation.

SLOs: p99 cart line add <300 ms; sale commit <1.2 s; payment confirm <2.5 s; error rate <0.5%.

Backups: PITR for Postgres; object storage snapshots; monthly restore drills; DR runbooks.

Printing and receipts
Thermal printers: ESC/POS 58mm/80mm via BLE; retry logic; printer capability profiles.

Receipts: Shop header, VAT reg, items, totals, payments, cashier, batch info (pharmacy), Bangla/English.

Digital: PDF (S3) and WhatsApp/SMS share links.

Labels: 40×30 mm and 25×50 mm templates; internal Code128 and price.

Mobile UX for speed (online)
Cart-first UI: Immediate cart token from server; optimistic add shows pending state until server confirms.

Unknown barcode: Quick-add dialog calls server to create item on-the-fly (permission-gated).

Weighted items: PLU keypad; server pricing by weight; optional scale integration later.

Connectivity prompts: If network drops, disable tender; “Recheck connection” action; show time since last server response.

Reporting
Daily sales: Totals, tenders, discounts, refunds, net revenue.

Stock ledger: Opening, purchases, sales, adjustments, closing per product/shop.

Supplier ledger: Invoices, payments, returns, aging.

Customer ledger: Credit sales, payments, returns, store credit.

Profit summary: Revenue, COGS, gross profit.

VAT report: Output, input, net payable; CSV/PDF export.

Implementation milestones
Phase 0: Foundations (online)
Auth/RBAC: OAuth2/PKCE, JWT rotation, device registration; guards and permissions.

Tenancy/RLS: Policies; isolation tests; request-scoped tenant context.

Catalog/Inventory: Products, categories, barcodes; adjustments; low-stock alerts.

Cart and Sales: Server-side cart API; line ops; pricing and VAT; commit sales; receipts (print + PDF).

Posting core: Journals/Lines; WAVG COGS; sale postings.

Observability: OTel, metrics, logs, error tracking; dashboards.

Phase 1: Depth
Purchasing/AP: Receive/invoice, GRNI, supplier ledger, AP postings.

Returns: Sales and purchase returns with reversals.

Valuation: FIFO layers optional; pharmacy batch/expiry enforcement.

Cash sessions: Open/close; short/over postings; Z/X reports.

Reports: Daily sales, stock ledger, VAT.

Phase 2: Scale and payments
Payments: bKash/Nagad, card PSP; split tenders; AR/customer payments; webhooks; reconciliation jobs.

Promotions: Rule engine; role-capped discounts; time-bound promos.

Multi-store: Transfers, central price lists, per-branch stock.

Realtime: WS/SSE channels for cart/stock; presence; device coordination.

Engineering guardrails
Contracts: OpenAPI-first; SDKs (TS/Kotlin/Swift); contract tests.

Migrations: Prisma/TypeORM migrations; backward compatible; blue/green deploys.

Testing: Unit (postings, pricing, RLS), integration (cart->commit), e2e (Playwright/Detox), load (k6/Artillery).

Feature flags: Trunk-based; gate promotions/PSPs/FIFO.

Performance budgets: p95/p99 budgets enforced in CI; synthetic cart ops.

Payment integrations (Bangladesh focus)
Wallets: bKash/Nagad collection; payment intents and callbacks; reconcile to Payments.

Cards: Local PSP; tokenized references only; no PAN storage.

Reconciliation: Daily settlement import; auto-match; exception queue for ops.

Project structure alignment
zakpos/server (NestJS): Modules defined above; BullMQ; Swagger; Prisma/TypeORM; OTel; S3 client; PDF generation.

zakpos/client (Next.js): Admin UI; auth; RBAC routes; reports; i18n (Bangla/English).

zakpos/mobile-app (Expo): Scanner, cart UI, tender, BLE printing; no offline DB; just ephemeral UI cache.

docker-compose: Postgres, Redis, Nginx, pgAdmin, S3-compatible storage (MinIO), optional Kafka.

project_plan/final_plan.md: This document as the new source of truth.