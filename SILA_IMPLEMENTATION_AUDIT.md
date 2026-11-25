# SILA Implementation Audit — Marketplace + Community

**Audit date:** 2026-11-24  
**Repository:** `mafouda909-max/THE-JOURNEY-version-1.0`  
**Baseline branch:** `main` at `fde60ef182e3fb4c24e2f1d6c36feb8f2e3e62aa`  
**Audit branch:** `audit/sila-marketplace-community-gap-2026-11-24`  
**Related open PR:** [#102 — SILA Decision Platform](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/pull/102)  
**Status:** Round 1 structural audit. No application code, database, production deployment, or existing PR has been changed by this audit.

---

## 1. Purpose and strategic target

This audit compares the current implementation with the updated product direction:

> **SILA is an integrated travel marketplace and travel community.** It connects travelers with a broad range of travel-service providers, supports discovery, comparison, planning, requests and (where supported) booking, and connects those commercial journeys to trusted travel knowledge and community participation.

The marketplace and community are both first-class product pillars. Trust, evidence, source and freshness are cross-cutting capabilities, not separate products.

This target is broader than the current repository's documented pilot, whose core loop is primarily travel readiness → reviewed travel agent → published travel offer → traveler inquiry. The current implementation is valuable and should be extended rather than discarded.

### Working principle

**Build the complete marketplace domain and product structure from the start; activate external supply and transaction depth according to real provider readiness.**

This means:
- All agreed service families must have a place in the product taxonomy and architecture from the beginning.
- The system must support more than one delivery mode: provider-managed listing, request-for-quote, partner-mediated service, and direct/API-backed availability or booking.
- A category must not be presented as live inventory or bookable merely because its page or adapter contract exists.
- The community must be part of the product architecture and core navigation; feature gating is a release control, not a decision to remove it.
- Build on the existing modular monolith unless measured technical evidence justifies extraction. Do not create duplicate CRM, supplier, trip or quote systems.

---

## 2. Repository and PR baseline

### Main and PR #102

| Item | Observed state |
|---|---|
| Default branch | `main` |
| Main baseline | `fde60ef182e3fb4c24e2f1d6c36feb8f2e3e62aa` |
| PR #102 branch | `rebuild/sila-decision-platform-v1` |
| PR #102 HEAD | `554a29616bef6edd79d8352d38ce3551643fa085` |
| Branch relation | 116 commits ahead; 0 behind main |
| PR state | Open, not merged; GitHub reports mergeable |
| Changed files | 72 |
| Diff size | 5,207 additions / 2,791 deletions |
| Latest exact-HEAD CI run inspected | `39494503900` |
| CI result | 7 of 7 jobs successful |
| Submitted PR reviews | None returned by the review-list endpoint |

The seven successful jobs cover:
1. Unit and contract tests.
2. Production build.
3. Typecheck and lint.
4. Expo mobile typecheck, tests and bundle.
5. Database security, marketplace/commercial/traveler/fulfillment suites.
6. Desktop and mobile Browser QA.
7. Runtime dependency audit.

CI success is evidence for the checks that ran on that exact commit. It is **not** proof of real provider inventory, commercial activation, production booking/payment, final brand approval or production readiness.

### Strategic mismatch to resolve before merge

PR #102 describes SILA as a **decision and verification platform, not a conventional marketplace**. That framing no longer matches the agreed direction of a full travel marketplace plus community.

The PR's 72 changed paths substantially revise the homepage, readiness/advisor, offers, agent pages, traveler workspace, agency workspace, shared styling, mobile tokens and tests. The changed-file list does **not** include the core database schema, the agency schema, Community pages/API, or service-provider catalog implementation.

**Decision:** Do not merge PR #102 unchanged solely because CI is green. Keep it as a substantial UX/product-reconstruction candidate. Reconcile its useful UI and workflow work with the full-marketplace product architecture, then run final design, mobile and exact-HEAD release reviews. No merge is performed by this audit.

---

## 3. Current implementation inventory

Status vocabulary:
- **KEEP** — valuable existing capability; preserve.
- **MODIFY** — existing implementation is useful but its model or scope must change.
- **COMPLETE** — a real but partial workflow needs its missing parts.
- **BUILD** — no adequate product capability is present for the target.
- **REPLACE** — replace only if evidence shows the current design cannot support the target. No broad replacement is approved in this round.

### 3.1 Identity, accounts and traveler foundation

**Observed implementation**
- `accounts`, sessions, password authentication and role boundaries.
- Traveler accounts and account-owned saved travel intents.
- `traveler_saved_intents` uses a versioned JSON snapshot for travel context.
- `traveler_intent_offers` and `traveler_intent_inquiries` connect saved intent to offers and inquiries.
- Readiness, comparison and traveler workspace surfaces exist.
- Ownership and authorization tests exist.

**Decision: KEEP + MODIFY**
- Keep identity, session, ownership and saved-intent foundations.
- Evolve the trip model so one trip can contain multiple heterogeneous service items (for example flight, accommodation, transfers, visa service and activities), each with its own provider, evidence, price, availability and lifecycle.
- Do not assume the current saved-intent JSON snapshot alone is a complete multi-service itinerary/order model.
- Decide how a traveler can own multiple trips, invite collaborators, archive trips and share only explicitly selected information.

### 3.2 Public marketplace and offers

**Observed implementation**
- Public routes and flows include `/offers`, `/offers/[id]`, `/agents`, and inquiry/contact flows.
- The current `offers` table requires an `agent_id` and has a trip-oriented shape: trip type, origin, destination, departure date, duration, price, included/excluded items and traveler limits.
- Current public trip-type labels include Umrah, packages, visas, flights, hotels and cruises.
- Agent-created offers pass through review before publication; public projection and trust gates exist.
- Search/filter and offer comparison behavior exists for the current offer model.

**Decision: KEEP + MODIFY**
- Keep the current offer lifecycle, public projection, review and evidence boundaries.
- The current offer record is not yet a neutral listing model for every travel service. A hotel room, transfer, activity, insurance product or local experience does not share all fields with a package tour.
- Design a provider-neutral service/listing domain with common fields plus category-specific attributes and validation. Keep legacy offers readable through an explicit compatibility layer or migration plan.
- Build category-aware search, filters, detail pages and comparison, rather than adding more unrelated fields to one trip-shaped record.
- Keep price, currency, supplier/source, observed time, validity, inclusion/exclusion, cancellation terms and availability distinct. A quoted price must not be presented as confirmed inventory.

### 3.3 Provider and supplier model

**Observed implementation**
- The public marketplace's primary provider identity is an `agents` record tied to an account.
- `agency_workspaces` and `agency_memberships` provide an agency tenant boundary. The current schema has a unique constraint on the workspace's `agent_id`.
- `agency_supplier_options` stores category, supplier name, description, cost, commission, source type/reference, observed time, validity and status.
- Supplier options are scoped to an agency opportunity/workspace. They are sourcing evidence for a quote, not a reusable public supplier business profile.
- Fulfillment partners are represented through assigned accounts.

**Decision: MODIFY + BUILD**
- Preserve agents and existing agency workspaces.
- Design a reusable **Provider / Business** identity that can represent a travel agency, hotel/property operator, transport provider, tour/activity operator, visa-service provider and other agreed supplier types.
- Separate the provider business from its users, memberships, roles, verification records, public profile and service listings.
- Link existing agent accounts and agency workspaces to this model with a backward-compatible migration path. Do not silently reinterpret every agent as every type of supplier.
- Keep `agency_supplier_options` as opportunity-specific sourcing evidence; do not misuse it as the global public catalog.
- Revisit one-workspace-per-agent only after defining agency ownership, multiple branches, franchise and multi-provider relationships.

### 3.4 Agency Commercial OS and service fulfillment

**Observed implementation**
- Agency clients, opportunities and versioned intent snapshots.
- Supplier options with source and freshness metadata.
- Quotes and immutable quote versions, including cost/sell totals, expected commission, gross profit, margin, markup and an integrity digest.
- Quote delivery and client response tracking.
- A gated service-fulfillment pilot with service orders, partner assignments, delivery evidence, work events and append-only financial evidence.
- Database and browser suites cover significant commercial workflows.

**Decision: KEEP + MODIFY**
- Keep these capabilities as the provider-side operating layer inside SILA.
- Connect them to the common Provider, Service Listing, Trip Request and Order concepts.
- Do not create a parallel agency CRM, quote engine or second supplier-option system.
- Keep the fulfillment pilot gated until its workspace allowlist, operating terms, partner readiness, acceptance rules and financial responsibilities are explicitly approved.
- Ledger entries for receipt/refund/cost are records; they are not proof that SILA has a live payment processor or settlement rail.

### 3.5 Community

**Observed implementation**
- `/community` and a community composer exist.
- Tables exist for `community_posts`, `community_comments` and `community_reactions`.
- Post types include question, experience, update and guide.
- Posts can record a destination country/city and topic.
- New posts require authentication and enter `pending_review`; an admin moderation route can publish, reject or hide them.
- Published posts can receive an authenticated “helpful” reaction.
- A post linked to a destination can be converted into a traveler intent.
- The page displays a comment count.

**Verified code gap**
- The comments table and type exist, but the main-branch code search found no runtime insertion/query workflow for `communityComments`.
- Candidate comment API paths checked during this audit returned 404.
- The page displays `commentCount`, but there is no complete public create/list/moderate comment experience demonstrated by the current routes.
- No community group, follow-graph or direct-message implementation was found in this structural pass.
- The community is feature-gated by `COMMUNITY_ENABLED`. A previous production endpoint probe on 2026-11-24 observed the community endpoint reporting `enabled:false`; recheck the live flag and schema before activation.

**Decision: KEEP + COMPLETE + MODIFY**
- Keep posts, moderation, audit logging and helpful reactions.
- Complete comment creation, retrieval, moderation, counts and abuse controls end-to-end before describing comments as available.
- Add report/block and rate-limit pathways suitable for user-generated content.
- Make destination, service category, provider and (where appropriate) listing references first-class optional links on posts/reviews. Preserve the distinction between a traveler's experience, a provider-authored post and an editorial/official source.
- Community MVP should include posts, comments/replies, helpful reactions, reporting/moderation, profiles/source identity and links into marketplace entities.
- Groups, follows, private messaging, social feed ranking and creator monetization are separate scope decisions. They are not prerequisites for a useful travel community MVP and should not be invented as silently complete.
- Do not enable public posting until moderation operations, abuse handling and production schema are verified.

### 3.6 Travel data and evidence

**Observed implementation**
- Travel facts/knowledge, source references and freshness fields.
- Readiness and evidence projection, source-aware advisor workflows and read-only flight search adapter.
- Trust and verification records for agents and private documents.
- Provider capability registry distinguishes implemented, gated, not configured, degraded and planned states.

**Decision: KEEP + MODIFY**
- Keep the Evidence + Scope + Freshness approach across all marketplace categories and community claims.
- Distinguish provider connection health from a particular offer's price/availability freshness and from the authority of a travel rule.
- Apply evidence scope to accommodation terms, transfers, activity details, cancellation rules and service qualifications—not only visas/flights.
- Preserve explicit unknown states. Never let AI-generated text become the source of a claim or turn an unverified provider into a trusted one.

### 3.7 Integrations and transactions

**Observed implementation**
- Implemented adapters include database, storage, AI assistance/document analysis, web search, email, notifications and read-only Amadeus flight search.
- Amadeus search remains configuration/feature-flag gated and does not issue tickets or book.
- Capability registry explicitly describes GDS, NDC, hotels, visa supplier data, currency, maps/geo, payments, social publishing, WhatsApp and production MCP as planned or not implemented.
- No live payment rail is established by the current capability registry.

**Decision: KEEP + BUILD**
- Keep the replaceable adapter model and capability registry.
- Define integration contracts for flights, accommodation, transfers, activities, visas and other approved categories.
- Support manual/provider-managed offers and request-for-quote where no API exists, without labeling them live availability.
- Add booking/payment only after supplier contracts, cancellation/refund rules, responsibility boundaries, reconciliation and regulatory review are defined.
- A single “booking” status must not hide the difference between request sent, supplier confirmed, payment authorized, ticket/voucher issued and service fulfilled.

### 3.8 Mobile

**Observed implementation**
- A React Native / Expo application exists with shared brand tokens and mobile tests.
- PR #102 changes mobile decision logic and generated tokens, and its CI builds an iOS-target bundle.

**Decision: KEEP + ALIGN**
- Keep the app and shared design tokens.
- Align mobile navigation and core journeys with the same marketplace/community domain model as web.
- A successful bundle is not proof that every web marketplace or community flow has a mobile equivalent.
- Mobile parity should be checked after the target information architecture and service contracts are defined.

---

## 4. Keep / Modify / Complete / Build / Replace summary

| Action | Components |
|---|---|
| **KEEP** | Modular monolith; PostgreSQL/Drizzle; identity and ownership; agent verification; evidence and review gates; existing offer moderation and public projections; traveler intents; agency opportunities/quotes; supplier sourcing evidence; capability registry; Community post/moderation foundation; CI suites; Expo application. |
| **MODIFY** | Offer/listing domain; provider identity; category taxonomy and category-specific fields; multi-service traveler trip; marketplace search and detail UX; relation between agency workspace, provider and supplier; evidence projections across categories; PR #102's product framing and navigation. |
| **COMPLETE** | Community comments and reply workflow; reporting and moderation operations; community release wiring; service-specific listing forms and validation; trip-to-multiple-services flow; request/quote status visibility; provider account/profile lifecycle; operational activation checks. |
| **BUILD** | Reusable provider/business directory; public multi-category service catalog; category-specific listing and availability contracts; provider-managed inventory or RFQ paths; multi-service trip items; shared traveler request/order lifecycle; missing provider integrations; complete community MVP links between posts, services, providers and destinations. |
| **REPLACE** | No broad codebase replacement approved. No proof currently justifies replacing the modular monolith, existing agency commercial workflow, or evidence model. Replace a specific module only after a documented compatibility/security/performance failure. |

---

## 5. Target domain structure to design before migrations

This is a **target model for design review**, not an instruction to create all these tables immediately.

1. **Identity & Organizations:** account, organization/provider, branch, membership, role, verification and public profile.
2. **Service Taxonomy:** category, service type, category schema/version, attributes, required fields and allowed fulfillment modes.
3. **Catalog & Supply:** provider listing, product/service detail, media, price, currency, inclusions, terms, location, availability, source, observedAt and validUntil.
4. **Discovery:** destination/category filters, search index contract, comparison and provider/service profile projections.
5. **Traveler Planning:** trip, trip members, trip item, traveler requirement snapshot, saved options and trip status.
6. **Commerce:** inquiry/request, supplier response, quote/version, booking/order, item-level lifecycle, cancellation/refund record and payment reference (only when real payment integration exists).
7. **Trust & Evidence:** identity verification, service/provider review, listing evidence, price/availability evidence, scope, reviewer and expiry.
8. **Community:** post, comment/reply, reaction, report, moderation action, optional entity links, and later groups/follows if validated.
9. **Provider Operations:** existing agency workspace, opportunity, sourcing, quotes, delivery and accepted service outcomes mapped to the common provider/order model.
10. **Platform Operations:** admin tools, audit, notifications, moderation queue, provider capability registry, metrics and incident handling.

### Design constraints

- Common fields should be consistent, but service-specific attributes must be typed and validated per category.
- Do not turn `offers` into an unbounded JSON dumping ground.
- Do not duplicate supplier data between public listings and agency opportunity sourcing. Define a canonical provider/listing identity with scoped supplier quotations referencing it.
- Preserve money in minor units and explicit currency.
- Preserve immutable snapshots for sent/accepted quotes and transaction-relevant terms.
- Record times and time zones explicitly for travel dates and availability.
- Keep ownership, tenant boundaries and provider roles enforced server-side and in database tests.
- Use additive migrations, backfill plans, rollback strategy and compatibility tests. No production reset.

---

## 6. Recommended execution sequence

This sequence builds the **full product structure** without requiring every external supplier contract to exist on day one.

### Gate 0 — Baseline and PR reconciliation

- Preserve production and main.
- Verify the current production deployment SHA and important live paths.
- Inspect PR #102's complete diff and latest Preview deployment.
- Perform human visual/brand review and mobile parity review.
- Map each PR change to the new marketplace/community target: keep, adapt, split or reject.
- Do not merge until the product framing and exact release checks are accepted.

**Exit criteria:** approved baseline, known deployment SHA, a reviewed PR change map and no unresolved data-migration risk.

### Gate 1 — Product/domain architecture

- Finalize provider types and organization relationships.
- Finalize travel-service taxonomy covering every agreed category.
- Define common listing fields and category-specific schemas.
- Define availability and fulfillment modes.
- Define trip, trip item, request, quote, booking/order and lifecycle contracts.
- Define Community MVP and marketplace entity links.
- Map all proposed concepts to existing tables and routes before choosing migrations.

**Exit criteria:** approved domain diagram, entity glossary, API contracts, permission matrix and migration plan.

### Gate 2 — Full marketplace foundation

- Provider/business profiles and onboarding.
- All agreed service categories represented in navigation, taxonomy, forms and data contracts.
- Provider-managed listings and manual/RFQ supply paths.
- Category-aware search, filtering, detail and comparison.
- Evidence, freshness, terms and trust displayed consistently.
- Existing offers remain available through compatibility mapping during migration.

**Exit criteria:** a real provider can publish a correctly typed service; a traveler can discover, compare and submit a request; the same service can be traced through the provider and admin views.

### Gate 3 — Community MVP integrated with the market

- Activate only after migration, moderation, abuse controls and support process pass.
- Complete comments/replies, reactions, reports and moderation.
- Link posts to destinations, service categories, providers and listings where relevant.
- Distinguish provider-authored content from traveler experiences and verified-purchase/verified-service reviews.
- Provide contextual entry points from listing/provider/ destination pages to relevant community content.

**Exit criteria:** a real user can publish, receive moderation, comment and report; a moderator can resolve a report; relevant community content is discoverable from the market without exposing private traveler data.

### Gate 4 — Unified traveler journey and provider operations

- A traveler can build one trip from more than one service category.
- One request can include multiple service items while preserving each provider's response and terms.
- Quote, confirmation, booking/order, cancellation and fulfillment states are explicit and traceable.
- Existing Agency Commercial OS participates in the same provider, request, quote and order model rather than creating a parallel workflow.
- Traveler, provider and admin see consistent status and audit history.

**Exit criteria:** complete end-to-end journey in an isolated environment using genuine provider test contracts, with permissions, immutable quote snapshots and failure recovery verified.

### Gate 5 — External integrations and transaction depth

- Integrate real providers by category after commercial and technical readiness.
- Separate live search/availability from quote/request and from confirmed booking.
- Activate payments only after legal/commercial ownership, authorization, refund, settlement and reconciliation decisions.
- Measure supply coverage, conversion, provider response, fulfillment quality, disputes and repeat use.

**Exit criteria:** provider-specific end-to-end proof on exact deployed SHA, operational playbooks, monitoring and rollback.

---

## 7. Release definition of done

A feature is not complete because a page, schema, adapter, test fixture or mock response exists. For each release slice, record:

- User journey works end-to-end on the intended environment.
- Data is persisted and retrieved from the correct ownership/tenant boundary.
- Server and database enforce role, ownership and state-transition constraints.
- External source, availability and freshness are represented honestly.
- Loading, empty, stale, unavailable, rejected and retry states are covered.
- Unit/contract, database, security and browser tests pass on the exact commit.
- Mobile behavior is reviewed where the journey is supported.
- Production deployment SHA and live behavior are checked.
- Logs/metrics, support ownership and rollback are defined.
- No synthetic provider, listing, review or transaction is presented as real.

---

## 8. Open decisions — do not guess

These decisions must be resolved in the product/domain design before schema changes:
1. Which provider types may create a public account directly, and which must be onboarded/approved by SILA or a travel agency?
2. Can one legal business own multiple provider profiles, branches or service categories?
3. Is an agency the seller/merchant of record for partner-provided services, or does the traveler contract directly with the supplier in each category?
4. Which service categories support instant booking, request-for-quote, provider confirmation or external handoff?
5. What evidence is required for each provider and service category, and who is authorized to verify it?
6. What constitutes a verified review: verified booking, confirmed fulfillment, verified purchase, or a different evidence level?
7. Which community functions are essential at the first public release (recommended: posts, comments/replies, helpful reactions, reports/moderation and entity links), and which are later (groups, follows, private messaging)?
8. What are SILA's responsibilities for payments, cancellation, refunds, complaints and disputes in each fulfillment mode?

---

## 9. Source anchors inspected

- `README.md` — repository identity, pilot and architecture pointers.
- `docs/product-core-map.md` — existing user journeys and module boundaries.
- `docs/capability-registry.md` — implemented versus planned providers and gates.
- `docs/domain-evidence-audit.md` — existing domain entities and anti-duplication decisions.
- `docs/public-pilot.md` — pilot entry points and release gates.
- `src/db/schema.ts` — accounts, agents, offers, contact requests, reviews, traveler intents and Community tables.
- `src/db/agency-schema.ts` — agency workspaces, memberships, opportunities, supplier options and quote versions.
- `db/community_v1.sql` — Community v1 schema.
- `src/lib/community.ts`, `src/app/community/page.tsx` and `src/app/api/community/posts/**` — Community posting, listing, moderation and helpful reactions.
- `db/service_fulfillment_pilot.sql` and `src/lib/service-fulfillment.ts` — gated partner service fulfillment and financial evidence.
- `src/lib/capabilities/catalog.ts` and `src/lib/capabilities/production.ts` — integration contracts and gates.
- [PR #102](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/pull/102) — current product reconstruction candidate and exact-head CI evidence.

### Audit limitations

This is a structural repository audit plus review of available CI and previous live endpoint observations on 2026-11-24. It is not yet a complete line-by-line audit of every API route, migration, deployed runtime flag, production database row or protected Preview screen. Those checks remain Gate 0 work. Where a live status may have changed, this document requires re-verification before activation.

---

## 10. Immediate next task

Produce a route/API/schema/test inventory for the highest-risk domain boundaries:
1. `offers` → provider/listing/category.
2. `agency_supplier_options` → canonical provider/listing and quote sourcing.
3. traveler saved intent → multi-service trip.
4. `community_comments` → missing end-to-end workflow.
5. service fulfillment pilot → common booking/order lifecycle.
6. production and preview feature flags/migrations.

Use the inventory to propose the smallest backward-compatible domain changes. Do not create migrations, remove existing tables, enable production flags or merge PR #102 as part of that inventory.


## 11. Round 2 — route, API and test inventory

This section records the concrete execution paths found in `main`. It is intentionally a path-level map, not a claim that every endpoint has been exercised against Production.

### 11.1 Marketplace offer → traveler inquiry → agency opportunity

| Step | Current route / module | Current behavior | Decision |
|---|---|---|---|
| List offers | `GET /api/offers` — `src/app/api/offers/route.ts` | Published offers joined to agents; public projection requires verified agent and non-expired offer; optional trip type filter. | **KEEP**, later route through category-aware listing search. |
| Create offer | `POST /api/offers` — same route | Agent-only; current public trust/evidence required; validates the current trip-oriented `TRIP_TYPES`; inserts pending-review offer. | **MODIFY** to provider/listing and category-specific contract; preserve review. |
| Read offer | `GET /api/offers/[id]` — `src/app/api/offers/[id]/route.ts` | Only published, verified, non-expired offer with public agent projection. | **KEEP** behind a service-listing detail contract. |
| Correct rejected offer | `PUT /api/offers/[id]` — same route | Owning currently trusted agent can edit rejected offer; the update returns to review. | **KEEP**; generalize ownership to provider membership when provider model exists. |
| Create inquiry | `POST /api/contact-requests` — `src/app/api/contact-requests/route.ts` | Requires an `offerId`, validates traveler fields, throttles by IP, checks current offer/agent trust, optionally attaches a saved intent, and creates a contact request. | **MODIFY** to allow a request against a service/listing or multi-service trip, while preserving current offer compatibility and idempotency/ownership. |
| List inquiries | `GET /api/contact-requests` — same route | Admin feed; agent gets own agent requests; traveler gets only account-bound requests. | **KEEP** and extend with provider/workspace ownership rules. |
| Adopt marketplace inquiry | `POST /api/agency/workspaces/[id]/inquiries` | Adopts the original marketplace inquiry into agency commercial work; source contact request is retained and duplicate adoption is constrained. | **KEEP** as the bridge from marketplace demand into agency operations. |
| Manage agency pipeline | `GET/POST /api/agency/workspaces/[id]/commercial` | Membership-scoped pipeline and commands into the existing commercial service. | **KEEP** as provider-side operations; link to common request/listing/order model. |
| Prepare/activate quote delivery | `POST /api/agency/workspaces/[id]/quote-deliveries` | Separates preparing a client link from confirming actual delivery. | **KEEP**; preserve proof distinction between preparation and send. |
| Customer quote response | `POST /api/quote-deliveries/[token]/respond` | Public token-scoped response path with rate limiting. | **KEEP** and map response to item-level request/order state. |

**Important current constraint:** the public lead starts from a single `offerId`, and the offer references an agent. This is not yet a common request endpoint that can begin from any provider listing or several trip items.

### 11.2 Traveler saved intent and comparison

| Route / module | Current behavior | Decision |
|---|---|---|
| `GET/POST /api/traveler/intents` | Authenticated traveler can list or save owned intent snapshots; guarded by `TRAVELER_WORKSPACE_ENABLED`. | **KEEP + MODIFY** into a trip aggregate and versioned multi-service trip items. |
| `POST/DELETE /api/traveler/intents/[id]/offers` | Adds/removes a published, current-trust offer to an owned intent; maximum four offer comparisons per intent. | **KEEP + MODIFY** to save/compare heterogeneous service listings, not only offer rows. |
| `/account/travel` | Renders saved context, offers, contact inquiries and quote delivery status, with a next action. | **KEEP + EXTEND**; this is the natural home for a unified multi-service traveler trip. |
| `/compare` | Existing offer comparison journey. | **KEEP + GENERALIZE** to category-specific, fair comparisons that only compare equivalent attributes. |

The saved intent snapshot is useful for initial preference/context and should not be thrown away. The target trip model should distinguish traveler intent, selected service options, separate requests to providers and confirmed bookings/orders. These are different stateful objects.

### 11.3 Community API and tests

| Component | What exists | What is not established |
|---|---|---|
| `GET /api/community/posts` | Published posts, optional destination filter; response explicitly reports feature enabled/disabled. | Pagination, broad search, topic/category filters and linked listing/provider queries are not established in the current implementation. |
| `POST /api/community/posts` | Authenticated post submission; type/title/body validation; fraud-content scan; pending-review state; audit logging. | Real-world moderator staffing and abuse-response process are not proven by code. |
| `PATCH /api/community/posts/[id]` | Admin publish/reject/hide transitions with audit log. | Comment moderation workflow and report-resolution queue are absent from the reviewed route set. |
| `POST /api/community/posts/[id]/helpful` | Authenticated unique helpful reaction for published post. | Reaction reversal/other reactions are not established. |
| `community_comments` | Database table and Drizzle model, pending-review status, post/account FKs, indexes and a stored count field on post. | No comment GET/POST/moderation route, UI flow or runtime query/insert use was found in main. The table is not a working commenting feature. |
| Group/follow/message | No group/follow/direct-message route or schema found in this pass. | These are future scope candidates, not existing modules. |

Current Community contract test: `tests/community-contract.test.ts` verifies fail-closed feature flag behavior, additive creation of the three v1 tables, page avoidance of DB reads while disabled, and migration manifest/schema/rollback wiring. It does **not** prove a full post/comment/report conversation journey in a real browser/database.

**Community decision:** Community remains a first-class product pillar. The first complete release slice should be posts + comments/replies + helpful reactions + reporting/moderation + author/source labeling + entity links to destination/service/provider/listing. Groups, follows and private messaging remain later scope unless user evidence makes them a launch requirement.

### 11.4 Agency sourcing and fulfillment bridge

| Route / module | Current behavior | Decision |
|---|---|---|
| `POST /api/agency/workspaces/[id]/commercial` | Workspace/member-scoped commands to create/update opportunities, supplier options and quote versions. | **KEEP**; connect supplier options to canonical public provider/listing references as optional provenance. |
| `GET /api/agency/workspaces/[id]/commercial` | Returns the commercial pipeline within an authorized agency workspace. | **KEEP**. |
| `POST /api/agency/workspaces/[id]/service-orders` | Office-side order commands; `SERVICE_FULFILLMENT_PILOT_WORKSPACE_IDS` allowlist must include the workspace. | **KEEP**, but remain gated pending commercial/legal/operational pilot approval. |
| `GET /api/agency/workspaces/[id]/service-orders` | Workspace-scoped service order reads. | **KEEP**. |
| `GET/POST /api/partner/service-orders` | Assignment-scoped partner list/actions. | **KEEP**, preserve information minimization. |
| `/api/agency/workspaces/[id]/service-orders/operations` | Office operations metrics/reporting; test suite covers tenant boundaries and aggregate privacy. | **KEEP**. |
| `db/service_fulfillment_pilot.sql` | Separate additive pilot schema; not included in automatic release chain. | **KEEP AS GATED PILOT**, integrate later into common order lifecycle. |

The service fulfillment pilot provides a useful model for partner execution and delivery acceptance. It does not establish that the public marketplace has an open provider network, or that SILA collects/processes actual payments. Its money-entry ledger is not a PSP integration or settlement engine.

### 11.5 Test evidence and what it proves

| Test suite | Evidence provided | Limitation |
|---|---|---|
| `tests/offers-browser-contract.test.ts` | Contract checks for current public offer browser. | Does not prove multi-category provider listings. |
| `tests/community-contract.test.ts` | Community flag and migration wiring. | No end-to-end comments/report journey. |
| `tests/commercial-e2e-db.test.ts` | Current marketplace inquiry adopted once into an agency opportunity; sourcing and quote flow in isolated PostgreSQL. | Exercises the current agent/package-shaped offer lead, not the complete multi-category marketplace. |
| `tests/traveler-intent-commercial-e2e-db.test.ts` | Saved intent → offer selection → contact inquiry → agency workflow and quote delivery using isolated DB. | Saved intent links offers only; not multiple service categories in one trip. |
| `tests/service-fulfillment-db.test.ts` | Order assignment, tenant isolation, work/delivery/rework/acceptance and separate money evidence. | Pilot-specific and feature-allowlisted; no proof of public activation. |
| CI run `39494503900` | Seven jobs succeeded on PR #102 exact HEAD. | CI fixtures are isolated; no live inventory, external supplier contract, Production transaction or human design approval is implied. |

### 11.6 Activation and release controls

- Community uses `COMMUNITY_ENABLED`; the flag was observed off in a previous Production endpoint check on 2026-11-24. Recheck before changing it.
- Traveler workspace and saved intent endpoints use `TRAVELER_WORKSPACE_ENABLED`.
- Flight search uses the Amadeus adapter plus `FLIGHT_COMPARE_ENABLED`; search is read-only and is not booking.
- Agency commercial workspace and supplier sourcing exist in the current repository; confirm their actual route-level release gates and Production access before broad activation.
- Service fulfillment requires the explicit workspace allowlist `SERVICE_FULFILLMENT_PILOT_WORKSPACE_IDS`; empty/malformed configuration disables it. CI-only test IDs must never be copied into Production.
- Booking, ticket issuance, hotel supplier inventory, visa supplier data and payment processing remain distinct capabilities and should not be described as live unless a real provider integration and exact-head end-to-end proof exist.

---

## 12. Recommended next engineering work package

The next task should be a **domain/API contract design**, not a migration and not a UI expansion.

Deliver:
1. A provider/business identity contract linked to existing `agents`, `accounts`, and `agency_workspaces` without breaking ownership.
2. A service taxonomy and category schema contract.
3. A listing/availability/evidence contract that supports provider-managed offers, RFQ and API-backed search without false availability.
4. A multi-service trip item contract built from saved intent while preserving existing traveler data.
5. A common request/quote/order lifecycle that adapts existing contact requests, quote delivery and fulfillment rather than duplicating them.
6. A Community comment/report API specification and moderation transitions.

Each proposed entity/endpoint must cite its existing source path, show whether it is reused or new, list migration/backfill compatibility, and specify the tests that would prove it.

**Do not implement the proposed schema until the contracts and relationships are reviewed. Do not activate Community or fulfillment in Production as part of this work package.**
