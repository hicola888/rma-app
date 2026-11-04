# CLAUDE.md — Guide for AI coding agents

RMA SaaS for 3PL returns warehouses. Tenant = 3PL company; Merchant (货主) = the 3PL's client.
Full design: `docs/design.md` (Chinese). Follow it; ask before deviating.

## Stack

- pnpm monorepo: `apps/web` (Next.js + TypeScript + Tailwind, PWA), `apps/api` (NestJS REST, Swagger, API keys), `packages/db` (Prisma 7; `directUrl` is set in `prisma.config.ts`).
- Local Postgres via Docker on host port **15432** (5432 is reserved by Windows). Cloud DB: Supabase (Sydney); use `pnpm dev:cloud` / `pnpm db:migrate:cloud` with `.env.supabase`.
- Auth: **Clerk** (Organization = tenant). Photos: **Cloudflare R2**, private bucket; the API checks tenant/merchant permission, then issues short-lived presigned URLs. Never make photos public.

## Multi-tenancy (highest priority)

- Every business table has `tenant_id`, isolated with PostgreSQL RLS.
- Merchant-scoped tables have `merchant_id`; queries by merchant users must always be filtered by `merchant_id` (enforce centrally, not ad hoc).
- Automated tests proving cross-tenant AND cross-merchant reads return nothing are required. Add/extend them in any PR touching data access.
- Product unique key: `(tenant_id, merchant_id, sku)`.

## Append-only tables

`Inspection`, `InspectionPhoto`, `InventoryMovement`, `BillableEvent`, `AuditLog`: no UPDATE/DELETE, enforced at DB level (revoked privileges or triggers). Corrections are new rows (`supersedesId`). Inventory is the sum of movements, per merchant.

## Eccang (易仓 ERP) integration

- Signing (AES/CBC/PKCS7, MD5 fallback) happens **server-side only**. Credentials live in env vars / encrypted `Integration` rows; never send them to the browser, never commit them, never log them.
- Sign per request (timestamp valid 1 minute, single use). Page through all results (`page_size` 50). Map error codes to Chinese operator messages (see design).

## Workflow

- One PR per feature, in the order in `docs/design.md` (PR 4: Clerk + tenancy + RLS + isolation tests, then 5–14). Keep PRs small; CI (lint, build, migrate, tests) must pass.
- UI text is in Simplified Chinese.
- The owner is a software beginner: every PR description must explain, in simple Chinese, what changed, why, and how to verify it locally (exact commands).
- Don't over-engineer; explain key decisions.
