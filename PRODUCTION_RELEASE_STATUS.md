# THE JOURNEY / الرحلة — Production Release Status

**Generated:** 2026-09-04 (Africa/Cairo)
**Verified baseline (`main`):** `26bcfec5e5abd73012a933a6a32512340bd55dc0`
**Release work branch:** `arena/01a06920-the-journey-version-1-0`

---

## VERDICT

### NO-GO — blocked on external infrastructure access (code is release-ready)

All **code-side release gates pass** (build, typecheck, lint, unit tests). The
release cannot be completed to a live `GO` because **the required production
infrastructure is not reachable from this environment**:

- No `DATABASE_URL` / Neon connection string is available here, so the live
  Neon **Production V1** database could not be reached, migrated, or
  verified.
- No **Railway** project/service credentials are available here, so no
  deployment/health-check could be performed.
- Production **smoke tests** on `/api/health` and the live URLs could not run.

This is the smallest blocking condition — provision access to the approved
production environment and re-run the release steps below. Nothing was
merged to `main`, nothing in production was touched, and no secrets were
exposed.

---

## 1. Commit

- Base (unchanged `main`): `26bcfec5e5abd73012a933a6a32512340bd55dc0`
- Release changes staged on branch `arena/01a06920-the-journey-version-1-0`
  (see `git log` / PR for the exact tip SHA).

## 2. Code

| Gate | Result |
| --- | --- |
| `npm ci` | PASS (438 packages) |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test` | PASS — 21 unit tests |
| `npm run build` | PASS — Next.js 16.2.6, offline (self-hosted fonts) |

One non-blocking Turbopack warning remains for `/api/tools` (dynamically
imported MCP chain); it is warning-level and was already documented.

## 3. Database

- **Schema contract:** `src/db/schema.ts`, `db/production_schema.sql`, and
  `db/production_alignment.sql` are aligned (17 canonical tables; all
  required columns plus the columns that caused the prior `offers.title_en`
  incident are covered by `scripts/check-production-schema.ts`).
- **Indexes:** added the production-critical indexes demanded by the release
  checklist — `offers_published_at`, `offers_expires_at`,
  `contact_requests_agent_id`, `contact_requests_status`, `events_created_at`.
  All index names are consistent across `schema.ts`, `production_schema.sql`,
  and `production_alignment.sql` (verified).
- **Migrations:** the SQL migrations are additive-only
  (`CREATE TABLE/INDEX IF NOT EXISTS`); applying
  `db/production_alignment.sql` to **Production V1** is non-destructive.
- **Connectivity:** live Neon reachability **NOT verified** — no
  `DATABASE_URL` is available in this environment.

## 4. Security

- **Seed safety (P0 fixed):** `src/db/seed.ts` now hard-blocks the
  destructive demo seed against `NODE_ENV=production` and requires an
  explicit `ALLOW_DESTRUCTIVE_SEED=1` on any remote/non-local database
  (guard extracted to `src/lib/seed-safety.ts`, unit-tested).
- **Offer visibility (info-leak fixed):** public offer-by-ID (API + data
  loader) now returns only `published` offers; draft / pending_review /
  rejected offers are not enumerable by guessing IDs.
- **Contact lifecycle (policy §13):** pure state machine
  (`src/lib/contact-state.ts`) plus owner-agent/admin-scoped
  `PATCH /api/contact-requests/[id]` that enforces
  `new → viewed → responded → closed`, rejects illegal transitions, and
  writes an audit record.
- **Rate limiting:** `/api/events` throttled per client IP (60/min). Noted
  limitation: the bucket is in-memory/single-instance, not a distributed cap.
- **Admin boundary:** `requireAdmin` remains fail-closed; anonymous/non-admin
  access to private data is blocked.
- **Secrets:** no real credentials from the prior hand-off are present in the
  accessible Git history (the referenced blob `ff54e838` is not reachable in
  this checkout, which contains a single commit). No secret patterns found in
  source; `.env.example` is value-free.

## 5. Known Limitations (genuine, non-blocking)

- No live production DB, Railway deploy, or production smoke test — blocked
  by missing infrastructure access (see VERDICT).
- `/api/tools` NFT tracing warning (warning-level, pre-existing).
- Contact-status UI buttons are not yet wired in `/account` (the server-side
  state machine + endpoint exist).
- The admin key may be auto-generated into `config/admin-key.json` when
  `ADMIN_API_KEY` is unset (local/preview fallback); production must set the
  secret.

## 6. Next human action to reach GO

1. Provision the approved Neon **Production V1** `DATABASE_URL` and a
   **Railway** service to this environment.
2. Apply `db/production_alignment.sql` to Production V1 (additive-only) and
   run `npm run db:check` against it.
3. Deploy, then run the production smoke script
   (`scripts/smoke-test.ts`) and the `/api/health` probe.
