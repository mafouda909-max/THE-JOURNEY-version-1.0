# THE JOURNEY / الرحلة — MASTER EXECUTION REPORT & PLAN

> Version 1.0 · Post-rebuild audit · Status vocabulary per rule §75:
> **IMPLEMENTED / PARTIALLY / DOCUMENTED / PLANNED / BLOCKED**

---

## A. Current Product State

| Area | State | Evidence |
|---|---|---|
| Traveler: landing → search → filter → results | IMPLEMENTED | `/`, `/offers` + `OffersBrowser` (real-time, counts, empty state) |
| Offer detail (price basis, includes/excludes, validity timer) | IMPLEMENTED | `/offers/[id]` |
| Contact request lifecycle (create, dup-protection, tracking status) | PARTIALLY | `POST /api/contact-requests` + 24h throttle + inline status; **BLOCKED on auth** for cross-session traveler tracking (spec §4.6) |
| Agent profiles + trust indicators (badges, response data, trips, years) | IMPLEMENTED | `/agents`, `/agents/[id]` |
| Verified-transaction reviews | IMPLEMENTED | `reviews.isVerifiedTransaction` + UI; review *submission* flow is PLANNED (needs interaction proof) |
| Admin offer moderation (approve 90d / reject with reason) | IMPLEMENTED | `/review`, PATCH `/api/offers/[id]` — verified live |
| Admin contacts feed + funnel | IMPLEMENTED | `/review` funnel strip from `events` table |
| Agent registration / dashboard / offer creation | PLANNED (P2) | Requires auth; deliberate demo scope cut |
| Destinations discovery | IMPLEMENTED | `/destinations`, `/destinations/[slug]` — real data only |
| SEO technical | IMPLEMENTED | `sitemap.ts`, `robots.ts` (disallow `/review`, `/api`), JSON-LD on offer + destination pages, per-page Arabic metadata |
| Analytics (event taxonomy + funnel) | IMPLEMENTED | `events` table, `/api/events`, `trackEvent` server-side (landing/offer/agent), client (search/contact), funnel on `/review` |
| Offer view + contact counters (spec §4.7 agent analytics) | IMPLEMENTED | incremented on read/submit |
| Abuse prevention | PARTIALLY | validation, 24h duplicate throttle, no-contact-info policy in copy; global rate limiting PLANNED |
| Email/notification engine | PLANNED (P3) | post-demo |
| Mobile native | PLANNED (P8) | responsive web first, per doctrine |

## B. Technical State

- Next.js 16 (App Router) + PostgreSQL + Drizzle; server components query DB directly; route handlers for mutations. **IMPLEMENTED**
- Tables: `agents`, `offers`, `contact_requests`, `reviews`, `events`. Indexes: PKs only — **add indexes on `offers.status`, `events.name`, `contact_requests.offer_id` before traffic (P1)**.
- Health probe `/api/health`; all pages `force-dynamic` (live data).
- Env: `DATABASE_URL` (set), `NEXT_PUBLIC_SITE_URL` (set in prod for sitemap/OG), `R2_*` optional for media store (`/api/media` degrades to 503-config card).
- Auth/RLS: not applicable in this stack (no Supabase in the rebuild); **agent/admin auth is the top P2 dependency.**

## C. Brand State

- "Ink & Horizon" system: IMPLEMENTED across all surfaces (deep ink `#1A2B6D`, warm stone, gold ≤2/screen, verified green only for trust, `#F6F7FA`, 8px radius, IBM Plex Sans Arabic + Plex Mono tabular numerals, RTL-first, western numerals, route-mark + destination dot).
- Brand story (traveler-as-hero arc) and positioning are DOCUMENTED in this file §Story below; on-site expression lives on `/` hero + `/trust`.

## D. Business State

- Revenue: none collected — **by design** (Trust precedes Revenue, §80). First pricing hypotheses are P4 experiments, validated manually before billing is built (§57–58).
- Supply: 9 agents, 17 offers (14 published / 2 pending / 1 rejected demo of policy enforcement), 10 reviews, 3 live contact flows.

## E–G. Gaps, broken pieces, launch blockers

1. **Auth & role separation** — the only hard blocker for real supply (P1→P2).
2. **DB indexes** (above) before any paid traffic (P1).
3. **Email deliverability** for the 48h response promise to work end-to-end (P2).
4. Legal texts are drafted as product copy at `/trust` — **lawyer review tag required before public launch (§68).** DOCUMENTED, not legal advice.

## H. Revenue architecture (post-traction, multi-layer per §22–27)

1. **Agents SaaS tiers** (Free acquisition → Pro leads/analytics → Business teams → Enterprise networks) — highest-value layer (§27: *Travel Agent OS*: CRM, leads, offers, follow-ups, reputation).
2. Qualified-lead bundles (quality-gated; never sell junk leads).
3. Clearly-labeled sponsored placements (never disguised as organic — §25).
4. Traveler value-added services (concierge/assistance; core search stays free).
5. Partnerships (insurance, telecom, transport) — no pivot into booking.

## I. Growth plan

- **Flywheel**: agents↑ → offers↑ → choice↑ → traveler value↑ → leads↑ → agent revenue↑ → agents↑.
- **First 100 agents**: manual outbound (list of licensed agencies from public registries → qualification call → white-glove onboarding → first offer published with review priority → first lead within 7 days or concierge follow-up). KPIs: time-to-first-offer, time-to-first-lead, 4-week active rate.
- **First 1,000 travelers**: SEO surface (destinations/offers pages) + trust-content pillars (fraud warnings, how to choose an agent, visa guides) + Umrah/Georgia intent campaigns; funnel target view→contact ≥ 3%, measured on `/review` funnel.
- Ad creative only after organic funnel baseline exists; never trust-eroding hooks (§67).

## J. Risks

Trust signal dilution · junk-lead temptation · agent churn after first failed SLA · regulatory variance per market → mitigations embedded (immutable reviews, 48h SLA surfaces, offered-rejected policy demo, per-market legal review gate).

## K. Recommended order

P1 indexes → P1 auth dependency (agents/admin) → P2 agent dashboard + email → P2 launch gate → P3 growth experiments → P4 pricing validation → P5+ SaaS/Automation/AI/Mobile.

## L. Immediate next slice

**Agent self-serve onboarding (auth-gated) with offer creation into `pending_review`** — the single piece that turns supply from seeded to real.

---

# OPERATIONS MANUAL (embedded)

**Daily:** moderation queue SLA 48h · response-failure check (contacts without `responded` >48h → nudge agent) · new-contact audit · funnel glance.
**Weekly:** growth review (funnel, top offers by view/contact) · publish 2 trust-content pieces · agent activity review (inactive >14d → outreach).
**Monthly:** P&L shell · retention cohort of contacts · pricing-experiment review · roadmap gate per §60 (no feature creep).
**Incidents:** data issue → freeze deploys, `drizzle-kit push` rollback via snapshot dump; abuse spike → raise throttle to 1/offer/7d per email; moderation dispute → second-reviewer rule.

# Roadmap phases (per §59)

0 Foundation ✅ · 1 MVP core ✅ · 2 Auth + agent dashboard + launch gate (next) · 3 Growth/SEO/content + notifications · 4 Monetization experiments → validated tiers · 5 Travel Agent OS (SaaS) · 6 Automation (lead SLA escalation, expiry reminders) · 7 AI (drafting/moderation/ranking, only after data) · 8 Mobile · 9 Scale/partnerships · 10 Exit hygiene (clean IP, reproducible deploy, vendored deps list, this document set).

*Every scope decision obeys §83: if it doesn't serve Trust, Discovery, Leads, Response, Retention, or Revenue at this stage, it waits.*

---

# GROWTH OS — STAGE 3/4 SUBSTRATE (IMPLEMENTED THIS PHASE)

Per the expansion doctrine's own sequencing ("build only the first validated stage"), the Growth OS foundation is now real infrastructure instead of future-tense architecture:

| Layer | State | Implementation |
|---|---|---|
| Content pipeline (calendar) | IMPLEMENTED | `content_items` table: draft → in_review → approved → scheduled/published → measured; UI on `/review` "مكتب النمو"; `PATCH /api/growth` enforces legal transitions (422 on skips) |
| Human approval risk-gate (§7/§26) | IMPLEMENTED | `risk: low/medium/high`; medium+high cannot be approved from draft; high-risk (e.g., WhatsApp expiry template) seeded as draft-only |
| Campaigns | IMPLEMENTED (read model) | `campaigns` with objective/audience/hypothesis/KPI/statuses; seeded "عمرة بلا قلق" (active) + "القوقاز للجميع" (planned) |
| Experiments / Growth memory (§30/§53) | IMPLEMENTED | `experiments` with hypothesis/metric/result + Keep/Kill/Iterate/Scale decisions via PATCH; seeded incl. a *killed* experiment (kill decisions recorded, not hidden) |
| Attribution (§29) | IMPLEMENTED | `utm_source/medium/campaign` captured on contact form → stored on `contact_requests`; leads-by-source cards on Growth Desk |
| AI multi-agent / social adapters / WhatsApp connectors | DOCUMENTED → PLANNED | Provider-agnostic seams: content pipeline already models channels; `/api/growth` is the execution surface agents would call through the same risk gates. Not built: no fake connectors, per §62 build-vs-validate |
| Lead scoring / CRM pipeline extension | PLANNED (Stage 7) | Requires real lead volume first |

Design invariants kept: no MVP schema breakage (contact-request state machine untouched, attribution is additive), no trust-eroding automation (publishing stays approval-gated), model-agnostic by construction (no AI calls exist in code yet — the seams are data and API, not vendor SDKs).
