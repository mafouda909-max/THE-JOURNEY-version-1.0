# THE JOURNEY — Production DB Readiness

## Current verified state — 2026-09-03

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
