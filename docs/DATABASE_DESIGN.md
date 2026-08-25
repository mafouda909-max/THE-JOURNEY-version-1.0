# CANONICAL DATA MODEL — THE JOURNEY / الرحلة

> Version 1.0 — August 2026 | Phase 2 Output
> Status: CONCEPTUAL SPECIFICATION — not SQL. Migrations may only be written against this document.
> Depends on: `ARCHITECTURE_DECISIONS.md` (AD-03 routing, AD-05 authorization, AD-08 lifecycles, AD-12 seeds)

---

## 1. MODELING PRINCIPLES

1. **Source of truth vs derived:** every fact has exactly one owning table. Aggregates/counters are read-models maintained by triggers and are never authoritative.
2. **Conventions:** snake_case; UUID PKs (`gen_random_uuid()`); every table: `created_at timestamptz NOT NULL DEFAULT now()` (+ `updated_at` where mutable); enums as Postgres ENUM types prefixed `enum_`; **ENUM labels are lowercase snake_case** (`draft`, `pending_review`, …) per B3 — UPPERCASE forms in documents are presentation labels owned by the app dictionary and never stored in PostgreSQL; timestamps UTC.
3. **Soft termination over deletion:** offers/requests/profiles terminate via status (`ARCHIVED`, `CLOSED`, …). Physical DELETE is reserved for demo purges (AD-12) and GDPR-style erasure requests.
4. **Bilingual content:** `*_ar` REQUIRED, `*_en` optional, on user-facing text columns (AD-07).
5. **Demo flag:** `is_demo BOOLEAN NOT NULL DEFAULT false` on all domain tables (AD-12) — omitted from per-entity field lists below for brevity.
6. **Audit trail:** privileged decisions are recorded in `admin_actions`; entity tables hold only current state + minimal decision metadata.

---

## 2. RESOLVED DATA-MODEL QUESTIONS

### 2.1 Users structure — CHOSEN: `users` + `agent_profiles`

```text
auth.users (Supabase-managed credentials)
      │ 1:1 (same PK)
public.users          ← app identity: role, display_name, language_pref, is_active
      │ 1:1 (role='agent')
public.agent_profiles ← professional extension
```

**Rejected:** separate `profiles` table for travelers. Traveler-specific data is ~3 fields (`display_name`, `phone`, `language_pref`); a third layer adds joins for zero benefit. If traveler personalization grows in later phases, introduce it then.

Roles remain exclusive in V1 (an agent is not a traveler account). Consequence documented: agents cannot save offers/contact other agents until a dual-role model is justified by product evidence.

### 2.2 Agent verification — SPLIT into three concerns

```text
agent_profiles.verification_status   → CURRENT state shown publicly (UNVERIFIED | IN_REVIEW | VERIFIED | REJECTED | SUSPENDED)
verification_requests                → one row per submission attempt (auditable history)
verification_documents               → one row per uploaded file per attempt
```

Rationale: documents are sensitive artifacts with their own lifecycle (upload → accepted/rejected → retention/purge, AD-06); attempts must be preserved for audit and appeal; the public badge reads only the profile status. This is the safer design and is adopted.

### 2.3 Airport hierarchy — CHOSEN: strict single-parent chain

```text
country 1 ──< city 1 ──< airport N
```

An airport belongs to exactly ONE city. Metro-area / multi-city representation (e.g., an airport serving two governorates) is **not modeled in V1**; if needed later, add a display alias or served-cities junction — no schema change required now because offers route at CITY level (AD-03), so airport granularity stays a refinement.

### 2.4 Airline identifiers — CHOSEN: internal UUID primary key

`id UUID` PK · `iata_code CHAR(2)` nullable UNIQUE · `icao_code CHAR(3)` nullable UNIQUE. Uniqueness partial (`WHERE NOT NULL`) because not every carrier holds codes and we never invent placeholders (C1). Offers reference the UUID only; codes are display/reference attributes. Nothing more (no fleets, no alliances) — over-modeling rejected.

### 2.5 Offers & routes — CHOSEN: cities canonical, airports optional

Per AD-03: `origin_city_id`/`destination_city_id` REQUIRED; `origin_airport_id`/`destination_airport_id`/`airline_id` optional with composite-FK consistency guarantee. No `offer_routes` table (no multi-leg in V1).

**Representative-city rule (B8 ratified):** `destination_city_id` remains REQUIRED for ALL trip types (search/index integrity). For `VISA` and `CUSTOM` offers, agents select a logical representative city (e.g., capital or application center) with explanatory copy in the creation wizard. NULL destinations are never allowed as a UX workaround.

### 2.6 Pricing semantics — two orthogonal dimensions, zero ambiguity

| Field | Values | Meaning |
|---|---|---|
| `price_type` | `FIXED` \| `STARTING_FROM` | Display semantics: committed price vs indicative floor |
| `price_basis` | `PER_PERSON` \| `PER_GROUP` \| `TOTAL` | What the amount applies to |

Plus `price_amount NUMERIC(12,2) CHECK (>0)` and `currency CHAR(3)` restricted to platform set (SAR, EGP, AED, USD, EUR — extensible enum).

Display contract (binding for UI): `{amount} {currency}` + basis suffix ("per person"/"للشخص") + pill "يبدأ من" when STARTING_FROM. "Subject to confirmation" is NOT a price state — it is inherent to lead-generation marketplace semantics and communicated once via the Offer/Price Disclaimer page (PRODUCT_SPEC §6). No offer may be published without unambiguous values for both dimensions.

### 2.7 Dates — validity ≠ travel, modeled independently

| Concept | Fields | Semantics |
|---|---|---|
| **Offer validity** (marketplace window) | `valid_from timestamptz`, `valid_until timestamptz` | When the OFFER is visible/buyable-inquiry. Drives expiry job (AD-09). Hard cap ≤90 days from publication. |
| **Travel dates** (the trip itself) | `departure_date DATE null`, `return_date DATE null`, `duration_days INT null`, `flexible_dates BOOLEAN default false` | Nullable = open/flexible departure offer. |

CHECK: `valid_until > valid_from`. App-level publication rule: `valid_until <= published_at + 90 days`.

### 2.8 Contact request states — exact causes

Unified single status (AD-08 deviation #2):

| State | Caused by | Guard |
|---|---|---|
| `NEW` | Traveler submits request | Rate-limited; max ONE active request per traveler per offer (partial unique index) |
| `VIEWED` | Agent opens the request detail (first time) | Sets `viewed_at` once; idempotent |
| `RESPONDED` | Agent submits `response_message` | Only from NEW/VIEWED; sets `responded_at`. **This event grants review eligibility (C3)** |
| `CLOSED` | Traveler closes after RESPONDED, OR auto-close job 30d after RESPONDED | Terminal |
| `CANCELLED` | Traveler cancels while NEW/VIEWED | Terminal |

Terminal states accept no further transitions. Agent cannot close/cancel.

**Formal behavior vs offer state (B7 ratified — documented behavior, not code assumption):**
- Creating a NEW contact_request requires the target offer to be `published`.
- Requests created while the offer was live RETAIN their full rights (viewed → responded → closed, per their permission scopes) even if the offer later becomes `expired` or `archived`. Offer expiry/archival never cancels or degrades existing requests' lifecycles.

### 2.9 Reviews — anchored to the interaction, not just the agent

```text
review 1:1 contact_request (UNIQUE FK, NOT NULL)
        ├→ author_id  (= request.traveler_id, trigger-enforced)
        └→ agent_id   (= request.agent_id,   trigger-enforced)
```

Eligibility rule (C3 + B2 ratified), enforced server-side in the insert/database function — NEVER UI-only: INSERT allowed only when the linked request's `status = 'RESPONDED'` AND `responded_at + interval '90 days' >= now()`, and requester = request.traveler_id; UNIQUE(contact_request_id) caps one review per interaction. Reviews are immutable post-insert for authors (INSERT-only policy); moderation fields admin-only.

---

## 3. ENTITY CATALOG

Legend: **R**=required, O=optional · Derived fields marked ⟲.

### 3.1 users
| | |
|---|---|
| Purpose | App-level identity & role for every human account |
| Fields | `id uuid PK` (= auth.users.id, ON DELETE CASCADE) R · `role enum_user_role {TRAVELER, AGENT, ADMIN}` R default TRAVELER · `display_name varchar(80)` R · `phone varchar(20)` O · `language_pref enum_locale {ar,en}` R default 'ar' · `is_active bool` R default true |
| Relationships | 1:1 auth.users; 1:1 agent_profiles (agents); 1:N contact_requests/saved_offers/reviews/notifications/reports/admin_actions |
| Ownership | Self (limited fields); role changes admin-only server-side |
| Lifecycle | active ⇄ deactivated; no physical delete except erasure requests |
| Indexes | PK; `(role) WHERE is_active` |
| Unique | id (via FK to auth.users which enforces unique emails) |
| Derived | none |
| Security | NO public read. Self read/update (display_name, phone, language_pref only). Admin full. Role column: updates denied to non-admin policies |

### 3.2 agent_profiles
| | |
|---|---|
| Purpose | Public professional identity of a verified(-track) agent |
| Fields | `id uuid PK` R · `user_id uuid UNIQUE → users` R · `display_name` R · `business_name` O · `bio_ar` R(bef.publishing)/`bio_en` O · `photo_url` O · `city_id → cities` O-until-profile-complete · `license_type enum {INDIVIDUAL, AGENCY}` R · `license_number varchar` O (shown only when licensed-doc accepted) · `specialty_tags text[]` default {} · `languages_spoken text[]` default {ar} · `profile_slug varchar UNIQUE` O (future SEO) · `verification_status enum_agent_verification` R default UNVERIFIED · `verified_at timestamptz` O · `joined_at` R default now() · ⟲ `avg_rating numeric(3,2)`, `reviews_count int`, `published_offers_count int`, `response_rate_pct smallint`, `avg_response_hours numeric(5,1)` |
| Relationships | 1:N offers, reviews, verification_requests, agent_badges, contact_requests(agent side) |
| Ownership | Agent self-edit (content fields only); status fields system/admin-only |
| Lifecycle | UNVERIFIED → IN_REVIEW → VERIFIED/REJECTED; → SUSPENDED (admin); REJECTED may resubmit after 30d |
| Indexes | `(verification_status)`; trigram GIN `display_name`; `(city_id)` |
| Unique | user_id; profile_slug |
| Derived | all five metrics — trigger-maintained from reviews/offers/contact_requests |
| Security | PUBLIC READ (this is the public projection of an agent; users table never exposed). Write: owner content-only; status/metrics system-only |

### 3.3 verification_requests
| | |
|---|---|
| Purpose | One auditable review attempt per submission |
| Fields | `id PK` · `agent_id → agent_profiles` R · `status enum_verification {IN_REVIEW, APPROVED, REJECTED, WITHDRAWN}` R · `submitted_at` R · `reviewed_by uuid → users` O · `reviewed_at` O · `decision_note text` O (rejection reason mandatory when REJECTED) |
| Rules | Max ONE row per agent `WHERE status='IN_REVIEW'` (partial unique). Approval also flips profile status (single server-side transaction) |
| Lifecycle | IN_REVIEW → APPROVED/REJECTED; REJECTED → new request after 30-day cooldown; WITHDRAWN by agent while pending |
| Indexes | `(agent_id, submitted_at DESC)`; partial `(agent_id) WHERE status='IN_REVIEW'` |
| Security | Owner read own; ADMIN read/write. Never public. Never client-writable status |

### 3.4 verification_documents
| | |
|---|---|
| Purpose | Sensitive identity/license files per attempt (PRIVATE bucket, AD-06) |
| Fields | `id PK` · `request_id → verification_requests CASCADE` R · `doc_type enum {NATIONAL_ID, TOURISM_LICENSE, COMMERCIAL_REGISTRATION, OTHER}` R · `storage_path text` R · `mime_type` R · `size_bytes int` R (≤ limits) · `status enum {PENDING, ACCEPTED, REJECTED}` R default PENDING · `review_note text` O · `uploaded_at` R · `reviewed_at` O |
| Retention | Per AD-06 policy (purge after final approval / account closure+90d) |
| Indexes | `(request_id)` |
| Security | **Strictest table**: owner read via signed URL only (server-issued); admins same; NO anon/authenticated bulk read; inserts only while own request is IN_REVIEW; no updates/deletes by owners (immutability of submissions) |

### 3.5 countries
| | |
|---|---|
| Purpose | Reference geography root |
| Fields | `id PK` · `iso2 CHAR(2) UNIQUE` R · `name_ar` R · `name_en` R · `is_active` R default true |
| Ownership/Lifecycle | Admin-only CRUD (reference data); effectively static |
| Indexes | iso2; names for autocomplete join |
| Security | Public read; write admin/service-role only |

### 3.6 cities
| | |
|---|---|
| Purpose | Canonical route node + autocomplete source |
| Fields | `id PK` · `country_id → countries` R · `name_ar` R · `name_en` R · `name_ar_normalized` ⟲ generated (diacritic/tatweel-stripped, for trigram search) · `slug varchar UNIQUE` O · `lat/lng numeric` O (future geo) · `is_popular bool` default false (drives homepage/fallback discovery) · `is_active` default true |
| Constraints | UNIQUE(country_id, name_en) |
| Indexes | `(country_id)`; GIN trigram on name columns; partial `(is_popular) WHERE is_active` |
| Security | Public read; admin write |

### 3.7 airports
| | |
|---|---|
| Purpose | Structured flight-granular reference (C1) |
| Fields | `id PK` · `city_id → cities` R · `name_ar` R · `name_en` R · `iata CHAR(3)` O · `icao CHAR(4)` O · `timezone varchar` O (IANA) · `is_active` default true |
| Constraints | **UNIQUE(id, city_id)** — enables composite FK from offers · partial UNIQUE iata WHERE NOT NULL · partial UNIQUE icao WHERE NOT NULL |
| Indexes | `(city_id)`; trigram names |
| Data source | OurAirports (AD-12); codes never invented |
| Security | Public read; admin write |

### 3.8 airlines
| | |
|---|---|
| Purpose | Structured carrier reference |
| Fields | `id PK` · `name_ar` R · `name_en` R · `iata CHAR(2)` O partial-unique · `icao CHAR(3)` O partial-unique · `logo_url` O · `is_active` default true |
| Indexes | trigram names |
| Security | Public read; admin write |

### 3.9 offers
| | |
|---|---|
| Purpose | The core commercial entity — an agent's travel offering under moderation |
| Fields | Identity: `id PK`, `agent_id → agent_profiles` R · Content: `title_ar` R /`title_en` O, `description_ar` R/`description_en` O · Classification: `trip_type enum_trip_type {FLIGHT, PACKAGE, VISA, UMRAH, HOTEL, CRUISE, CUSTOM}` R · Route: `route_type enum_route_type {DIRECT, TRANSIT}` O · `origin_city_id → cities` R · `destination_city_id → cities` R · `origin_airport_id` O · `destination_airport_id` O (composite FKs per AD-03) · `airline_id → airlines` O · Travel dates (§2.7): `departure_date D` O · `return_date D` O · `duration_days int CHECK>=1` O · `flexible_dates bool` default false · Pricing (§2.6): `price_amount numeric(12,2) CHECK>0` R · `currency char(3)` R · `price_type enum_price_type` R · `price_basis enum_price_basis` R · Inclusions: `includes text[]` {} · `excludes text[]` {} · `min_travelers int` default 1 · `max_travelers int` O (CHECK min≤max) · State (AD-08): `status enum_offer_status` R default DRAFT · `valid_from timestamptz` R · `valid_until timestamptz` R · `published_at/expired_at/submitted_at` O · `rejection_reason text` O (set on reject; cleared on resubmit) · Engagement ⟲: `view_count int`, `contact_count int` |
| Constraints | `valid_until > valid_from` · composite airport-city FKs · publication cap 90d (app-enforced, documented CHECK candidate once published_at set) |
| Relationships | 1:N offer_media, contact_requests, saved_offers; N:1 agent, cities, airlines |
| Ownership | Owning agent (create/edit within rules below); admin privileged (logged) |
| Lifecycle | Full transition machine in §4 |
| Indexes | §Search list in AD-11 |
| Derived | view_count (atomic RPC increments only — clients never UPDATE the column), contact_count (trigger over contact_requests) |
| Security | Public read ONLY via `public_offers` projection (status=PUBLISHED AND valid window AND agent VERIFIED, excluding demo in prod). Owner: full CRUD within state rules. Admin: all (audited) |

### 3.10 offer_media
| | |
|---|---|
| Purpose | Ordered images per offer |
| Fields | `id PK` · `offer_id → offers CASCADE` R · `storage_path` R · `alt_text` O · `sort_order smallint` R default 0 |
| Constraints | UNIQUE(offer_id, sort_order) |
| Security | Write: owning agent while offer editable; public read via bucket policy |

### 3.11 contact_requests
| | |
|---|---|
| Purpose | Structured, trackable traveler→agent inquiry (the conversion bridge) |
| Fields | `id PK` · `offer_id → offers` R · `traveler_id → users` R · `agent_id → agent_profiles` R (denormalized = offer.agent_id; trigger-consistent; powers agent inbox + RLS cheaply) · `message text` R (min length enforced app-side) · `traveler_count int` default 1 CHECK≥1 · `travel_dates_note text` O (free-form flexible input per SPEC) · `status enum_contact_status` R default NEW · `response_message text` O · `viewed_at/responded_at/closed_at` O · `is_demo` |
| Constraints | Partial UNIQUE(traveler_id, offer_id) WHERE status IN ('NEW','VIEWED') — one live request per pair (anti-spam) |
| Lifecycle | §2.8 exactly |
| Indexes | `(agent_id, status, created_at DESC)`; `(traveler_id, created_at DESC)`; `(offer_id)` |
| Security | Participant-read only (traveler owner / agent owner). Traveler INSERT (auth, rate-limited, target offer must be `published`). Agent UPDATE limited to viewed/response transition server-side — permitted regardless of the offer's current state once the request exists (B7). No deletes. **Never public** |

### 3.12 reviews
| | |
|---|---|
| Purpose | Trust signal anchored to real interactions (C3) |
| Fields | `id PK` · `contact_request_id → contact_requests UNIQUE NOT NULL` R · `author_id → users` R · `agent_id → agent_profiles` R · `rating smallint CHECK BETWEEN 1 AND 5` R · `content text` R(min) · `is_verified_transaction bool` default false (admin-confirmed trip completion — future use) · `is_visible bool` default true · `moderated_by uuid` O |
| Immutability | Author: INSERT only. Moderation columns: admin-only. Rating/content never edited |
| Eligibility | INSERT permitted iff linked request `responded` ∧ `responded_at + 90 days ≥ now()` ∧ author = its traveler — enforced in the insert function (policy + trigger double-check; B2) |
| Indexes | `(agent_id) WHERE is_visible`; `(contact_request_id)` UNIQUE |
| Security | Public read of visible rows via projection exposing author display name through security-definer view; public rendering = **first name + family-name initial** (e.g., "Ahmed M." — Q3 ratified; privacy-aware implementation in Slice 4); writes per above |

### 3.13 badges
| | |
|---|---|
| Purpose | Catalog of meaningful trust marks (each has criteria — never decorative) |
| Fields | `code varchar UNIQUE` R (e.g., VERIFIED, LICENSED, TOP_AGENT) · `name_ar/name_en` R · `description_ar/en` R (what it guarantees) · `criteria_text` R (how it is earned) · `source enum {MANUAL, DERIVED}` R · `icon_key` R · `is_active` default true |
| Note | VERIFIED/LICENSED render primarily from profile/doc state (DERIVED source = displayed from facts, no row needed); MANUAL badges require explicit `agent_badges` award |
| Security | Public read; admin write |

### 3.14 agent_badges
| | |
|---|---|
| Purpose | Award ledger for manual badges |
| Fields | `id PK` · `agent_id` R · `badge_id → badges` R · `awarded_by → users(admin)` R · `awarded_at` R · `revoked_at` O · `revoke_reason` O |
| Constraints | UNIQUE(agent_id, badge_id) WHERE revoked_at IS NULL |
| Security | Public read (active rows); admin write; all awards audited in admin_actions |

### 3.15 notifications
| | |
|---|---|
| Purpose | Event-driven in-app inbox (AD-10) |
| Fields | `id PK` · `recipient_id → users` R · `type varchar` R (registry: `offer.approved`, `offer.rejected`, `offer.expiring_7d/1d`, `offer.expired`, `contact.received`, `contact.responded`, `review.new`, `verification.approved/rejected`) · `payload jsonb` R (ids + snapshot strings so notifications survive target edits) · `read_at` O |
| Indexes | `(recipient_id, created_at DESC)`; partial unread count |
| Lifecycle | unread→read; purge job 90d post-read |
| Security | Recipient-only read/update(read_at). Inserts: system functions only (security definer), never direct client INSERT |

### 3.16 saved_offers
| | |
|---|---|
| Purpose | Traveler favorites (V1 P1) |
| Fields | `traveler_id → users` R · `offer_id → offers` R · `created_at` R · **PK(traveler_id, offer_id)** |
| Rules | Target must be PUBLISHED at save time; saving an expiring offer feeds the "saved offer expiring" notification |
| Security | Owner-only CRUD; no public surface beyond counts if ever needed |

### 3.17 reports
| | |
|---|---|
| Purpose | Community abuse signaling (schema in V1; admin queue UI deferred) |
| Fields | `id PK` · `reporter_id → users` R · `target_type enum {OFFER, AGENT_PROFILE, REVIEW, CONTACT_REQUEST}` R · `target_id uuid` R · `reason enum {MISLEADING_PRICE, FAKE_OFFER, IMPERSONATION, INAPPROPRIATE_CONTACT_INFO, OTHER}` R · `details text` O · `status enum_report` R default OPEN · `handled_by/handled_at/resolution_note` O |
| Constraints | Partial UNIQUE(reporter_id, target_type, target_id) WHERE status='OPEN' (dedupe spam, allow re-report later) |
| Indexes | `(status, created_at)` |
| Security | Reporter insert (auth) + read OWN reports; admin manage. Targets invisible to other users |

### 3.18 admin_actions
| | |
|---|---|
| Purpose | Append-only audit ledger of every privileged action |
| Fields | `id PK` · `actor_id → users` R (must be ADMIN — trigger-checked) · `action_type varchar` R (registry e.g. `OFFER_APPROVE`, `OFFER_REJECT`, `VERIFICATION_APPROVE`, `AGENT_SUSPEND`, `BADGE_AWARD`, `REFERENCE_UPSERT`, `REVIEW_MODERATE`) · `target_type varchar` R · `target_id uuid` R · `metadata jsonb` O (reasons; E2 major-edit snapshots use the pinned contract `{before, after, changed_fields[]}` — Q2) |
| Immutability | NO update/delete paths exist (policies deny; revoke grants) |
| Indexes | `(target_type, target_id)`; `(actor_id, created_at DESC)` |
| Security | Admin read; system insert (server-side). Never client-insertable |

---

## 4. OFFER LIFECYCLE — BINDING TRANSITION TABLE (implements C4)

```text
CLOSED WORLD — exactly eleven legal pairs (authoritative list in AD-08, B1 ratified):

draft → pending_review → published → expired
             ▲   ▲           │            │
             │   └─ rejected ┘            └→ renewal back to pending_review
             └────────────────────────────────┘
published → pending_review  (major-edit re-review, E2 — matrix pair #7)
{draft, rejected, expired} → archived ; published → archived (unpublish / admin)
```

DB enum labels are lowercase snake_case (B3); UPPERCASE in tables below is presentation only.

| # | Transition | Actor | Preconditions / Validations | Side effects |
|---|---|---|---|---|
| T1 | DRAFT → PENDING_REVIEW | Owning agent | All required fields valid; bilingual title/desc present; price>0; route cities valid & distinct; `valid_until > now()`; no duplicate live offer (same agent + same origin/dest/trip_type + overlapping validity); agent VERIFIED | `submitted_at=now()`; notify admin queue |
| T2 | PENDING_REVIEW → PUBLISHED | Admin (server-side, service-role) | Quality checklist SPEC §5.3; `valid_until ≤ now()+90d` | `published_at=now()`; notify agent; `admin_actions` entry |
| T3 | PENDING_REVIEW → REJECTED | Admin | `rejection_reason` REQUIRED | Notify agent (reason included); `admin_actions` entry |
| T4 | REJECTED → PENDING_REVIEW | Owning agent | Edits address reason (resubmission path of T1 validations) | Clear `rejection_reason`; `submitted_at` refreshed |
| T5 | PUBLISHED → EXPIRED | System job only | `valid_until < now()` | `expired_at=now()`; notify agent; saved-offer holders notified |
| T6 | EXPIRED → PENDING_REVIEW | Owning agent | Renewal validation incl. new `valid_until` | Standard resubmission effects |
| T7 | DRAFT/REJECTED/EXPIRED → ARCHIVED | Owner anytime | Terminal; hidden everywhere | — |
| T7b | PUBLISHED → ARCHIVED | Owner (unpublish) or Admin | Terminal; hidden everywhere | `admin_actions` entry when actor=admin |
| E1 | Edit while PUBLISHED (no transition) | Owning agent | Minor fields only (descriptions, media, includes/excludes) apply directly | `updated_at` bump; moderation diff note |
| E2 | Edit PRICE / ROUTE / DATES / VALIDITY while published (matrix pair #7) | Owning agent | Forces `status=pending_review` atomically with the edit; snapshot contract pinned (Q2 ratified): `jsonb {before, after, changed_fields[]}` stored for the reviewer | Re-enters T2/T3 flow — implements SPEC §4.2 price-change policy. Redesigning this contract mid-migration is prohibited; a genuine technical blocker must be raised as a new decision |

Guards: the matrix is a **closed world** — transition functions implement an explicit whitelist of exactly the eleven ratified pairs, and a trigger asserts legal pairs inside one transaction; any unlisted pair (including ad-hoc client status UPDATE) is denied by default.

---

## 5. PERMISSION MATRIX

Adjusted from the Phase-2 draft to match the model ("✓" allowed, "—" denied; parenthetical = scope restriction; all admin privileged ops are logged):

| Action | Guest | Traveler | Agent | Admin |
|---|---|---|---|---|
| Browse published offers / reference data | ✓ | ✓ | ✓ | ✓ |
| View public agent profiles / reviews | ✓ | ✓ | ✓ | ✓ |
| Register (traveler / agent) | ✓ | — | — | — |
| Manage own account & prefs | — | ✓ (own) | ✓ (own) | ✓ |
| Edit own traveler identity | — | ✓ | — | ✓ |
| Edit own agent profile content | — | — | ✓ (own) | ✓ |
| Create offer (draft) | — | — | ✓ (own, verified) | ✓* |
| Submit offer → PENDING_REVIEW | — | — | ✓ (own) | ✓* |
| Approve / Reject offer | — | — | — | ✓ |
| Edit published offer minor fields | — | — | ✓ (own) | ✓* |
| Trigger re-review edit (E2) | — | — | ✓ (own) | — |
| Archive own offer | — | — | ✓ (own) | ✓ (any) |
| Submit verification request + docs | — | — | ✓ (own) | — |
| Review/approve/reject verification | — | — | — | ✓ |
| Read verification documents | — | — | ✓ (own, signed URL) | ✓ (signed URL) |
| Create contact request | — | ✓ (on PUBLISHED offers) | — | — |
| View contact request | — | ✓ (own) | ✓ (own inbox) | ✓ |
| Mark viewed / respond | — | — | ✓ (own inbox) | ✓* |
| Close / cancel own request | — | ✓ (rules §2.8) | — | — |
| Submit review | — | ✓ (eligible per C3 + 90-day window B2, 1/request) | — | — |
| Moderate reviews (visibility) | — | — | — | ✓ |
| Save/unsave offers | — | ✓ | — | — |
| Read own notifications / mark read | — | ✓ | ✓ | ✓ |
| File report | — | ✓ | ✓ | — |
| Handle reports | — | — | — | ✓ |
| Manage reference data (countries/cities/airports/airlines/badges) | — | — | — | ✓ |
| Award/revoke badges | — | — | — | ✓ |
| Suspend/reactivate agents | — | — | — | ✓ |
| Read audit log | — | — | — | ✓ |

\* Admin "support" actions operate through service-role Server Actions and always write `admin_actions`.

---

## 6. RLS / SECURITY MODEL (conceptual per table)

Legend — Anon: unauthenticated JWT · Auth: any authenticated · Own: row ownership · Admin: `user_role='ADMIN'` claim (or is_admin()) · SR: service-role bypasses RLS (server-side only, audited).

| Table | Anon SELECT | Auth SELECT | INSERT | UPDATE | DELETE | Notes |
|---|---|---|---|---|---|---|
| users | ✗ | own row | ✗ (created via signup function) | own (safe fields) | ✗ | Role/status immutable to self; admin via SR only |
| agent_profiles | public projection only | full row if owner | ✗ (created server-side at agent signup) | own content fields | ✗ | Public reads via view filtering VERIFIED+suspended handling |
| verification_requests | ✗ | own | own while eligible | ✗ (transitions server-side) | ✗ | Withdraw = status change via function |
| verification_documents | ✗ | own (path check) | own into own IN_REVIEW request | ✗ | ✗ | Signed URLs issued server-side; bucket itself private |
| countries / cities / airports / airlines | ✓ (active rows) | ✓ | ✗ | ✗ | ✗ | Writes: admin tooling via SR + audit |
| offers | ✗ direct | own (all states); others see nothing raw | agent own (DRAFT) | own per state rules | ✗ | **Public consumption exclusively via `public_offers` view** (PUBLISHED ∧ valid ∧ agent VERIFIED ∧ demo filter) |
| offer_media | ✗ direct | owner | owner | owner (while editable) | owner | Bucket handles public image read |
| contact_requests | ✗ | participant rows only | traveler (validated insert fn) | ✗ direct (transition functions only) | ✗ | Anti-reconnaissance: agents see only own inbox |
| reviews | visible rows via projection | ✓ same | eligible traveler (fn) | ✗ authors | ✗ | Moderation cols via SR |
| badges | ✓ active | ✓ | ✗ | ✗ | ✗ | Admin via SR |
| agent_badges | ✓ active | ✓ | ✗ | ✗ | ✗ | Awards via SR |
| notifications | ✗ | recipient only | ✗ (system definer) | recipient (read_at only) | ✗ | Purge job via SR |
| saved_offers | ✗ | own | own | ✗ | own | — |
| reports | ✗ | own filed rows | auth (rate-limited) | ✗ | ✗ | Handling via SR |
| admin_actions | ✗ | ✗ | ✗ (system only) | ✗ | ✗ | Admin SELECT; append via SR |

Standing rules:
1. Clients hold only the anon key; every privileged mutation is a Server Action using service-role + validation + audit write.
2. `service_role` key never appears in client bundles (import-lint enforced, AD-14).
3. Views are `security_invoker` unless deliberately `security_definer` (public projections, review-author names) — each definer view documented here: `public_offers`, `public_agent_profiles`, `visible_reviews_with_author`.
4. Rate limiting: DB-level guards (partial uniques) + edge middleware on auth/contact/report mutations.

---

## 7. DERIVED FIELDS — MAINTENANCE CONTRACT

| Derived | Source of truth | Mechanism |
|---|---|---|
| agent_profiles.avg_rating, reviews_count | reviews (visible) | Trigger on reviews INSERT/moderation |
| agent_profiles.published_offers_count | offers status | Trigger on offers status change |
| agent_profiles.response_rate_pct, avg_response_hours | contact_requests timestamps | Recomputed daily (pg_cron) over rolling 90d window; needs ≥5 samples before displayed (audit recommendation) |
| offers.contact_count | contact_requests | Trigger increment/decrement on insert/state change |
| offers.view_count | anonymous events | Atomic RPC `record_offer_view` (upsert-dedupe per session; clients never touch column) |
| cities.name_ar_normalized | name_ar | Generated column (search normalization) |

Rule: no application code writes derived columns directly; tests assert trigger correctness (AD-13).

---

## 8. ENTITIES EVALUATED AND POSTPONED / REJECTED

| Candidate | Verdict | Reason |
|---|---|---|
| profiles (traveler) | **Rejected** | §2.1 — premature normalization |
| offer_routes | **Rejected (V1)** | No multi-leg requirement (AD-03) |
| follows | **Postponed** | Community-layer feature, out of V1 |
| posts / community content | **Postponed** | Explicitly out of V1 |
| conversations / messages | **Rejected (V1)** | Chat is out of scope; structured single-response contact covers the loop |
| payments / transactions | **Rejected (V1)** | Deliberate business decision (MVP_SCOPE) |
| saved_searches / alerts | **Postponed** | MVP_SCOPE defers |
| multi-currency conversion tables | **Postponed** | Honest per-currency display in V1 (AD-11) |

---

*Document Owner: Architecture + Data*
*Companion: ERD.md (visual relationships + existence rationale)*
