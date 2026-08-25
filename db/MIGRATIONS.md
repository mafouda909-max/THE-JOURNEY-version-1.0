# Migrations — THE JOURNEY / الرحلة

Canonical sources: `docs/DATABASE_DESIGN.md` · `docs/ARCHITECTURE_DECISIONS.md`.
Migrations may only be written against these documents (ratified baseline).

## Execution order

| # | File | Scope |
|---|---|---|
| 0001 | `0001_extensions_enums.sql` | pg_trgm/pgcrypto + ALL enums (labels lowercase snake_case, B3) + helpers (`set_updated_at`, `normalize_arabic`, `is_admin`) |
| 0010 | `0010_reference_tables.sql` | countries → cities (+normalized generated col) → airports (**UNIQUE(id,city_id)**) → airlines → badges |
| 0020 | `0020_identity_tables.sql` | users, agent_profiles, verification_requests, verification_documents |
| 0030 | `0030_marketplace_tables.sql` | offers (composite airport FKs), offer_media, contact_requests |
| 0040 | `0040_trust_platform_tables.sql` | reviews, agent_badges, notifications, saved_offers, reports, admin_actions |
| 0100 | `0100_rls_policies.sql` | RLS enable-all + grants/revokes per §6 matrix + projection views (`public_offers`, `public_agent_profiles`, `visible_reviews_with_author`) |
| 0110 | `0110_functions_triggers.sql` | closed-world transition trigger (B1), lifecycle functions, review eligibility fn + double-check trigger (B2), contact functions (B7), derived-field maintenance (§7), signup mirror, demo purge |
| 0200 | `0200_jobs.sql` | pg_cron schedules (AD-09), non-fatal when pg_cron absent |

## Ratified contracts encoded here

| Decision | Where enforced mechanically |
|---|---|
| B1/C4 closed world — exactly 11 offer transitions | `assert_offer_transition()` BEFORE UPDATE trigger; whitelist of 11 pairs; unlisted pairs raise. No UPDATE grant on offers for any client role. |
| B3 lowercase enum labels | All `CREATE TYPE ... AS ENUM (...)` values are lowercase snake_case |
| C1 composite integrity | `airports UNIQUE(id, city_id)` + `offers FK(origin|destination_airport_id, origin|destination_city_id)` |
| B2 review eligibility | `submit_review()` asserts `responded ∧ responded_at + '90 days' >= now()`; independent `validate_review_insert()` trigger re-asserts on EVERY insert incl. definer contexts |
| B7 contact rights | creation gated on `published` in `create_contact_request()`; respond/view/close/cancel never consult `offer.status` |
| §7 derived fields | counters/aggregates maintained exclusively by triggers/jobs (`refresh_agent_review_stats`, `refresh_agent_published_count`, `bump_offer_contact_count`, `recompute_response_metrics`) |
| AD-12 demo purge | `purge_demo_data()` ordered deletes; real activity referencing demo data BLOCKS with report |
| Q2 E2 diff contract | pinned in `admin_actions.metadata` comment; E2 transition pair (#7) legal via trigger; E2 edit API lands with Slice 2 offer UI |

## Traceability — entity → file → spec section

users→0020§3.1 · agent_profiles→0020§3.2 · verification_requests→0020§3.3 ·
verification_documents→0020§3.4 · countries→0010§3.5 · cities→0010§3.6 ·
airports→0010§3.7 · airlines→0010§3.8 · offers→0030§3.9 · offer_media→0030§3.10 ·
contact_requests→0030§3.11 · reviews→0040§3.12 · badges→0010§3.13 ·
agent_badges→0040§3.14 · notifications→0040§3.15 · saved_offers→0040§3.16 ·
reports→0040§3.17 · admin_actions→0040§3.18

Deliberately absent (DB_DESIGN §8): profiles · offer_routes · follows · posts ·
conversations · payments · saved_searches · currency tables.

## Validation log

### Static machine checks (this repo, pre-provisioning) — ALL PASS
A1 enum casing · A2 pair count == 11 · A3 composite FKs ×2 + UNIQUE(id,city_id) ·
A4 90-day eligibility (fn+trigger) + publication cap · A5 B7 creation gate ·
A6 all 18 canonical tables present · A7 RLS array ≡ table set (18/18) ·
A8 seeds idempotent (ON CONFLICT) · A9 is_demo coverage matches purge order ·
A10 every SECURITY DEFINER fn pins search_path · A11 no direct DML grants on
offers/contact_requests/admin_actions.

**Execution validation: BLOCKED** — requires a live PostgreSQL/Supabase target.
Run after provisioning:
```bash
supabase link --project-ref <staging-ref>
supabase db push            # applies db/migrations in order
# then seeds:
supabase db execute --file db/seeds/reference/0010_priority_countries.sql
supabase db execute --file db/seeds/reference/0020_priority_airlines.sql
supabase db execute --file db/seeds/reference/0030_badge_catalog.sql
```

## Provisioning-blocked items (NOT code — external actions)
1. Supabase staging + production projects → then `supabase init/link`
2. Register **Custom Access Token Hook** injecting `user_role` claim (AD-04)
   — SQL function can be added post-link; registration is dashboard-side
3. Admin MFA enrollment flow config (SPEC §2.3 mandates 2FA)
4. Storage buckets creation (`avatars`, `offer-media`, private `verification-docs`)
   + signed-URL policies — lands with Slice 2 upload UI
5. Vercel project + env vars from `.env.example`
6. SMTP/auth email templates (Supabase Auth defaults acceptable for Slice 0)

## Deferred by design (documented, not forgotten)
- `view_count` RPC + session dedupe storage → Slice 1 (needs product input on
  dedupe window; column exists, no client writes possible)
- E1 minor-edit & E2 major-edit API endpoints → Slice 2 (whitelist already
  permits their transitions)
- Reports admin queue UI → deferred (schema ready)
