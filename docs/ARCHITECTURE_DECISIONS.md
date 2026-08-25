# ARCHITECTURE DECISIONS — THE JOURNEY / الرحلة

> Version 1.0 — August 2026 | Phase 2 Output
> Basis: PROJECT AUDIT (baseline) + APPROVED DECISIONS C1–C5
> Status of this document: CANONICAL for all technical implementation
> Relationship to product docs: PRODUCT_SPEC.md remains canonical for product behavior. Where a technical constraint forces a deviation, it is recorded here as a superseding decision (see AD-08, AD-17).

---

## 0. CONTEXT

The workspace contains product documentation only — no code, no database, no repository.
This record converts the audit into binding technical decisions. Each decision uses:

```text
Decision
Reason
Alternatives considered
Why rejected
Consequences
Status
```

Approved product decisions carried into this record:

| ID | Decision |
|---|---|
| C1 | Structured travel reference data (Country → City → Airport; Airlines). IATA codes are reference data. No invented codes. Free-text city strings are NOT canonical. |
| C2 | Western numerals (0–9) everywhere in product UI. |
| C3 | Review eligibility requires: contact request → agent responded. Submission alone is insufficient. |
| C4 | Canonical offer lifecycle: DRAFT → PENDING_REVIEW → PUBLISHED → EXPIRED → ARCHIVED, with REJECTED side-state. No separate APPROVED state. |
| C5 | The 42-screen map is IA reference, not build order. Implementation is vertical slices. |

---

## AD-01 — Frontend Stack

**Decision:** Next.js (App Router) + TypeScript + Tailwind CSS.

**Reason:**
- Marketplace discovery pages must be server-rendered and SEO-indexable (public offers, agent profiles).
- React Server Components minimize client JS for content-heavy pages (mobile-first audience).
- TypeScript is mandated by the project coding rules (typed, maintainable).
- Tailwind maps 1:1 onto the locked token system in `DESIGN.md` (colors, radius, spacing, shadows) and supports logical properties for RTL.

**Alternatives considered:**
- *Plain SPA (Vite + React)* — rejected: poor SEO for public marketplace surface; more work to get SSR later.
- *Next.js Pages Router* — rejected: App Router is the current standard; no legacy constraint exists.
- *Astro / Remix / SvelteKit* — rejected: no team familiarity evidence in repo; ecosystem fit (Supabase SSR helpers) strongest with Next.js.

**Why rejected (summary):** anything without first-class SSR loses the primary discovery channel (organic search).

**Responsive breakpoint scale (ratified — Open Question Q4):**
```text
sm: 640px · md: 768px · lg: 1024px · container max (xl): 1280px
```
Tailwind defaults adopted. Custom breakpoints are prohibited unless a concrete screen proves the need.

**Consequences:** Node runtime required; Vercel-aligned deployment (AD-14); team must follow RSC/client-component discipline.

**Status:** APPROVED.

---

## AD-02 — Backend Platform

**Decision:** Supabase — PostgreSQL (database + RLS), Supabase Auth, Supabase Storage, pg_cron for scheduled jobs, Edge Functions reserved for cases needing server-side secrets or external APIs.

**Reason:**
- The prototype artifacts referenced in `UX_AUDIT.md` (`supabase.ts`, `supabase-admin.ts`) indicate Supabase was already the working assumption.
- Postgres alone can carry the entire MVP workload: relational integrity, RLS, full-text/trigram search, scheduled jobs (AD-09, AD-11). One platform, one bill, one security model.
- RLS gives row-level authorization close to the data (AD-05).

**Alternatives considered:**
- *Custom Node/NestJS API + hosted Postgres* — rejected for MVP: an API layer would mostly proxy Supabase capabilities; more code, more attack surface, slower delivery. Revisit if complex server-side workflows emerge.
- *Firebase* — rejected: relational data model (offers/routes/reviews/moderation) is a poor fit; weak querying.
- *Self-hosted Postgres + custom auth* — rejected: operational cost unjustified pre-product-market-fit.

**Consequences:**
- Authorization logic lives primarily in SQL (policies), not application middleware.
- Service-role key usage confined to trusted server contexts only (AD-06, AD-15).

**Status:** APPROVED.

---

## AD-03 — Canonical Route Modeling (implements C1)

**Decision:**
- Reference hierarchy: `countries → cities → airports` (each airport belongs to exactly ONE city; each city to exactly ONE country).
- Every offer references **cities** as the canonical route: `origin_city_id`, `destination_city_id` (REQUIRED, structured FKs).
- Flight-granular refinement is OPTIONAL on offers: `origin_airport_id`, `destination_airport_id`, `airline_id` (nullable FKs).
- Referential integrity between airport refinement and city route is enforced with a composite foreign key: `UNIQUE (id, city_id)` on airports; `FK (origin_airport_id, origin_city_id) REFERENCES airports (id, city_id)` — an airport can never contradict its offer's city without a constraint violation.
- No `offer_routes` table in V1. Multi-segment itineraries do not exist in the product scope; a route table would be premature normalization. Re-evaluate only if multi-leg becomes a concrete requirement.
- IATA/ICAO codes live only in reference tables (`airports`, `airlines`), nullable + uniquely indexed. Codes are never invented; sourcing is defined in AD-12.

**Reason:** Trip types include visa/hotel/package/umrah/cruise which have no meaningful airport pair. City-level routes serve universal search; airport-level data serves flight filtering and display precision.

**Alternatives considered:**
- *Airports-only routing* — rejected: forces fake airports onto non-flight offers.
- *Polymorphic "place" reference* — rejected: kills referential clarity and indexing for zero MVP gain.
- *Separate `offer_routes` junction* — rejected (above).

**Consequences:** Search operates at city granularity by default; airport filters apply to the subset of offers that declare airports. Non-flight offers simply leave airport/airline columns NULL.

**Status:** APPROVED (implements C1).

---

## AD-04 — Authentication Strategy

**Decision:** Supabase Auth, email + password, with:
- Email verification required before any authenticated action (contact requests, saving, agent portal).
- App-level identity mirrored in `public.users` (1:1 with `auth.users`, same PK) carrying `role`, `display_name`, `language_pref`, `is_active`.
- Role injected into the JWT via Supabase **Custom Access Token Hook** (`user_role` claim), so RLS policies avoid per-query joins to determine role.
- Admin accounts: `role='admin'` + **mandatory TOTP MFA**. The admin portal refuses sessions lacking an MFA-verified factor (checked server-side on every admin page/API entry).
- Login redirects back to the originating page (deep-link return), required by the contact-request flow.

**Alternatives considered:**
- *OTP/magic-link only* — rejected as sole method: phone/email OTP friction for agents managing offers; password retained, magic link optional enhancement.
- *Third-party social login* — deferred: not required for V1; add later without schema change.
- *Role checks via DB subquery in every policy* — rejected as primary mechanism (N queries per scan); kept as fallback if the hook misbehaves.

**Consequences:** Token refresh propagates role changes (revocation latency ≈ token lifetime); sensitive role escalations therefore always paired with session revocation server-side.

**Status:** APPROVED.

---

## AD-05 — Authorization Strategy

**Decision:** RLS-first. Every table has policies; the application NEVER relies on client-side checks for security. Enforcement layers:

1. **RLS policies** (data plane): ownership, role gates, state-machine guards (e.g., only PENDING_REVIEW offers can be approved).
2. **Server Actions / Route Handlers** (application plane): orchestration, validation (schema-level), writing `admin_actions` audit entries, operations requiring service-role (approval transitions, document review).
3. **UI gating** (presentation plane only): hides/disables actions; never a security control.

Full permission matrix: see `DATABASE_DESIGN.md` § Permission Matrix.

Key structural choices:
- Public surfaces read **derived/public projections** (agent profiles, offers), never `users` directly. Traveler identity is exposed only through a security-definer view returning display names for reviews.
- State transitions that require privilege (approve, reject, suspend, verify) run server-side with service-role + mandatory `admin_actions` entry; RLS denies these directly to clients.

**Alternatives considered:**
- *All authorization in Next.js middleware/API* — rejected: bypassable by direct DB clients; duplicates logic.
- *Postgres roles per app role* — rejected: Supabase pools connections as `authenticated`; RLS + claims is the platform-native pattern.

**Consequences:** Policy correctness becomes critical infrastructure → policies are versioned with migrations and covered by automated tests (AD-13).

**Status:** APPROVED.

---

## AD-06 — Storage Strategy

**Decision:** Supabase Storage with three buckets:

| Bucket | Access | Contents |
|---|---|---|
| `avatars` | Public read | Agent/traveler profile images. Owner-scoped write paths `{user_id}/**`. |
| `offer-media` | Public read | Offer images. Write restricted to owning agent (path `{offer_id}/**`, validated server-side). Size/type limits enforced at upload. |
| `verification-docs` | **PRIVATE** | National IDs, licenses, commercial registrations. **Never public.** Read exclusively via short-lived signed URLs (≈5 min TTL), issued server-side to the owning agent or admins only. |

Document retention policy (conceptual, enforced procedurally until a job exists):
- Documents persist while the verification request is actionable or under appeal.
- After final approval, originals are deleted; a hash + metadata stub remains for audit.
- On account termination: purge after 90 days.
- Every signed-URL issuance for admin review is logged in `admin_actions`.

**Reason:** Identity documents are the most sensitive data class on the platform (flagged in audit as top-tier risk). Private-bucket + signed-URL + audit-log is the minimum credible posture.

**Alternatives considered:** third-party object storage (S3/R2) — rejected: added infra for no MVP gain; revisit at scale.

**Consequences:** Admin review UI must stream via backend-generated signed URLs; screenshots/downloads discouraged by process, not technology (accept residual risk; document in verification policy page).

**Status:** APPROVED.

---

## AD-07 — Internationalization & Numerals (implements C2)

**Decision:**
- **Arabic-first, RTL-native.** Default locale `ar`; LTR English capability structurally prepared but not shipped in V1 UI.
- All UI strings via a keyed dictionary module (`/dictionaries/ar.ts`); NO hardcoded user-facing strings in components. English dictionary file may ship incomplete in V1.
- Content (offers, profiles, reference data) bilingual at the schema level: `*_ar` REQUIRED, `*_en` optional columns (see DATABASE_DESIGN).
- **Western numerals (0–9) universally** — prices, dates, stats, counts, codes. Enforced through a single formatting utility (`formatPrice`, `formatDate`, `formatCount`); components never call raw `toLocaleString` variants.
- Dates displayed DD/MM/YYYY (per PRODUCT_SPEC §8); stored UTC.
- Bidirectional safety: airport/IATA codes and prices rendered inside `<bdi>`/directional isolation wrappers within Arabic text.
- Currency amounts rendered in the offer's declared currency; no conversion in V1 (multi-currency display is out of scope per MVP_SCOPE).

**Alternatives considered:** next-intl/i18next frameworks — rejected for V1: single-locale shipping; a typed dictionary module delivers the same guarantees with less machinery. Adopt a framework when `en` launches.

**Consequences:** adding English later = adding one dictionary + enabling locale routing; no component rewrite.

**Status:** APPROVED (implements C2).

---

## AD-08 — Canonical Lifecycle Vocabulary (implements C4)

**Decision:** Exactly one vocabulary, used in DB enums, API payloads, UI labels, and documentation:

```text
Offer:      DRAFT | PENDING_REVIEW | PUBLISHED | REJECTED | EXPIRED | ARCHIVED
Verification request: IN_REVIEW | APPROVED | REJECTED | WITHDRAWN
Agent verification status (profile): UNVERIFIED | IN_REVIEW | VERIFIED | REJECTED | SUSPENDED
Contact request: NEW | VIEWED | RESPONDED | CLOSED | CANCELLED
Report:     OPEN | IN_REVIEW | RESOLVED | DISMISSED
```

Transition authority and validation rules are specified in `DATABASE_DESIGN.md` (Offer Lifecycle section). Deviations from PRODUCT_SPEC wording:
- Dual `traveler_status`/`agent_status` on contact requests (SPEC §3.4) is **superseded by a single status enum** — the two tracked the same underlying facts and would drift.
- No `APPROVED` offer state (C4): approval is the PENDING_REVIEW → PUBLISHED transition itself.

**Canonical offer transition matrix — CLOSED WORLD (B1 ratified):**

| # | FROM | TO | Actor |
|---|---|---|---|
| 1 | DRAFT | PENDING_REVIEW | owning agent |
| 2 | PENDING_REVIEW | PUBLISHED | admin (server-side) |
| 3 | PENDING_REVIEW | REJECTED | admin · reason required |
| 4 | REJECTED | PENDING_REVIEW | owning agent (resubmission) |
| 5 | PUBLISHED | EXPIRED | system job ONLY |
| 6 | EXPIRED | PENDING_REVIEW | owning agent (renewal) |
| 7 | PUBLISHED | PENDING_REVIEW | owning agent (major-edit re-review — E2) |
| 8 | DRAFT | ARCHIVED | owning agent |
| 9 | REJECTED | ARCHIVED | owning agent |
| 10 | EXPIRED | ARCHIVED | owning agent |
| 11 | PUBLISHED | ARCHIVED | owner (unpublish) or admin |

These eleven pairs are exhaustive. Any pair outside this matrix is illegal by construction and MUST be denied by the transition-function whitelist plus a trigger assertion. No additional pairs may be improvised during migration; adding a twelfth pair requires a new ratified decision record.

**Enum literal casing (B3 ratified):** PostgreSQL ENUM labels are **lowercase snake_case** (`draft`, `pending_review`, `published`, `rejected`, `expired`, `archived`, …). UPPERCASE forms appearing in this and other documents are presentation labels only; casing is owned by the application dictionary layer. UPPERCASE labels must never be stored in PostgreSQL.

**Consequence:** every state mutation is guarded by (a) the closed-world whitelist above, (b) an RLS/trigger check on current state, and (c) an explicit transition function; ad-hoc status UPDATEs are denied.

**Status:** APPROVED (implements C4; deviations documented here per Phase-2 mandate).

---

## AD-09 — Scheduled Jobs Strategy

**Decision:** `pg_cron` inside Supabase Postgres for all time-based automation:

| Job | Cadence | Action |
|---|---|---|
| `expire_offers` | hourly | `PUBLISHED → EXPIRED` where `valid_until < now()`; emit notifications |
| `expiry_reminders` | daily | Insert notifications for offers expiring in 7 days / 1 day |
| `auto_close_contacts` | daily | `RESPONDED → CLOSED` after 30 days without traveler action |
| `purge_expired_notifications` | weekly | Delete read notifications older than 90 days |

Edge Functions are reserved for operations needing secrets outside the DB (none identified in V1) — deliberately unused until proven necessary.

**Alternatives considered:** Vercel Cron hitting an API route — rejected: duplicate scheduling surface; DB-adjacent jobs keep transactionality with the data they mutate. External queue/worker — rejected: unjustified at MVP scale.

**Consequences:** job failures are silent unless monitored → enable Supabase logs alerting on job errors; each job is idempotent.

**Status:** APPROVED.

---

## AD-10 — Notification Strategy

**Decision:** Event-driven, in-app only for V1.
- Single `notifications` table (recipient, type key, JSONB payload, `read_at`).
- Producers: DB triggers/functions on the events already defined in PRODUCT_SPEC §4.5 (offer approved/rejected/expiring, contact received/responded, review received, verification status change).
- Consumers: notifications page + unread badge count (RPC returning count, polled at low frequency; websockets unnecessary in V1).
- Transactional EMAIL is deferred entirely (only Supabase's built-in auth emails exist in V1). Adding an email provider later means subscribing to the same events — the schema does not change.

**Alternatives considered:** realtime channels — rejected: cost/complexity for marginal UX at current scale; push notifications — deferred to post-web phases.

**Consequences:** users may miss time-sensitive items without email; mitigated by in-app prominence and (future) email digest.

**Status:** APPROVED.

---

## AD-11 — Search Architecture

**Decision:** PostgreSQL-only search. No external engine.

**Query model:** `offers` (status=PUBLISHED, valid_until ≥ now()) joined to `cities`, `airports`, `airlines`, `agent_profiles`.

**Filters (progressive disclosure):**

| Filter | Source | Notes |
|---|---|---|
| Destination (city) | cities | Primary intent; autocomplete |
| Origin (city) | cities | Optional ("anywhere" allowed) |
| Trip type | offers.trip_type | Multi-select chips |
| Airline | airlines | Only offers declaring `airline_id` |
| Route type | offers.route_type | direct/transit; NULL = unspecified, always included |
| Price range | offers.price_amount + currency | **Scoped per selected currency** — cross-currency comparison is intentionally unsupported in V1 (honest UX; avoids fake conversion). When a price filter is active, offers in other currencies are hidden with an explanatory chip. |
| Validity | offers.valid_until | "Expiring soon" preset (≤7 days) |
| Verified agent | agent_profiles.verification_status = 'VERIFIED' | Toggle |

**Sorting:** `relevance` (default: verified-first, then newest), `price_asc` / `price_desc` (within active currency context), `rating_desc`, `newest`.

**Autocomplete:** single RPC `search_places(q)` over cities + airports (and `search_airlines(q)` for admin/filter), using `pg_trgm` GIN indexes on `name_ar`/`name_en`, prefix-weighted, LIMIT 8. Arabic matching relies on trigram similarity; a normalizing function strips diacritics/tatweel at index and query time (generated columns).

**Indexing strategy (essentials):**
- `offers (status, valid_until)`; `(destination_city_id, status, published_at DESC)`; `(origin_city_id)`; `(airline_id) WHERE airline_id IS NOT NULL`; `(trip_type)`; trigram GIN on `title_ar`.
- `cities`: trigram GIN on names; `(country_id)`; partial on `is_popular`.
- `airports`: `(city_id)`; partial unique `iata`; trigram names. Same pattern for `airlines`.
- `agent_profiles`: `(verification_status)`; trigram on names.

**Empty state behavior (defined product behavior, not improvisation):**
1. Auto-suggest removing inactive-intent filters (show which filter yields zero).
2. Offer sibling destinations in the same destination-country (city list).
3. Fallback: curated popular destinations (cities marked `is_popular`).

**When to revisit:** if p95 query latency > 300ms at realistic V1 data volumes (<100k offers), first optimize (materialized view / partitioning) before ever adding a search engine.

**Alternatives considered:** Meilisearch/Typesense/Elastic — rejected: operational overhead unjustified at MVP scale; Postgres handles this workload comfortably.

**Status:** APPROVED.

---

## AD-12 — Seed & Demo Data Strategy

**Decision:** Two strictly separated data classes.

### Class 1 — Production Reference Data (real)
- `countries`, `cities`, `airports`, `airlines`, `badges` (catalog).
- Sources: **OurAirports.com** (public domain) for airports; ISO 3166 for countries; OurAirports `airlines.dat` + manual curation for airlines.
- Applied via versioned, idempotent SQL scripts under `db/seeds/reference/` executed through migrations tooling; safe to run against production.
- Curation rule (Q1 ratified): Slice 0 activates the principal carriers of **Egypt, Saudi Arabia, UAE, Jordan, Turkey** (plus priority-region cities/airports); global reference coverage may be imported but stays `is_active=false` until reviewed (prevents garbage-in discovery). The schema remains fully extensible — extending coverage later is a data operation, never a migration.
- **No invented IATA/ICAO codes. Any suspected conflict is flagged in a data-review note, never silently guessed.**

### Class 2 — Demo/Seed Data (clearly synthetic)
- Demo agents, offers, reviews, contact requests for development/staging demos.
- Rules:
  1. Every demo-capable table carries `is_demo BOOLEAN NOT NULL DEFAULT false`; demo rows set it true.
  2. All demo PKs generated from a fixed UUID namespace (deterministic, greppable).
  3. Demo scripts run ONLY when `DEMO_SEED_ENABLED=true` (absent in production env).
  4. Demo agents are clearly fictional (`demo.` naming convention, e.g., "وكيل تجريبي — Demo Agent") and rendered with a subtle DEV-only watermark chip when the app runs in non-production mode.
  5. **Cleanup procedure** `purge_demo_data()` deletes in dependency order (notifications → reviews → contact_requests → saved_offers → offer_media → offers → agent_badges → verification_documents → verification_requests → agent_profiles → users) strictly `WHERE is_demo`. Real user activity referencing demo offers (a real traveler contacting a demo offer) blocks deletion of that subtree and is reported by the procedure instead of cascading silently.
  6. Production launch checklist item: `SELECT count(*) FROM offers WHERE is_demo` must equal zero.

**Alternatives considered:** separate demo database — rejected: drifts instantly and costs money; flag-based isolation with deterministic IDs is auditable inside one database.

**Consequences (B9 ratified):** the PRIMARY guarantee that production contains no demo data is procedural — production cleanliness + the purge gate (checklist item 6) + `DEMO_SEED_ENABLED` absent from production env. View-level demo filtering is OPTIONAL defense-in-depth only and must never be relied upon as the mechanism.

**Status:** APPROVED.

---

## AD-13 — Testing Strategy

**Decision:** Lean, loop-focused.

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest | Formatting utils (numerals/dates — C2), price semantics, state-machine transition guards, dictionary completeness |
| Integration | Vitest + local Supabase (CLI) | RLS policy suites per role (the critical tests in the system), lifecycle transitions, trigger-maintained derived fields |
| E2E | Playwright | The three core loops ONLY: (1) guest discovers → offer → agent, (2) agent register → verify → offer → publish, (3) traveler contact → respond → track. Plus RTL/mobile smoke on the search flow |
| CI | GitHub Actions | lint + typecheck + unit on every PR; integration on PRs touching `db/**`; Playwright suite on merge to main against staging |

**Alternatives considered:** comprehensive component-test culture — deferred: highest-value tests are policies and journeys; expand later.

**Consequences:** RLS changes without accompanying tests fail review by convention (recorded here as team rule).

**Status:** APPROVED.

---

## AD-14 — Deployment & Environment

**Decision:** Vercel (web) + Supabase Cloud (data), two isolated environments:

| Env | Web | Database |
|---|---|---|
| Production | `vercel` production | Dedicated Supabase project (prod) |
| Preview/Staging | Vercel previews | **Separate** Supabase project (staging) — previews NEVER connect to production data |

Environment contract:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — safe for browser.
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only**, never imported in client bundles (enforced by import-lint rule + code-review), used solely in Server Actions/Route Handlers for privileged transitions and audit writes.
- Migrations run via Supabase CLI pipeline (staging → verify → prod), never hand-applied to prod.

**Alternatives considered:** single-project branching (Supabase branchings) — rejected as primary strategy: preview-per-PR databases add cost/noise; one staging project suffices for V1.

**Status:** APPROVED.

---

## AD-15 — Vertical Slice Order (implements C5)

**Decision:** Build order is journey-driven, not screen-map order (full definition in Phase-2 output § First Implementation Slice):

```text
Slice 0  Foundation:    repo, tokens, Supabase projects, migrations v1 (reference +
                        identity + offers + RLS v1), auth flows, layout shell, primitives
Slice 1  Discovery:     guest: home → search → results → offer detail → agent profile
Slice 2  Publishing:    agent register → verification → admin queues → offer create/approve
Slice 3  Conversion:    contact request → respond → tracking  (CORE LOOP COMPLETE)
Slice 4  Trust:         reviews (C3-gated), badges, saved offers
Slice 5  Operations:    notifications, expiry/reminders jobs, renewal flow
Slice 6  Launch gate:   all states, legal pages, accessibility/RTL/mobile audits, analytics-light
```

Each slice ends demo-able end-to-end. Screens outside these journeys wait.

**Status:** APPROVED (implements C5).

---

## AD-16 — Rejected / Prohibited Technologies (standing list)

Redis · microservices · GraphQL · Kafka/event bus · external search engines · native mobile apps · payments infrastructure · chat/realtime messaging infra · AI services · Kubernetes/self-hosting.

Any addition requires a new ADR demonstrating a concrete requirement the current stack cannot meet.

**Status:** LOCKED for V1.

---

## AD-17 — Documentation Deviations Log

Deviations from earlier product docs, authorized by this record (originals untouched):

| # | Doc & Section | Deviation | Justification |
|---|---|---|---|
| 1 | PRODUCT_SPEC §3.3 (origin/destination as free strings) | Replaced by structured city FKs + optional airport/airline FKs | Implements approved C1 |
| 2 | PRODUCT_SPEC §3.4 (dual status enums on contact requests) | Single unified status enum | Redundant dual tracking invites drift |
| 3 | PRODUCT_SPEC §3.3 `price_type` mixed two concepts | Split into `price_type` (fixed/starting_from) × `price_basis` (per_person/per_group/total) | Disambiguates price semantics |
| 4 | PRODUCT_SPEC §4.4 (review 24h after submission) | Eligibility = agent RESPONDED **and** `responded_at + 90 days ≥ now()` (B2) | Implements approved C3 + ratified time-bounded review window |
| 5 | BRAND_GUIDELINES §13.8(8) (Arabic-Indic numerals option) | Superseded by C2 — Western numerals universally, no inconsistent numeral behavior between screens | Approved decision C2 remains the final standard (B4) |
| 6 | PRODUCT_SPEC §7 navigation (`/agents` Agent Directory route) | `/agents` global directory REMOVED from MVP — DEFERRED post-MVP (B6) | Search-first / offer-first product philosophy; Agent Profile pages (`/agents/[id]`) are unaffected and remain core to the offer/trust experience |

---

## SUMMARY TABLE

| AD | Topic | Status |
|---|---|---|
| 01 | Next.js + TS + Tailwind | APPROVED |
| 02 | Supabase platform | APPROVED |
| 03 | City-canonical routing + optional airports (C1) | APPROVED |
| 04 | Supabase Auth + admin MFA + role claims | APPROVED |
| 05 | RLS-first authorization | APPROVED |
| 06 | Storage buckets + private verification docs | APPROVED |
| 07 | Arabic-first i18n + Western numerals (C2) | APPROVED |
| 08 | Canonical lifecycle vocab (C4) | APPROVED |
| 09 | pg_cron scheduled jobs | APPROVED |
| 10 | In-app event-driven notifications | APPROVED |
| 11 | Postgres-only search | APPROVED |
| 12 | Reference vs demo data separation | APPROVED |
| 13 | Testing strategy | APPROVED |
| 14 | Vercel + dual Supabase environments | APPROVED |
| 15 | Vertical slices (C5) | APPROVED |
| 16 | Rejected-tech lock list | LOCKED |
| 17 | Deviations log | RECORDED |

*Document Owner: Architecture*
*Next: DATABASE_DESIGN.md (canonical conceptual data model), ERD.md*
