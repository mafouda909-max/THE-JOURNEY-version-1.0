# SILA Marketplace Domain RFC

> Status: **DRAFT — architecture proposal for review; not approved for implementation**  
> Date: 2026-11-25  
> Scope: integrated travel marketplace + first-class travel community + traveler trip workspace + agency/provider operations.  
> Evidence baseline: current `main` code and docs reviewed in `SILA_IMPLEMENTATION_AUDIT.md` and `SILA_REPOSITORY_ASSET_MAP.md`.

## 1. Purpose and product boundary

SILA is an Arabic-first integrated travel marketplace connecting travelers, travel agencies and other travel providers, travel services, and a useful travel community. The product should help users discover, understand, compare, request and coordinate travel products/services with clearer source, scope, trust and freshness.

The marketplace and community are two first-class product pillars. Travel Advisor/readiness, AI assistance, agency operations, supplier integrations and service fulfilment are supporting capabilities that connect these pillars; none replaces the marketplace or community.

This RFC proposes how existing domains should converge. It does not claim that booking, ticket issuance, payment processing, escrow, supplier inventory or all travel verticals are implemented.

### Non-goals for this RFC

- No production schema migration, seed data, flag change, or deployment.
- No new microservice or second application.
- No replacement of the current offers, agency CRM/quote workflow, traveler workspace, or community.
- No adoption of a new agent framework or vendor dependency.
- No claim that a provider, listing, price, availability or trust state is verified without evidence.
- No decision on SILA becoming merchant of record, handling customer funds, or issuing travel tickets.

## 2. Current implementation baseline

| Domain | Current source of truth | Existing capability | Known limit |
|---|---|---|---|
| Traveler identity | `accounts`, `sessions` | Authenticated traveler ownership | Does not imply that every marketplace user has an account |
| Agent | `agents`, `agent_documents` | Public profile, evidence review, scoped trust | Models a travel agent profile, not every supplier type |
| Agency | `agency_workspaces`, memberships | Workspace and owner/member boundary | Current schema constrains one workspace per agent |
| Public offer | `offers` | Published trip/package offers and detail/search | Trip/package-shaped, not a universal listing catalog |
| Inquiry | `contact_requests` | Traveler contact and source linkage | Needs a common structured request model for multi-item/multi-provider trips |
| Traveler intent | `traveler_saved_intents`, intent-offer links | Saved context, comparison and inquiry lineage | Not a multi-service Trip/TripItem aggregate |
| Agency opportunity | `agency_opportunities`, `agency_intent_versions` | Adopted inquiries and versioned requirements | Must keep source request lineage |
| Supplier option | `agency_supplier_options` | Opportunity-scoped dated supplier evidence/pricing | Not a public reusable supplier directory or live inventory |
| Quote | `agency_quotes`, `agency_quote_versions`, delivery records | Immutable quote versions and client response | A proposal is not a booking or settlement |
| Service fulfilment | `sila_service_orders` pilot schema | Partner assignment, work, acceptance/rework, fee evidence | Separately gated Model B coordination-fee pilot |
| Community | `community_posts`, `community_comments`, `community_reactions` | Moderated posts and helpful reactions | Comment/reply API/UI workflow is not present in the audited tree |
| Travel evidence | `travel_facts`, `travel_knowledge`, supplier evidence | Source-aware guidance and normalization | Must preserve source/scope/freshness and uncertainty |
| Provider capabilities | capability registry + adapters | Replaceable AI/web/email/storage/flights adapters | Several travel verticals and payments remain planned |

Existing schemas and service boundaries are authoritative until a migration is approved. Where the table names overlap with the proposed domain, the RFC favors extension/projection over parallel storage.

## 3. Proposed conceptual model

This is a logical model. Physical table names, keys, foreign keys, JSON boundaries and migration steps must be finalized after reviewing the alternatives below.

### 3.1 Identity, organization and provider

Separate these concepts:

- **Account:** authenticated human identity and session.
- **Organization / Workspace:** business operating boundary and membership/roles.
- **Provider:** reusable public business identity that supplies one or more travel products/services.
- **Agent profile:** professional person/travel-agent profile associated with an account and/or agency, subject to current verification and public trust rules.
- **Provider qualification:** scoped evidence that supports specific claims (identity, legal entity/activity, license/category/market, etc.).
- **Provider relationship:** the role a business plays in a category/market (travel agency, hotel, transfer operator, activity operator, guide, airline, insurer, etc.).

**Proposed reuse:** existing `agents` and `agency_workspaces` remain authoritative in the first migration. Do not create a second account/agency login system. The RFC must decide whether a shared Provider record is introduced as an additive public identity and linked to existing agents/workspaces, or whether the initial release uses a narrow projection until multi-type provider demand is proven.

**Trust is scoped, not a universal blue tick.** Evidence should state what is supported, for which entity/category/market, by whom it was reviewed, when it was observed, and when it expires (if applicable). A provider's existence or identity does not automatically verify every listing or guarantee service delivery.

### 3.2 Taxonomy and travel product categories

The market needs a stable category model before adding many listing kinds.

Candidate top-level categories to validate:

1. Air travel
2. Accommodation
3. Packages / tours
4. Ground transport and transfers
5. Activities / experiences
6. Cruise / rail / other transport (only where supply is sourced)
7. Travel assistance and related services
8. Insurance and ancillary services

Each category requires:
- Stable machine identifier independent of Arabic/English labels.
- Localized labels and hierarchy.
- Search facets with typed values (destination, date, guests, duration, provider, budget/currency, cancellation/availability as applicable).
- Allowed listing attributes and evidence requirements.
- Explicit market/jurisdiction scope.
- Compatibility mapping for existing offers and category values.

Do not expose categories that have neither real supply nor an approved acquisition/fulfilment route. Avoid empty taxonomy for breadth optics.

### 3.3 Listing / offer

A listing is a provider-published or provider-sourced commercial proposition discoverable in SILA. A listing should not be confused with a supplier option inside one agency opportunity.

Logical listing contract:

- Listing identity and type/category.
- Provider reference.
- Title/description/localized content.
- Destination/route/coverage and service scope.
- Typed attributes appropriate to listing kind.
- Price model and explicit currency; no implied conversion.
- Availability or request-only mode.
- Source/provenance and observed time.
- Validity/expiry and freshness state.
- Publication/moderation status.
- Trust/evidence references and user-visible disclosures.
- Terms: inclusions/exclusions, cancellation, conditions and limitations.
- Media references with privacy/ownership checks.

**Compatibility rule:** existing `offers` remains the canonical source for current package-shaped URLs and public offer behavior. A proposed listing layer must either (a) map current offers as a legacy listing kind through a projection/adapter, or (b) extend them additively without breaking existing routes and test contracts. The implementation choice must be explicit in the migration plan.

**Do not** represent all category-specific data as unvalidated, undocumented JSON. Use a stable common envelope plus versioned, typed category-specific attributes validated at the boundary.

### 3.4 Price, availability and evidence

Price and availability are mutable claims. A value without source/scope/time is not a current market fact.

A quote/listing evidence record should, where applicable, carry:
- `sourceType`, `sourceRef` and source identity.
- `observedAt` and `validUntil`.
- Market/jurisdiction, itinerary/service scope and passenger/room/quantity assumptions.
- Currency and integer minor-unit amount where financial precision is required.
- Price basis (per person, per group, per night, per segment, starting-from, request quote, etc.).
- Tax/fee/inclusion exclusions when known.
- Availability mode: live-confirmed, cached supplier result, provider quote, manual provider confirmation, request-only, unknown or unavailable.
- Evidence state: observed, provider-asserted, reviewed, stale, expired, unavailable, conflicting.
- Refresh/expiry policy owned by the category/provider contract.

No AI-generated price or availability may be persisted as verified fact. A live integration response proves only what the adapter actually returned at the time/scope queried. An old supplier response cannot remain displayed as live availability after its validity window.

Current agency supplier options already capture opportunity-scoped cost/source/observedAt/validUntil. Preserve those snapshots as historical quote lineage even when a reusable public supplier/listing catalog is added.

### 3.5 Traveler Trip and TripItems

Proposed logical aggregate:

- **Trip:** one traveler planning context with owner, label, purpose, destination(s), date/flexibility, traveler composition, lifecycle, privacy/participants and source.
- **TripItem:** a selected or requested travel product/service within the trip (e.g. flight, stay, transfer, activity, package, assistance), with its own provider/listing reference, dates/quantities, source snapshot, status and requirements.
- **Trip evidence/event:** changes, confirmations, warnings, source observations and decisions over time.
- **Trip participant:** optional explicitly authorized collaborator; not implied by sharing a link.

A Trip may start with incomplete intent and may exist before an account if product policy allows a private guest draft; ownership and conversion rules must be specified. Each TripItem keeps its own provider, price/availability and source snapshot; one item becoming stale must not silently invalidate or confirm another.

**Migration path:** use `traveler_saved_intents` as the initial migration/projection source. Preserve account ownership, intent-offer links, inquiry linkage and readiness memory. Do not delete or reinterpret historical JSON snapshots without a reversible mapping. Avoid creating a second traveler workspace.

The exact Trip status vocabulary (planning, collecting options, request sent, quoted, partially arranged, confirmed, cancelled, completed, etc.) remains an RFC decision. These states must not imply a confirmed booking unless a confirmed supplier transaction actually exists.

### 3.6 Request / Inquiry

A structured Request expresses what the traveler wants from SILA or a provider. It may reference a Trip and one or more TripItems.

Proposed separation:
- Request intent and requested scope.
- Candidate provider/listing recipients.
- Consent and data-sharing scope for each recipient.
- Request status and response deadline (only if operationally staffed).
- Provider responses / clarification questions / source evidence.
- Existing contact inquiry as a legacy single-offer contact path.

Reuse `contact_requests` and its agency adoption link during migration. Preserve its role as the source record and retain the idempotent link to `agency_opportunities.source_contact_request_id`. Do not duplicate a contact request into multiple CRM leads without preserving one canonical source and explicit fan-out semantics.

Open decision: whether the initial market supports one request to one provider/listing, or a traveler-authorized request to multiple eligible providers. Multi-provider routing requires consent, anti-spam controls, privacy boundaries and clear handling of conflicting responses; it must not be assumed.

### 3.7 Agency opportunity, supplier sourcing and quote

The agency workflow remains:

```text
Marketplace Request / Contact Request
          -> one source-linked Agency Opportunity
          -> versioned Intent / Requirements
          -> opportunity-scoped Supplier Options + Evidence
          -> Quote + immutable Quote Version
          -> delivery to a named client / scoped channel
          -> accept / decline / supersede / expire
```

Reuse:
- Existing workspace membership and authorization.
- Existing client/opportunity domain and command service.
- Existing `agency_intent_versions` and provenance.
- Existing `agency_supplier_options` as dated, opportunity-scoped sourcing snapshots.
- Existing immutable quote versions and quote delivery/response loop.
- Existing metrics and event history.

A Quote is a commercial proposal. Acceptance records the client's decision but does not automatically issue a ticket, book a room, take funds, confirm supplier inventory or establish settlement.

### 3.8 Order and fulfilment

A generic Order should be introduced only after its relationship to category-specific booking/fulfilment and money handling is decided.

Keep the current `sila_service_orders` pilot boundary:
- accepted quote line to partner assignment/work/delivery/acceptance/rework,
- office-to-supplier payment outside SILA under documented Model B,
- SILA coordination-fee evidence distinct from supplier gross amount,
- explicit allowlist and isolated activation.

Do not generalize this pilot into a payment ledger, booking engine or merchant-of-record model. A flight booking, hotel reservation and manually coordinated service have different evidence and cancellation/confirmation semantics.

Potential order/fulfilment split to assess:
- Order: what the customer/agency agreed to purchase and under which immutable terms.
- Fulfilment item: what must be supplied/performed, by whom, by when, with acceptance criteria.
- External booking reference: source/provider confirmation only when actually returned by an authorized provider.
- Money record: charge, supplier payment, fee, refund or adjustment with actor, source and immutable evidence. Never infer settlement from acceptance.

Payment initiation, escrow, card storage, supplier payout, automated refunds and ticket issuance remain outside scope until separate commercial/legal/security approvals.

### 3.9 Community content and discussions

Keep community objects distinct but linkable to the market:

- Post: question, experience, update or guide; author, destination/topic, visibility/moderation state, source/evidence disclosure.
- Comment/reply: post reference, parent comment where threading is approved, author, body, moderation state and edit/deletion policy.
- Reaction: helpful or another explicitly governed type; unique actor/object/type semantics.
- Report: reporter, reason/category, target, moderation state, reviewer decision and appeal/notification policy.
- Link references: optional destination, listing, Trip, TripItem or Request references.
- Community knowledge candidate: derived summary only when the source post remains attributable and policy permits reuse; AI synthesis is not a substitute for original experience or official source.

Existing `community_posts`, `community_comments` and `community_reactions` should be reused. The first missing functional slice is comments/replies and moderation; do not create a second social feed or engagement score. The exact reporting, appeals and threading model requires review before migration.

A post may help someone discover or frame a trip request, but creating a Request/Trip from a post must be an explicit user action with a preview of data being carried over.

## 4. Proposed product/API boundaries

The following are logical ownership areas, not final route names:

| API area | Owns | Reuse/extend |
|---|---|---|
| Provider profile/trust | Provider public identity, qualifications, scoped trust | Existing agent/profile/verification routes |
| Marketplace listings | Listing CRUD, moderation, public projection, facets | Existing offers routes and moderation |
| Discovery | Search, category/destination facets, listing queries | Existing offers browser, search and destination pages |
| Traveler Trips | Trip, TripItems, participants, private timeline | Existing saved intents/traveler workspace |
| Requests | Structured request, consent, provider responses | Existing contact request and adoption lineage |
| Agency operations | Client/opportunity/sourcing/quote/delivery | Existing commercial APIs and services |
| Fulfilment | Partner assignment, progress, acceptance/rework | Existing gated service-order pilot |
| Community | Posts/comments/reactions/reports/moderation | Existing community routes and schema |
| Evidence/capabilities | Provider adapters, evidence metadata, health and audit | Existing capability registry, provider gateway and Agent Runtime |

Public reads must return deliberate DTO projections, not raw rows. Private provider credentials/documents, traveler contact details, internal agency cost/margin, partner-private notes and hidden moderation records must never leak through shared listing, Trip, Request or Community projections.

## 5. Authorization and privacy requirements

- Every mutating route authenticates the actor and checks role, active membership, ownership and domain state server-side.
- Provider-level public trust is not permission to view private provider documents.
- A workspace member sees only the data their role allows; commitment/financial actions retain current owner restrictions.
- A partner sees only their assignment and execution scope, not the office's customer identity or private quote economics unless a separate approved need exists.
- A traveler controls whether and which Trip/Request data is shared with each provider.
- Community posts and comments pass moderation and abuse controls; hidden/pending content is not public.
- Reports are private to moderators/reporters under a defined policy.
- Public DTOs must disclose trust scope and unknown/expired evidence without exposing document IDs, storage keys or license identifiers.
- Analytics/events must exclude prompts, raw travel details, passport data, private URLs/tokens, credentials and document payloads.
- All privileged actions retain actor, scope, source/reference, timestamp and audit outcome.
- Provider and external content is untrusted data. Instructions inside web pages/documents never modify policies or invoke privileged tools.

## 6. Migration and compatibility principles

1. Additive migrations first; no production reset/rebuild.
2. Inventory current data and indexes before any DDL.
3. Preserve current URLs and current public DTO contracts during a compatibility window.
4. Use explicit legacy projections/adapters for `offers`, saved intents and contact requests.
5. Backfill only from known data; unknown provider/category/availability values stay unknown.
6. Preserve immutable quote versions and historical supplier evidence; never rewrite old quote economics based on a newer catalog.
7. Avoid copying contact/customer personal data into new provider/community tables.
8. Keep `community_v1.sql`, traveler-workspace and service-fulfilment migration activation gates independent until release sequencing is reviewed.
9. Require migration-upgrade, rollback, owner-isolation, tenant-isolation, concurrency and public redaction tests.
10. No production migration or flag flip is part of the RFC PR.

### Compatibility strategy to decide

- **Option A — Extend existing tables:** simplest for current offers, but may overload package assumptions.
- **Option B — Add listing/provider domain and adapt existing offers:** cleaner multi-category evolution, but requires projections and careful dual-read/write planning.
- **Option C — Stage with projection first:** retain current write model, introduce a unified read/API contract and validate category needs before adding canonical writes.

The recommendation for review is **Option C as a low-risk first step**, followed by Option B only after category requirements are evidenced. This is a proposal, not an approved decision.

## 7. Required test matrix

| Domain | Required proof |
|---|---|
| Provider identity/trust | Correct scoped evidence, expiry, revocation, role and public redaction |
| Listings | Type-specific validation, moderation, query filters, expiry, currency, unknown availability and legacy URL compatibility |
| Discovery | Pagination, facets, empty/zero supply, no stale or untrusted listings |
| Trip/TripItems | Owner isolation, participant consent, per-item state/freshness, legacy-intent migration, history integrity |
| Request | Consent, recipient scoping, anti-spam/idempotency, fan-out behavior if approved, source-linked opportunity adoption |
| Agency | Workspace tenancy, inquiry lineage, immutable intent/quote snapshots, owner-only commitments |
| Fulfilment | Partner assignment scope, transitions, replay/concurrency, delivery acceptance/rework, separate money evidence |
| Community | Post/comment/reply/report moderation, author ownership, duplicate reactions, abuse/rate limits, hidden-content privacy |
| Evidence/provider | Provenance, observedAt/validUntil, timeout, unavailable/degraded behavior, no AI-as-source |
| Cross-cutting | Authorization, DTO privacy, audit, migration upgrade/rollback, desktop/mobile browser QA |

Use current suites as the base rather than creating broad duplicate tests: marketplace DB/security; agency/commercial; quote delivery; traveler workspace; community contract; service fulfilment; readiness/evidence; capability/runtime; browser/mobile.

## 8. Rollout gates

### Stage 0 — RFC approval
Review this document, resolve blocking decisions and mark remaining unknowns. No schema/code changes.

### Stage 1 — read-model convergence
Define a unified listing/provider/Trip/Request contract and projections over current records. Build contract tests and compare results with existing pages/routes. No write-path migration yet.

### Stage 2 — shared domain foundation
Only after Stage 1: additive provider/taxonomy/listing/Trip structures as approved; backfill known records; preserve current behavior.

### Stage 3 — complete discussion MVP
Comments/replies/moderation/reporting, links to destinations/listings/Trips, privacy and operational moderation process.

### Stage 4 — integrated marketplace request loop
Search/discovery → selected listings → Trip/Request → agency opportunity → sourcing → immutable quote → traveler response → appropriate fulfilment path.

### Stage 5 — category/provider expansion
Add one category/provider integration at a time with real supply and source/freshness proof. Read-only search stays distinct from booking.

### Stage 6 — commercial activation
Choose the transaction/fee role, contracting responsibilities, refund/cancellation policy, support ownership and any payment rail only after separate legal/security/commercial approval.

## 9. Decisions required from product owner/review

| ID | Decision | Proposed default | Why it remains open |
|---|---|---|---|
| D1 | Is marketplace + community the main product architecture? | Yes: two first-class pillars | Product framing across older PRs/docs must be reconciled |
| D2 | Provider identity: extend agent or introduce Provider linked to agent/workspace? | Projection first; evaluate shared Provider when category needs are mapped | Avoid duplicated identity/tenancy |
| D3 | Listing model strategy | Read-model projection first, then additive category-aware write model | Current offers are package-shaped |
| D4 | Initial listing categories | Start with categories supported by real supply/operations | No verified supply-demand mix in code |
| D5 | Trip vs saved intent | Trip/TripItem target; saved intent is compatibility source | Need define multi-service scope and guest/account ownership |
| D6 | Request fan-out | One provider initially unless user approves and consent/privacy controls pass | Multi-provider routing changes privacy and spam model |
| D7 | Community discussions | Complete comments and reporting before public scale | DB exists, complete workflow does not |
| D8 | Public supplier directory | Add only after reusable supplier identity/evidence criteria are set | Current supplier options are opportunity-specific |
| D9 | Payments/booking | Out of scope for current marketplace phase | Requires separate business/legal/provider approval |
| D10 | Mobile parity timing | After shared APIs and primary web journeys stabilize | Current mobile screens cover a subset |
| D11 | Category-specific inventory model | Request-only where live availability cannot be proven | Avoid fake/live-looking stock |
| D12 | Multi-agency ownership/membership | Keep current single-workspace constraint until requirement is validated | Current unique agent workspace constraint |

## 10. Approval checklist

The RFC is ready for implementation planning only when reviewers confirm:

- [ ] Marketplace and Community are both first-class.
- [ ] Existing source-of-truth tables and compatibility paths are explicit.
- [ ] Provider identity and public trust are not conflated.
- [ ] Listings, supplier options, quotes, orders and fulfilment have distinct meanings.
- [ ] Trip/TripItem and Request/Inquiry boundaries are explicit.
- [ ] Community replies/reports and marketplace linking have an approved lifecycle.
- [ ] Price, availability, freshness, evidence and unknown states are precise.
- [ ] API ownership, privacy, tenant isolation and migration/test order are defined.
- [ ] Booking/payment/merchant-of-record decisions remain separate and unapproved until evidence exists.
- [ ] Each implementation stage has a measurable Definition of Done and release gate.

---
**RFC conclusion:** use the current SILA application and PostgreSQL domain as the system of record. Converge its marketplace, community, traveler and agency journeys through explicit shared contracts and additive compatibility—not a rewrite or a second platform.


## 10. External supplier integrations and unified comparison

The current code already contains a read-only Amadeus Self-Service flight adapter and the `/compare` flight comparison page. The supplier registry currently contains Amadeus only; Booking.com Demand API, hotel sourcing and NDC/NDC[X] are not yet implemented in the audited baseline.

The proposed multi-source architecture must extend the existing comparison surface rather than create a second marketplace or booking engine. NDC is the IATA Offer/Order exchange standard; Amadeus NDC[X] is a separate travel-seller aggregation capability; Booking.com Demand API is a separate partner integration. Their access requirements, market coverage and operational authority must remain distinct.

See [SILA Supplier Integration & Unified Comparison RFC](./SILA_SUPPLIER_INTEGRATION_COMPARISON_RFC.md) for the code audit, source matrix, typed comparison contract, Booking/Amadeus/NDC distinctions, Egyptian market constraints and phased delivery plan. This remains a draft architecture proposal; it does not approve credentials, database changes, booking, ticketing, payment or Production activation.
