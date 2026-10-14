# Zak POS

**Your shop, in your pocket.** A multi-tenant, web + mobile point-of-sale for small retail shops — camera/barcode scanning, OCR catalog & supplier-receipt import, PDF thermal receipts, and server-confirmed checkout, with PostgreSQL row-level-security tenancy under the hood.

Built for shopkeepers (BD-flavored out of the box: BDT pricing, bKash/Nagad payment methods) and for developers who want to see a serious NestJS + Prisma multi-tenant monorepo done properly.

## Features

Verified in code and tests on this repo — everything below ships in the API/client/mobile builds:

- **Multi-tenant by construction** — single PostgreSQL 17 with row-level security; tenant scope is set per-transaction (`set_config('app.tenant_id', …)`), and every service threads the tenant through guards.
- **Dual auth** — local DB (bcrypt) as source of truth with an optional Auth0 mirror; Redis-backed sessions, device tracking, role-based access (owner / manager / cashier) with fine-grained permissions, staff invitations.
- **Barcode-first catalog** — scan lookup (`GET /products/barcode/:code`), attach extra barcodes to a product, and *create a product from a scanned barcode in one API call*.
- **Server-owned carts & accounting sales** — `POST /sales/commit` runs stock deduction, journal postings, payment rows (cash / card / bKash / Nagad / bank transfer) and cash-session context in one transaction; refunds included.
- **PDF receipts** — 80 mm thermal-slip PDFs generated in-process (pdfkit) for sales and invoices; shareable straight from the mobile app.
- **OCR import** — FastAPI microservice (TrOCR + tesseract): photograph a price list or supplier receipt → preview → commit products or draft purchases; CSV/spreadsheet import shares the same pipeline.
- **Web POS parity** — webcam barcode scanning (html5-qrcode), manual add, cart, cash tender & change, checkout.
- **Mobile POS (Expo / React Native)** — continuous camera scan with haptics+beep, unknown-code "add this product" flow (server-verified six-step save), keypad checkout, receipt PDF sharing.
- **Global customer platform** — customers get their own login (distinct from tenant staff) and staff can attach a sale to them.
- **Reports & forecasting** — dashboards with charts, a natural-language "ask" box over an untrusted-plan-whitelist LLM client, and demand forecasting.
- **One-command stack** — `docker compose up` boots Postgres, Redis, NestJS API, Next.js web, and the OCR service.

## Architecture

```text
Expo app ──┐
           ├──► NestJS API :39847 (/api/v1) ──► PostgreSQL 17 (RLS tenancy)
Next.js ───┘         │        ▲
  web :41923         │        └── Auth0 (optional mirror) + Redis sessions :46392
                     └───────► FastAPI OCR :58000  (trocr-small + tesseract, X-API-Key)

PDF receipts render in-process (pdfkit, 80 mm thermal slip).
```

| Service  | Tech                                             | Port  |
|----------|--------------------------------------------------|-------|
| API      | NestJS 11, TypeScript, Prisma 6                  | 39847 |
| Web      | Next.js 15, React 19, zustand, html5-qrcode      | 41923 |
| Postgres | PostgreSQL 17 (RLS, `init.sql` roles)            | 47821 |
| Redis    | Redis 7 (sessions)                               | 46392 |
| OCR      | FastAPI, transformers (trocr-small), tesseract   | 58000 |

```text
/
├── server/        NestJS API — 18 modules, Prisma schema + migrations
├── client/        Next.js back office + web POS
├── mobile-app/    Expo (React Native) camera-scan POS
├── services/ocr/  FastAPI OCR microservice
├── docker/        postgres/redis config + init SQL
├── scripts/       gen-or-copy-env.sh · seed-demo.sh · verify-all.sh
└── .env.example   full documented environment template
```

## Quickstart (clean clone)

Prerequisites: Docker (with the Compose v2 plugin) and Node ≥ 22 for the tooling scripts. On Windows, run the shell scripts from Git Bash.

```bash
git clone https://github.com/bitspark-solutions/zak-pos.git
cd zak-pos

# 1. Create server/.env (random JWT_SECRET generated from .env.example)
./scripts/gen-or-copy-env.sh

# 2. Build & boot the whole stack
docker compose up -d --build

# 3. Load demo data (tenant, store, categories, barcoded products, stock)
./scripts/seed-demo.sh

# 4. Sign in at http://localhost:41923
#    email:    owner@demo.zakpos.test
#    password: demo12345
```

Open **POS** in the sidebar, scan (or type) barcode `8901234567890` — *Sugar 1kg* lands in the cart. Checkout mints an 80 mm PDF receipt. The first OCR container boot downloads the TrOCR model, so give it a few minutes (`start_period` 300 s); everything else is healthy well before that.

The API boots with `prisma migrate deploy`, so a fresh Postgres volume is schema-complete automatically.

### Mobile app

```bash
cd mobile-app
npm install
npx expo start
```

- **Android emulator:** the app defaults to `10.0.2.2:39847` (host loopback alias) — no config needed if the stack above is running.
- **Physical device on your LAN:** set `EXPO_PUBLIC_API_HOST=<your-machine-IP>` (or `EXPO_PUBLIC_API_URL=http://<ip>:39847/api/v1`) before starting — e.g. put it in `mobile-app/.env.local`.
- Sign in with the same demo credentials. The POS tab scans real barcodes with the camera; unknown codes offer *add this product*, which creates the product, sets opening stock, and puts it in the cart — all server-verified. Receipts share as PDF.

## Tests & verification

`scripts/verify-all.sh` reproduces the full gate in one command (unit lanes + a compose build/health smoke; exits nonzero on any real failure):

```bash
./scripts/verify-all.sh
# lanes: prisma generate → server jest → client jest → OCR pytest (needs
# python 3.11; clearly SKIPs with a reason otherwise) → compose up --build +
# curl health for api/web/ocr.  Flags: --skip-compose --skip-ocr …
```

Current verified counts — **660 tests green** (run 2026-10-15 on this branch with `npm ci` + `prisma generate`; `scripts/verify-all.sh` reproduces them):

| Lane    | Suites | Tests |
|---------|--------|-------|
| server  | 45     | 490   |
| client  | 9      | 73    |
| ocr     | —      | 97    |

Notes, stated honestly: server e2e specs (`test/*.e2e-spec.ts`) require a live database and are excluded from the default lane; the mobile app has 4 jest specs runnable via `npx jest` in `mobile-app/` but they are not yet part of `verify-all`. CI exists (`.github/workflows/ci.yml`) but runs **on-demand only** (`workflow_dispatch`) by maintainer policy — `verify-all.sh` is the reproducible verification story.

## Configuration

Every variable the API and compose stack consume is documented in **[.env.example](.env.example)** — copy-and-edit is not the flow: `./scripts/gen-or-copy-env.sh` generates `server/.env` with a random `JWT_SECRET`.

The server **refuses to boot** if `JWT_SECRET` is missing/empty, or if `AUTH0_DOMAIN`/`AUTH0_CLIENT_ID` are configured without `AUTH0_SECRET` — there are no fallback secrets anywhere in the codebase (Auth0 itself stays fully optional; unset means local-only login).

The compose file is a **development** stack: DB/Redis passwords and published ports are dev conveniences documented there — replace them (and pull the ports off the host) before exposing anything.

## License

MIT — see [LICENSE](LICENSE).
