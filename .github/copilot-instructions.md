# Project Guidelines

## Code Style
Follow TypeScript best practices. Reference [server/src/auth/auth.module.ts](server/src/auth/auth.module.ts) for NestJS module patterns, [client/src/contexts/AuthContext.tsx](client/src/contexts/AuthContext.tsx) for React Context usage.

## Architecture
ZakPOS is a multi-tenant SaaS POS system with online-only operations. Backend uses NestJS modular monolith with 10 feature modules. Frontend is Next.js 15 with App Router. Mobile app uses Expo. Database is PostgreSQL with Row-Level Security for multi-tenancy. See [.plan/final_plan.md](.plan/final_plan.md) for detailed architecture.

## Build and Test
- `make dev`: Start all services locally
- `make test`: Run all tests (unit, e2e, performance)
- `make test:unit`: Run unit tests only
- `make db-reset`: Reset database (caution: wipes data)

Agents will attempt to run these commands automatically.

## Conventions
- Module pattern: Controller → Service → DTO → Prisma entity
- Route groups: Use `(auth)` and `(dashboard)` in Next.js; `(auth)` and `(tabs)` in mobile
- Guards: Apply `JwtAuthGuard`, `RolesGuard`, `TenantScopeGuard` globally
- Validation: Use `class-validator` in NestJS, Zod in Next.js
- Hybrid auth: Auth0 primary, local JWT fallback
- Accounting-first: Immutable journal postings for financial transactions

See [docs/ui-documentation/](docs/ui-documentation/) for UI specifications.