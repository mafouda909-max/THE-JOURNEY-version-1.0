# SILA Repository Asset Map — Marketplace + Community

> Snapshot audited: `main` repository tree, 2026-11-25  
> Purpose: identify reusable product assets, distinguish implemented code from gated pilots and historical plans, and define the shortest safe path to an integrated travel marketplace with a first-class community.  
> This is a repository/code audit. It does not prove current Production environment configuration, real supplier contracts, live inventory, paid demand, payment processing, or legal readiness.

## 1. Executive result

The repository already contains substantial foundations for an integrated travel marketplace:

- Public travel offers, agent profiles, destination pages, traveler inquiries, and trust/moderation.
- A separate agency commercial operating system: clients, opportunities, source-linked inquiries, supplier options, immutable quote versions, quote delivery and response.
- A gated service fulfillment pilot connecting an accepted quote line to partner work, delivery acceptance/rework, and SILA coordination-fee records.
- Traveler saved-intent/workspace capabilities that connect search, offers, comparison, readiness and agency inquiries.
- A community foundation with moderated posts, helpful reactions and travel context.
- A native agent runtime, replaceable provider adapters and a capability registry.

The gap is **not** “build a marketplace from zero.” The gap is to compose these foundations into one coherent market model and complete missing public journeys without creating parallel catalog, CRM, quote, trip, community or provider systems.

### Repository scale observed on main

| Surface | Observed count |
|---|---:|
| Tracked files in recursive Git tree | 557 |
| Application API route files | 63 |
| Application page files | 30 |
| Test files (including browser/production suites) | 124 |
| Files under `src` | 300 |
| Native mobile app files | 31 |
| Product/architecture docs under `docs/` | 14 |
| SQL/release assets under `db/` | 19 |
| Market UI components | 16 |

Counts come from the repository's recursive `main` tree. They are inventory counts, not measures of feature completeness.

## 2. Evidence vocabulary

Use these labels throughout the next implementation cycle:

- **IMPLEMENTED (code):** route/component/domain logic and relevant tests exist.
- **PARTIAL:** a usable slice exists, but the complete product journey is absent.
- **GATED:** code exists, but an explicit environment/workspace/activation gate prevents use.
- **PLANNED:** the current code/docs do not establish an implementation.
- **HISTORICAL / REVALIDATE:** older plans or branch notes; not proof of current main behavior.
- **UNKNOWN:** evidence is insufficient. Do not promote unknowns to implementation claims.

A code-level implementation is not the same as an enabled Production capability. Environment examples and old deployment reports do not prove current Vercel values.

## 3. Reusable assets by product domain

### A. Public marketplace and supply

**Existing assets**

- Public routes/pages: `/offers`, `/offers/[id]`, `/agents`, `/agents/[id]`, `/destinations`, `/destinations/[slug]`.
- UI: `OfferCard`, `OffersBrowser`, `SearchModule`, `ContactForm`, `AgentTrust`, `ShareOfferButton`, `SaveOfferToIntentButton`.
- APIs: `/api/offers`, `/api/offers/[id]`, `/api/agents`, `/api/agents/[id]`, `/api/contact-requests`, `/api/contact-requests/[id]`.
- Data/domain: `offers`, `agents`, `agent_documents`, `contact_requests`, public agent projections and trust-evidence evaluators.
- Tests: `marketplace-db`, `marketplace-workflow-db`, `marketplace-inquiry-adoption-db`, `offers-browser-contract`, `offer-review-lifecycle-db`, `public-marketplace-security`, `public-trust-claims`, `zero-supply-experience`.

**What is already implemented**

- Discovery is based on published, unexpired offers.
- Public eligibility is tied to an agent's verified state and current scoped evidence; expired, missing or unreviewed evidence fails closed.
- Private license/KYC identifiers are excluded from public agent projections.
- Offers can be reviewed/moderated before publication.
- Travelers can send inquiries; ownership and agent scope are checked for authenticated feeds.
- Destinations and public pages use real stored content; zero supply is represented explicitly rather than filled with fake inventory.

**Structural limitation**

The current public `offers` model is travel-trip/package shaped (agent, trip type, origin/destination, dates/duration, price, includes/excludes, expiry and status). It is a useful public travel offer, but it is not yet a generic reusable listing model for every travel product/service category (hotel room, flight fare, transfer, activity, insurance, tour, visa-support service, etc.).

**Decision**

Keep the existing offer and public trust paths. Do not replace them. During the domain RFC, decide how new listing kinds relate to existing offers and how each listing points to a provider and freshness/availability evidence. Do not silently turn today's package offer into a universal product schema.

### B. Agency / B2B commercial operating system

**Existing assets**

- Pages/components: `/account/agency`, `/account/agency/opportunities/[opportunityId]`, agency workspace panel, commercial pipeline, metrics, quote-delivery panel, services page, partner page.
- APIs: agency workspaces, memberships, metrics, commercial commands, inquiry adoption, opportunity detail, quote deliveries, service orders and partner operations.
- Schema: `src/db/agency-schema.ts`, `db/phase1_agency_foundation.sql`, `db/phase2_agency_commercial_domain.sql`, and later phases.
- Domain services: `agency-access`, `agency-policy`, `commercial-domain`, `commercial-service`, `quote-delivery-*`, `agency-client-travel-brief`.
- Tests: agency foundation/DB, commercial domain/workflow/e2e, metrics semantics, quote-delivery integrity/loop, traveler-intent-to-commercial e2e.

**What is already implemented**

- Agency workspace and membership boundary (owner/member).
- Agency client records and sales opportunities.
- Source reference from marketplace contact request to an opportunity, with uniqueness preventing duplicate adoption of the same inquiry into the same workspace.
- Versioned travel intent snapshots and provenance on opportunities.
- Supplier options captured against a particular opportunity, with category, supplier name, cost, expected commission, source type/reference, observed time and optional validity.
- Quotes with immutable versions, line-level supplier/price details, delivery preparation/activation and client response loop.
- Commercial metrics and operating views.

**Important distinction**

`agency_supplier_options` is an opportunity-scoped sourcing record, not a reusable, searchable public supplier directory. An option is a dated claim/proposal in a specific sales opportunity, not proof that the supplier has a verified business profile or live inventory.

**Decision**

Reuse this as the B2B operating layer. Keep quote versions as the canonical proposal aggregate. Extend its links to the eventual shared provider/listing/request models; do not create a second CRM, inquiry, quote or proposal system.

### C. Service fulfilment and partner network

**Existing assets**

- Pilot documentation: `docs/service-fulfillment-pilot.md` and `docs/service-commercial-validation.md`.
- Schema/migration: `db/service_fulfillment_pilot.sql` (separate activation path).
- APIs/pages: agency service orders, partner service orders, status-link, agency services and partner pages.
- Tests: `service-fulfillment-domain`, `service-fulfillment-db`, `service-operations-domain`, browser service-fulfillment test.

**Implemented pilot behavior**

- Office selects a supplier-backed line from an accepted/won quote.
- A service order snapshots the accepted line's service name, currency, cost and selling context.
- Partner accepts/declines, starts work and submits delivery reference.
- Office can request rework, accept delivery or cancel a nonterminal order with a reason.
- Service fee/cost/refund evidence is append-only and guarded by revisions/ownership.
- Partner DTO intentionally excludes customer identity, quote selling price, SILA fee, office margin and private commercial notes.

**Commercial boundary**

The documented pilot is Model B: the office contracts with and pays the supplier directly; SILA records a coordination fee. Supplier cost and office selling price are not SILA revenue. This is not escrow, payment initiation, automated supplier payout or an online checkout/payment rail. An accepted delivery is not proof of payment.

**Activation boundary**

`SERVICE_FULFILLMENT_PILOT_WORKSPACE_IDS` is a strict allowlist; an empty value disables this pilot. The SQL is intentionally separate from the normal release manifest. Staging migration, native PostgreSQL tests, browser proof and owner-approved Production activation are distinct steps.

**Decision**

Reuse this as an operational fulfilment lane, not as the marketplace's universal booking/order object yet. First define the common lifecycle and the role of a Trip/Request/Quote/Order. Keep the current pilot isolated until its own gates pass.

### D. Traveler identity, saved intent and workspace

**Existing assets**

- Pages: `/join`, account home, requests, travel workspace, compare, readiness.
- APIs: `/api/traveler/intents`, intent-offer links, contact requests, travel compare, travel readiness and traveler memory.
- Schema: `accounts`, `sessions`, `traveler_saved_intents`, `traveler_intent_offers`, inquiry linkage, readiness memory.
- Tests: traveler workspace contract/DB/migration guard, traveler intent-commercial e2e, readiness memory/DB and travel comparison.

**What is already implemented**

- Account/session role boundary.
- Saved intent records with JSON snapshots and ownership checks.
- Offers can be associated with a saved intent; a bounded comparison set is enforced.
- Intent-linked inquiries connect the traveler to the contact-request and agency-opportunity source chain.
- Readiness and memory flows preserve owner scoping and avoid treating AI/web synthesis as verified travel rules.

**Limitation**

The current saved intent is a versioned/snapshotted travel context, not a complete multi-service Trip aggregate with first-class TripItems, multiple travellers/legs, service selections, request history, shared participants and a unified status timeline. The exact generic trip boundary is a domain decision for RFC #103, not a reason to create another unrelated intent table.

**Activation boundary**

`TRAVELER_WORKSPACE_ENABLED` defaults to false in `.env.example`; relevant APIs/pages fail closed when disabled. Confirm current environment state separately before claiming the workspace is live in Production.

**Decision**

Extend the existing traveler intent/workspace as the migration source. Define how it evolves into a canonical Trip and how saved intent history is migrated or projected; preserve ownership and provenance.

### E. Community (first-class product pillar)

**Existing assets**

- UI: `/community`, `CommunityComposer`, `CommunityHelpfulButton`.
- APIs: `GET/POST /api/community/posts`, moderation `PATCH /api/community/posts/[id]`, helpful reaction `POST /api/community/posts/[id]/helpful`.
- Domain: `src/lib/community.ts`.
- SQL: `db/community_v1.sql`, `db/community_v1_rollback.sql`; Drizzle model in `src/db/schema.ts`.
- Tests: `tests/community-contract.test.ts` and community-related checks in wider product suites.

**What is already implemented**

- Post types: question, experience, update, guide.
- Destination country/city and topic metadata.
- Authenticated post submission into `pending_review`.
- Admin publish/reject/hide moderation actions with audit entries.
- Public list of published posts and helpful reaction with duplicate protection.
- Feature gate `COMMUNITY_ENABLED`, which defaults false in `.env.example`.
- Additive migration creates posts, comments and reactions without rewriting marketplace/trust tables.

**Material gap**

The database contains `community_comments` and a `comment_count` field, but the audited tree does not contain a comment API route or comment/reply UI workflow. The community is therefore more than a static mock, but not yet a complete discussion product. There is no evidenced threaded reply, comment moderation surface, report/appeal workflow, author conversation notifications or a tested community-to-marketplace conversion journey as one complete flow.

**Decision**

Keep Community as a first-class pillar beside the marketplace. Complete comments/replies, moderation/reporting, trust/source labels and useful connection points to Trip/Intent/Request. Do not activate broad public posting before operational moderation, privacy, abuse limits and migration gates are proven.

### F. Travel intelligence, supplier integrations and AI

**Existing assets**

- Readiness, evidence, travel comparison, visa grounding, travel alerts, preparation dossier, supplier normalization and provider adapters.
- Amadeus adapter: `src/lib/travel-suppliers/amadeus.ts`, normalization/types/index; flight comparison API and UI.
- Provider registry: `src/lib/capabilities/*`; provider gateway and AI/document/web/email/storage adapters.
- Agent runtime: `src/lib/agent-runtime/*`, SILA agent kernel/runtime/OS and tool registry.
- Tests: capability boundaries/runtime/health, flight feature gate, readiness evidence/policy, travel comparison, travel intelligence safety, provider runtime and model router.

**Current capability boundary recorded in docs/code**

- Flight search/comparison is read-only and gated; it is not ticket booking or issuance.
- Amadeus readiness depends on credentials and `FLIGHT_COMPARE_ENABLED`.
- Hotels, GDS/NDC breadth, visa supplier data, currency, geo, payments, social, WhatsApp and production MCP are listed as planned in the capability registry.
- Provider connectivity, a returned provider claim, and a verified travel fact are separate states.
- Missing provider or data must degrade explicitly; AI synthesis is not a source of truth.

**Decision**

Keep travel intelligence as a decision-support layer attached to the relevant marketplace/traveler journey. Introduce each connector behind the owned capability/provider contracts, only after evidence/freshness, permissions, cost, failure behavior and tests are defined. Do not install multiple orchestration frameworks over the existing agent runtime.

### G. Mobile application

**Existing assets**

The `mobile/` tree contains an Expo app, API client/context/endpoints/types, cache, config, validation, theme/brand tokens and screens for offers, offer detail, agents and status. It has dedicated unit/contract tests.

**Limitation**

The tree does not evidence feature parity for community, multi-service Trip, B2B agency workspace, quotes or fulfilment. Treat native mobile as an existing client foundation, not proof that every web marketplace workflow is available on mobile.

**Decision**

Keep API contracts channel-neutral. Complete core web journeys and stable API contracts first, then add mobile surfaces by journey priority; do not fork business logic into mobile.

## 4. Cross-cutting assets and open-source research

| Asset | Current repository decision | How it helps the marketplace |
|---|---|---|
| SILA Agent Runtime / Gateway | Adopt internal SILA-owned patterns; not an OpenClaw fork | Scoped travel, trust, moderation, agency and ops assistance behind SILA auth/policy. |
| OpenClaw patterns | Adopt selected patterns only | Gateway/tool/policy/session/provenance patterns; not a second platform runtime. |
| Refero | Adopt as design research reference | Styles, screens and flows before substantial new product surfaces. |
| LiteLLM | Study / pilot candidate | Model routing/fallback/cost controls if a measured need appears. |
| Langfuse | Study / pilot candidate | Traces, latency/cost and model evaluation before wider agent expansion. |
| pgvector | Study | Extend PostgreSQL for measured semantic retrieval use cases. |
| Firecrawl | Study | Source acquisition adapter only if provenance/freshness can be retained. |
| Trigger.dev | Study | Durable jobs if existing Vercel request lifecycle is insufficient. |
| Vercel AI SDK | Study | UI streaming/tool interactions where a concrete UX requires it. |
| n8n | Watch | Optional internal operations connector; not the core runtime. |
| LangGraph / Temporal / CrewAI / AutoGen-like stacks | Watch/reject for now per radar | Avoid duplicate orchestration/control planes without a proven gap. |

Reference: `SILA_OPEN_SOURCE_RADAR.md`, `SILA_AGENT_RUNTIME_ARCHITECTURE.md`.

**Admission rule:** no external repository/package is adopted merely because it exists. It must solve a demonstrated gap, avoid duplicate ownership, preserve SILA authorization, have compatible licensing and cost, degrade safely, be testable and be removable.

## 5. Canonical domain: what should connect

The target is one connected product, not disconnected feature tabs.

```text
Traveler / Guest ─────────────── Community
      │                            │
      │ Trip / Intent              │ Question / Experience / Guide
      │                            │
      ├──── Search & Discovery ◄───┘
      │            │
      │         Listings
      │            │
      │      Provider identity
      │            │
      ├──── Compare / Save
      │            │
      ├──── Request / Inquiry ─────── Agency Workspace
      │                                  │
      │                              Opportunity
      │                                  │
      │                           Supplier evidence/options
      │                                  │
      │                          Versioned quote / response
      │                                  │
      └──── Trip timeline ◄──── Accepted order / fulfilment
                                         │
                                Partner delivery / acceptance

Trust, provenance, freshness, moderation, audit, authorization and notifications
are cross-cutting constraints across these paths.
```

This is a target relationship map, **not** a statement that every box is already implemented.

## 6. Main gaps ranked by dependency

| Priority | Gap | Why it matters | Reuse before build |
|---|---|---|---|
| P0 | Stabilize security and release baseline | Existing CI reports a production dependency audit failure (tracked separately in #105); unsafe baseline blocks reliable iteration | Existing CI, dependency audit and release gates |
| P1 | Canonical marketplace domain RFC | Current offers, supplier options, saved intent, agency quote and service order have overlapping but different meanings | Existing domain/evidence audit and schemas; issue #103 |
| P1 | Reusable provider identity + travel taxonomy | An agent profile is not every supplier/business; opportunity supplier option is not a public reusable supplier | `agents`, agency membership, scoped trust, supplier options as snapshot |
| P1 | Listing types and discovery contracts | Current package-shaped offer cannot represent the full range of travel products without overloading fields | Existing `offers`, search/browser, destinations and public DTOs |
| P1 | Community discussion completion | Comments table exists but no audited route/UI workflow; no complete moderation/reply loop | Posts, helpful reactions, audit and community migration |
| P1 | Unified Trip/Request lifecycle | Intent and contact request work, but there is no proven multi-service trip aggregate | Saved intents, intent-offer links, inquiries, quote chain |
| P2 | Cross-domain linkage | Community knowledge, listings, trips and agency execution need explicit links and source provenance | Existing source refs, agency opportunity lineage, quote versions |
| P2 | Public supply and moderation operations | Marketplace quality depends on real providers, current evidence and response/quality operations | Existing agent onboarding, verification, admin queue and events |
| P3 | Supplier connector expansion | Current provider integrations are limited/gated/read-only | Capability registry, provider gateway and Amadeus adapter |
| P3 | Booking/payment execution | No live checkout, escrow, payment initiation or ticket issuance is evidenced | Keep separate until commercial, legal and operational model is approved |
| P3 | Mobile journey parity | Existing mobile app is a small client foundation | Reuse API contracts and design tokens |

## 7. Recommended implementation sequence

### Gate 0 — repository and release stabilization
- Keep security remediation #105 separate from marketplace domain work.
- Keep PR #104 documentation-only until its exact-head CI is green; it must not obscure the baseline audit failure.
- Reconcile large/stale product PRs before adopting their code. In particular, preserve the marketplace + community product direction when reviewing PR #102; compare overlapping UI work in #101 and #102 instead of merging both blindly.
- Do not merge or deploy by documentation review alone.

### Gate 1 — domain RFC (documentation only)
Deliver `docs/SILA_MARKETPLACE_DOMAIN_RFC.md` through issue #103. It must decide:
- Provider/business identity and provider roles.
- Category/taxonomy and listing kinds.
- Listing price, availability, source, observedAt, validUntil and scope.
- Trip/TripItem and saved-intent migration/projection.
- Search, compare, request/inquiry, quote, order and service-fulfilment relationships.
- Community post/comment/report links to destinations, listings and trips.
- API ownership, authorization, migration order, test matrix and unresolved decisions.

No schema/code migration until the RFC is reviewed and accepted.

### Gate 2 — provider and taxonomy foundation
- Reuse existing agent identity/trust and agency account boundaries.
- Introduce reusable provider identity only where it does not duplicate agent/agency ownership.
- Preserve the distinction between provider business identity, qualification evidence, and dated supplier quote/availability.
- Define category identifiers, hierarchy, localized labels, search facets and compatibility with current offers.
- Make existing listings readable through the new projection without breaking current URLs.

### Gate 3 — public listing and discovery expansion
- Support additional travel listing types through explicit kind-specific contracts; avoid a universal sparse table or free-form JSON-only catalog.
- Preserve existing offer detail and public trust rules.
- Add filters/sorting/facets with query/index tests and empty states.
- Use only current source-aware price/availability facts; label manually supplied content and expiry accurately.

### Gate 4 — complete community MVP
- Add comments/replies using existing community schema or a reviewed extension.
- Add comment moderation, user reporting, abuse/rate controls and audit trail.
- Link posts to destination, listing and traveler intent/Trip when users choose to do so.
- Add notifications and useful actions such as “turn this into a trip request” only with ownership and privacy controls.
- Keep public activation gated until a real moderation workflow is staffed and tested.

### Gate 5 — traveler multi-service Trip and request
- Evolve the saved intent model through a reviewed migration/projection rather than creating a duplicate traveler workspace.
- Model trip context and independently scoped TripItems/requests, each with source and freshness.
- Let users save and compare relevant listings, then send one structured request with selected items and consented details.
- Preserve the existing inquiry → agency opportunity → immutable quote lineage.

### Gate 6 — agency, partner and fulfilment convergence
- Link shared provider/listing records into agency supplier sourcing while preserving quote snapshots.
- Retain immutable quote versions and source lineage.
- Connect accepted quote lines to current service-fulfilment pilot without treating its gated pilot as a general payment rail.
- Expand memberships/roles only after explicit multi-user requirements are agreed; current schema constrains one workspace per agent.

### Gate 7 — connectors and controlled market activation
- Add suppliers behind capability contracts, starting with a measurable use case.
- Keep read-only search separate from booking/issuance and payment.
- Activate one market/category at a time only with real providers, evidence, moderation, support ownership and rollback.
- Validate mobile priority journeys after stable web/API behavior.

## 8. Non-negotiable implementation rules

1. One modular monolith and one PostgreSQL system of record until measured evidence justifies extraction.
2. No parallel CRM, offers catalog, quote system, contact/inquiry store or traveler workspace.
3. Preserve current auth, role, tenant, ownership and public-DTO boundaries.
4. Provider connectivity is not a verified claim; AI output is not source evidence.
5. Preserve source reference, observed time, validity/expiry and applicable scope for all mutable travel/supplier facts.
6. Keep prices in explicit currency and minor units where financial records require them; never infer a price conversion without a timestamped source.
7. Distinguish quote acceptance, service delivery acceptance, settlement, payment and ticket issuance.
8. Community is first-class; its launch gate is operational moderation and safety, not merely a feature flag.
9. No fake inventory, fake verified suppliers, fabricated reviews, demo user claims or invented availability.
10. No production schema, data, flags, credentials, or deploy changes without a separate reviewed release.
11. Every change has targeted unit/contract/DB/browser coverage and passes the seven-job exact-head CI contract.
12. Keep external tools behind SILA-owned interfaces and preserve license, cost, security, and removal review.

## 9. Evidence anchors inspected

### Product/architecture docs
- `README.md`
- `SILA_MASTER_PLAN.md` (historical plan; revalidate status statements against code/current deployment)
- `SILA_INTEGRATION_STATE.md` (branch integration snapshot; not current main proof)
- `SILA_OPEN_SOURCE_RADAR.md`
- `SILA_AGENT_RUNTIME_ARCHITECTURE.md`
- `docs/product-core-map.md`
- `docs/capability-registry.md`
- `docs/domain-evidence-audit.md`
- `docs/public-pilot.md`
- `docs/agent-workspace.md`
- `docs/readiness-advisor.md`
- `docs/service-commercial-validation.md`
- `docs/service-fulfillment-pilot.md`
- `.env.example` (defaults/expected variable names only; not live values)

### Code/schema/tests
- `src/db/schema.ts`, `src/db/agency-schema.ts`
- `db/community_v1.sql`, community SQL rollback
- `src/lib/community.ts`, `src/lib/traveler-intent.ts`, `src/lib/service-request.ts`
- `src/app/api/offers/*`, `src/app/api/agents/*`, `src/app/api/contact-requests/*`
- `src/app/api/community/posts/*`, `src/app/community/page.tsx`, `CommunityComposer`
- `src/app/api/traveler/intents/*`, `src/app/account/travel/page.tsx`
- `src/app/api/agency/workspaces/*`, partner service-order APIs
- `src/lib/commercial-domain.ts`, `commercial-service.ts`, quote-delivery services
- `src/lib/capabilities/*`, `src/lib/agent-runtime/*`, `src/lib/travel-suppliers/*`
- Test families: marketplace, public trust/security, agency/commercial, community, traveler workspace, quote delivery, service fulfilment, readiness/evidence, capabilities/runtime, browser/mobile.

## 10. Explicit unknowns / next verification

The repository alone does not answer:
- Which flags and credentials are currently active in Vercel Production.
- Which real agencies/providers are currently onboarded and actively supplying inventory.
- Current supplier contract terms, update frequencies, cancellation/refund obligations or legal permissions.
- Actual traveler demand, conversion, repeat usage, support burden or willingness to pay.
- Whether comments, a reusable supplier directory or additional listing types exist only in an unmerged PR or an external system.
- Whether the native mobile client is deployed to a store or has parity beyond the files found in this tree.

Verify each from the authoritative environment/business evidence before activation or public claims.

---
**Conclusion:** SILA already has a meaningful marketplace, agency-operations and community foundation. The fastest safe path is a domain-convergence pass followed by targeted completion of provider/listing, discussion and Trip/request journeys—not a rewrite, not a microservice split, and not indiscriminate adoption of more open-source frameworks.
