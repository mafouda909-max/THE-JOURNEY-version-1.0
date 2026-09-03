# THE JOURNEY — Production DB Readiness

## Engineering hardening applied — 2026-09-03 (production recovery run)

- **Schema contract re-verified:** `src/db/schema.ts` (17 tables) and `db/production_schema.sql` are column-aligned (automated parse: 0 diffs).
- **`scripts/check-production-schema.ts` extended** from 11 to all **17 canonical tables** and every required column — including `offers.title_en`, the column whose absence caused the production incident (PostgreSQL 42703). The previous check would have **PASSED** against the drifted database.
- **Fixed `npm run db:check` runtime:** top-level await crashed the script under the repo's CJS/tsx configuration before any check ran. It now works everywhere, with SSL-first connect and automatic fallback for non-SSL (local/embedded) Postgres.
- **Proven against a real PostgreSQL 18 instance:** canonical schema → check **PASS**; dropping `offers.title_en` reproduces the exact production error (42703) and the check fails with `missing column: public.offers.title_en`; applying `db/production_alignment.sql` heals it; the full app-column `offers` SELECT executes with `title_en` present.
- **Added `db/production_alignment.sql`** — idempotent, additive-only (`CREATE TABLE IF NOT EXISTS` + `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, 172 column statements, 20 indexes; ALTERs intentionally omit `NOT NULL` so they can never fail on populated tables). It brings **THE JOURNEY Production V1** into exact alignment **without touching data**. Never run it against the legacy `late-mountain-20124572` database.
- **`src/db/index.ts` is now lazy:** importing `@/db` no longer creates a pool or throws; `next build` never requires a live database; runtime failures stay loud. The `POSTGRES_URL` fallback (Vercel Neon integration) is preserved.
- **Serverless safety:** MCP runtime verification (spawn-based, impossible on Vercel) is now Vercel-gated; MCP config discovery is scoped to `config/`; `/api/tools` no longer statically bundles fs/spawn machinery.
- **Sitemap/robots:** canonical `NEXT_PUBLIC_SITE_URL` with `NEXT_PUBLIC_APP_URL` fallback; fully build-safe (no DB access).
- **Security:** removed the hardcoded `LINKING_TOKEN_SECRET` fallback (identity linking is now fail-closed, min 16 chars); `.gitignore` now blocks `.config/`, `.mcp-auth/`, `config/`, `*.zip`; HSTS added to production headers.

## Remaining external blockers

1. **Vercel must point `DATABASE_URL` at THE JOURNEY Production V1 (production branch)** — not the legacy project. No Vercel API access was available from the recovery environment (`VERCEL_DIRECT_ACCESS_UNAVAILABLE`).
2. **Run the "Production DB Contract" workflow** (or `npm run db:check` with the production `DATABASE_URL`) once to prove the canonical database contract in production.
3. **Secrets in git history:** the uploaded workspace ZIP (commit `ff54e838`, still reachable in history) contains a real `.env` and `.config/nextjs-nodejs/config.json`. Rotate every credential it contained and purge the blob from history (BFG / filter-repo + coordinated force-push).

## Known, bounded items (non-blocking)

- One Turbopack NFT tracing warning remains for `/api/tools` (dynamically imported MCP chain). It is warning-level: prior production deployments built and served traffic with it, and the spawn path is now Vercel-gated.
- `next/font/google` (IBM Plex Mono, IBM Plex Sans Arabic) requires `fonts.googleapis.com` reachability at build time. GitHub Actions and Vercel have it; fully offline environments do not.

---

## Prior state (2026-09-03, earlier)

- GitHub canonical branch: `main`
- CI: `npm ci` → `typecheck` → `lint` → `build` passes.
- Current Neon project: `THE JOURNEY` / `late-mountain-20124572`
- Neon default branch: `br-purple-water-b1v1cur4`

## P0 blocker: repository/production schema drift

The application repository and the existing Neon database are not schema-compatible.

Examples:

- Repository `src/db/schema.ts` defines integer/serial IDs for core entities; Neon uses UUID IDs.
- Repository session model uses `token`; Neon uses `token_hash` plus `revoked_at`.
- Repository `contact_requests` includes fields such as `traveler_count`, `travel_dates`, and `offer_snapshot`; Neon uses `traveler_account_id`, `traveler_phone`, timestamps for state transitions, and a different column contract.
- Repository code references an `events` table, while the current Neon public schema does not contain `events`.
- Repository schema contains additional growth/travel-intelligence tables that are not present in the current Neon public schema.

## Decision

Do not point the current application at this Neon database until schema parity is established.

Do not perform destructive production migration automatically.

The next engineering action is to choose one canonical schema, generate/apply a tested migration, then run the full acceptance path against the same database contract:

Agent signup → verification → offer creation → admin approval → publish → traveler search → lead → agent response → review.

Until that is complete, production deployment remains blocked even though CI is green.
