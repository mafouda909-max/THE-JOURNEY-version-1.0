# SILA — Master Execution Plan
**Last updated:** 2026-11-25  
**Product:** صلة | SILA  
**Repository:** `mafouda909-max/THE-JOURNEY-version-1.0`  
**Baseline:** `main` at `fde60ef182e3fb4c24e2f1d6c36feb8f2e3e62aa`  
**Architecture discovery task:** [Issue #103](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/issues/103)  
**Structural audit:** [SILA_IMPLEMENTATION_AUDIT.md](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/blob/audit/sila-marketplace-community-gap-2026-11-24/SILA_IMPLEMENTATION_AUDIT.md)

---

## 1. Product direction — the source of truth

SILA is an **integrated travel marketplace with a first-class travel community**.

The product must connect:
1. Travelers seeking travel services and credible information.
2. Providers and agencies offering those services.
3. Listings, prices, availability, requests, quotes and fulfillment.
4. Travelers sharing destination/service knowledge and experiences through the community.
5. Evidence, trust, freshness, moderation and operational controls across the whole platform.

Travel Advisor/Readiness is a valuable intelligence capability inside SILA. It must support trip planning, evidence-backed guidance and handoff into the marketplace; it is not a replacement for the marketplace.

### Product principles

- Marketplace and Community are first-class pillars.
- Build the complete domain architecture and product structure; activate integrations and transaction modes only when genuinely ready.
- Preserve the current modular monolith and reuse working modules. No parallel CRM, inquiry engine, quote engine or second app.
- Provider identity, service listing, supplier sourcing, price, availability, request, quote, booking and fulfillment are separate concepts.
- Keep provider-reported claims distinct from verified evidence and live inventory.
- No fabricated providers, offers, reviews, source claims, prices or availability.
- No production migration, rollout, payment or booking activation based only on passing tests.

---

## 2. Repository state and execution control

### Mainline facts

- `main` is the stable production-backed baseline, currently inspected at `fde60ef...`.
- Structural audit and this execution plan live on `audit/sila-marketplace-community-gap-2026-11-24`; this branch is documentation-only and has not changed `main`.
- PR #102 has 116 commits / 72 changed files. Its exact HEAD `554a296...` passed all seven CI jobs in run [39494503900](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/actions/runs/39494503900). It is still open and its product framing says “decision and verification platform, not a conventional marketplace”, which must be reconciled with the current product direction before merge.
- PR #101 is a draft and its inspected CI run failed. It overlaps PR #102 on important design and account surfaces.
- PR #79 is 3 commits ahead / 17 behind main and its inspected CI run failed.
- PR #70 is 5 commits ahead / 41 behind main and its inspected CI run failed.

These are triage facts, not final code-quality judgments. No PR is approved to merge by this plan.

### Existing GitHub work — do not duplicate

| GitHub item | Role in the new execution line |
|---|---|
| [#81](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/issues/81) | Master execution roadmap — realign from Advisor-only Travel OS to integrated marketplace + community. |
| [#78](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/issues/78) | Release-quality control and proof gates. |
| [#103](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/issues/103) | First active task: docs-only marketplace/community domain RFC. |
| [#82](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/issues/82), [#80](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/issues/80), [#53](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/issues/53), [#56](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/issues/56) | Advisor workstream, retained as a supporting product capability; sequence after the shared domain decisions where relevant. |
| [#69](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/issues/69) / [#70](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/pull/70) | Traveler saved-trip ownership and activation proof; retain for the traveler trip/memory phase, but rebase/retest before release. |
| [#15](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/issues/15) | Real pilot activation: genuine provider → approved listing → traveler inquiry → response/outcome. |
| [#44](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/issues/44) | Optional email sender prerequisite; not a blocker for marketplace discovery or account login. |

---

## 3. Execution phases and hard exit gates

Each phase produces one reviewable vertical slice with a branch, Issue, PR, tests, exact-head CI, preview proof where relevant, known limitations and an explicit merge decision. A phase does not advance merely because files or tests exist.

### Phase 0 — Repository stabilization and integration control

**Goal:** stop fragmentation and know exactly what is safe to build on.

Tasks:
- Keep `main` and the current Production deployment unchanged while work is reviewed.
- Audit PR #101 and #102 together because they overlap in visual system, homepage, workspace and traveler UI.
- Decide whether #101 is a source of reusable design work, whether #102 is the preferred UI candidate, or whether both need a smaller reconciled integration PR.
- Reconcile #79 and #70 with current main; cherry-pick/rebase only if their behavior is still required and their tests can pass on the current baseline.
- Close or archive obsolete branches only after their useful changes are accounted for.
- Confirm current main, Production SHA, protected Preview SHA, database identity and feature flags before each release.

**Exit:** no unresolved competing changes to the same core surface; every open PR has an explicit KEEP / PORT / REBASE / CLOSE decision; exact-head CI is green for any PR considered for merge.

### Phase 1 — Product/domain architecture RFC

**Goal:** agree on the shared concepts before changing schemas.

Deliverables:
- Provider/business/organization relationship.
- Service taxonomy and category-specific listing contracts.
- Price, availability, source and evidence contracts.
- Traveler trip and multi-service trip item model.
- Request → supplier response → quote/version → booking/order → fulfillment lifecycle.
- Community posts, comments/replies, reactions, reports and moderation; references to destinations/providers/services/listings.
- API boundaries, permissions, migration/backfill plan and decision register.

**First execution task:** [Issue #103](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/issues/103).

**Exit:** RFC reviewed and owner decisions recorded; all proposed entities mapped against existing tables; no unexplained duplicate records or parallel domains.

### Phase 2 — Provider and service taxonomy foundation

**Goal:** represent who supplies a service and what kind of service is being offered.

Build after Phase 1 approval:
- Reusable provider/business identity linked safely to current accounts and agents.
- Provider membership/roles and profile lifecycle.
- Service category/type registry with versioned validation.
- Provider onboarding and evidence/review states scoped by provider and category.
- Backward-compatible mapping from current agent profiles and agency workspaces.

**Exit:** an approved provider can own the correct service types; role/tenant boundaries and evidence checks are enforced; legacy agent accounts and offers remain readable.

### Phase 3 — Service catalog, listings and discovery

**Goal:** make multiple travel service families discoverable in the same marketplace.

Deliverables:
- Shared listing identity and common fields.
- Category-specific attributes and validation (not one unbounded trip-shaped object).
- Provider-managed listing and manual/RFQ supply modes.
- Source-aware price and availability observations with timestamps, validity and limitations.
- Search, filters, listing detail and comparison appropriate to each category.
- Compatibility projection for the legacy `offers` model during transition.

**Exit:** one real approved provider can publish a typed listing; travelers can discover, inspect and compare it without confusing a quote with confirmed inventory.

### Phase 4 — Community MVP

**Goal:** complete the existing community foundation and connect it to travel knowledge and marketplace entities.

Deliverables:
- Complete create/list/read/moderate comment/reply APIs and UI.
- Accurate comment/reaction counts and pagination.
- Report/block and moderation queue/action history.
- Clear author/source labels (traveler, provider, moderator/editorial) and evidence level.
- Optional links to destinations, service categories, providers and listings.
- Preserve the existing post review and helpful reaction model.

Groups, follows, private messaging and social-feed ranking are later decisions, not launch blockers for a useful community.

**Exit:** a real user can create a post, receive moderation, comment/reply and report content; moderators can resolve reports; community content links to the right marketplace context without leaking private trip data.

### Phase 5 — Unified traveler trip and commercial request flow

**Goal:** let one traveler trip contain multiple service categories.

Deliverables:
- Trip/trip-item model that preserves the existing saved intent context.
- Save and compare heterogeneous listings.
- Request a single service or a multi-service itinerary while preserving each provider and item's status/terms.
- Supplier response and clarification loop.
- Immutable, versioned quotes with comparable totals and item-level exclusions/unknowns.
- Traveler status view and notifications.
- Advisor context can populate the trip/request only through explicit, privacy-safe ownership projections.

**Exit:** an end-to-end multi-service request runs in isolated test data, with all items and providers traceable and each quote version immutable.

### Phase 6 — Agency operations and fulfillment convergence

**Goal:** make the existing agency commercial workspace operate on the same provider/listing/request/quote/order model.

Reuse:
- `agency_clients`
- `agency_opportunities`
- `agency_intent_versions`
- `agency_supplier_options`
- `agency_quotes` / `agency_quote_versions`
- existing quote delivery and response services
- gated `sila_service_orders` fulfillment pilot

Extend provenance from scoped supplier options to canonical providers/listings without duplicating quotes or CRM records. Keep service fulfillment allowlisted until terms, partner access, acceptance, fee/refund responsibilities and isolated Preview proof are approved.

**Exit:** marketplace demand and agency-originated demand can both use the same provider, sourcing, quote and order lifecycle with tenant isolation.

### Phase 7 — External integrations and transaction modes

**Goal:** activate only the supplier or transaction capability that has a real technical and commercial basis.

Possible integration tracks:
- Flight search/availability.
- Hotel inventory.
- Transfers and activities.
- Visa-service suppliers/data.
- Currency and geo.
- Booking/ticket/voucher issuance.
- Payment authorization, settlement, refunds and reconciliation.

Every provider has its own credentials, licensing/terms, request quotas, timeout/fallback, evidence/freshness, confirmation semantics and operational owner. Read-only search is not a booking; a payment ledger is not a payment rail.

**Exit:** provider-specific contract and exact-head end-to-end proof; explicit customer/merchant responsibility; support and rollback plan.

### Phase 8 — Controlled market activation and improvement

**Goal:** prove real marketplace behavior, not just code completion.

Activation path:
1. Genuine provider identity and required evidence.
2. Real listing with grounded source, scope, price/availability and validity.
3. Traveler discovery and comparison.
4. Inquiry/request and provider response.
5. Quote acceptance and confirmed booking only where genuinely supported.
6. Delivery/outcome, community feedback and dispute/support path.
7. Measure supply quality, response time, conversion, cancellation, fulfillment quality and repeat use.

**Exit:** real pilot evidence, reviewed operational metrics, support process and a tested rollback. Synthetic QA remains excluded from business metrics.

---

## 4. Parallel work lanes and coordination rules

### Safe parallel lanes after Phase 1

- **Marketplace lane:** provider identity, taxonomy, listings and discovery.
- **Community lane:** comments/reports/moderation; may proceed independently once entity-link contracts are agreed.
- **Traveler lane:** multi-service trip and saved context.
- **Agency lane:** supplier sourcing, quotes and fulfillment convergence.
- **Quality lane:** database security, accessibility, desktop/mobile browser QA, operational release checks.

No two agents should edit the same core schema/API/UI surface in parallel. Parallel work must be separated by files/contracts and integrated through reviewed PRs.

### GitHub Copilot delegation

Use one well-scoped Issue per agent task. Each Issue must contain:
- product context and exact source paths;
- expected files and explicit non-goals;
- acceptance criteria;
- tests and proof required;
- data/security/feature-flag boundaries.

For the first task, assign [Issue #103](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/issues/103) to Copilot from GitHub's Assignees control. The GitHub REST connector could create the Issue but rejected `copilot` as a normal REST assignee; the Copilot-specific assignment is therefore a GitHub.com UI action. Once assigned, review the generated PR; do not treat agent output as merged or verified until exact-head checks and code review pass.

After the RFC, create/select specialized custom agents only where they add real value (domain/API, implementation, database/security QA). Avoid generating agent profiles before the domain and boundaries are agreed.

---

## 5. Engineering gates — Definition of Done

Every implementation PR must have:
1. A single bounded user-visible result and source issue.
2. Reuse/modify/build decision for affected modules.
3. Backward-compatible API and migration plan; no production resets.
4. Ownership, role, tenant and state-transition checks at server/database layers.
5. Unit/contract, PostgreSQL, security and browser coverage appropriate to the change.
6. Desktop and mobile review for changed journeys.
7. Failure, empty, stale, unknown, rejected and retry states.
8. All seven repository CI gates green on the exact final PR HEAD.
9. Protected Preview deployment on an isolated Preview database, with exact SHA and no production credential mixing.
10. Production release only after explicit approval, backup/rollback plan and canonical live smoke.
11. No fake inventory, testimonials, prices, trust states or external provider readiness.

### PR states

- **Draft:** work in progress, no merge.
- **Ready for review:** implementation complete, evidence attached, human review pending.
- **Approved for merge:** exact-head checks, code/security/design review and migration plan passed.
- **Released:** deployment SHA and live journey verified.
- **Closed/archived:** rationale and any retained commits documented.

---

## 6. Scope freeze — do not start these as separate projects now

- A second SILA app or a microservices rewrite.
- Another CRM, quote/proposal, booking or supplier database alongside existing modules.
- A broad autonomous AI/agent runtime before marketplace workflows are proved.
- New GDS/NDC/hotel/visa/payment vendors without provider contracts and activation proof.
- Groups, follower graph or private messaging before Community MVP succeeds.
- Custom domain/email purchase as a prerequisite for the current direct-link pilot.
- A new mobile stack; keep Expo and achieve parity from shared contracts.

---

## 7. Open owner decisions

These remain OPEN until explicitly decided:
- Which provider types can self-register and which require onboarding.
- Whether one provider organization can own multiple brands, branches or agency workspaces.
- Who contracts with the traveler per service: agency, provider, partner or another intermediary.
- Which categories use direct booking, request-for-quote, external handoff or manual confirmation.
- What provider/service evidence is required, who reviews it and how long it remains valid.
- What proves a verified review or completed travel experience.
- Which community controls are required at public launch and what moderation coverage exists.
- Whether SILA itself will ever take payment responsibility; no payment/settlement role is assumed by this plan.

---

## 8. Immediate sequence

1. Complete [Issue #103](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/issues/103) as a documentation-only RFC.
2. Review the RFC with the owner; resolve or explicitly park its OPEN decisions.
3. Reconcile PRs #101/#102 and stale PRs #79/#70 against the approved domain/UI baseline.
4. Create the first small provider/taxonomy contract implementation PR.
5. Complete the Community comment/report workflow as a bounded independent slice once entity-link contracts are agreed.
6. Continue into listing/search, multi-service trip/request, agency convergence and provider-specific activation.

**Current execution state:** Phase 0 triage underway; Phase 1 RFC opened as Issue #103. No source code, schema, Production flag or deployment has been changed by this plan.


---

## 9. Execution update — 25 November 2026

This section records the implementation PRs opened after the repository audit. Status describes GitHub branches and exact-head CI evidence, not a Production release.

### 9.1 Verified PR and CI state

| PR | Scope | Exact-head CI | Current implementation | Not yet delivered |
|---|---|---|---|---|
| [#104](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/pull/104) | Repository audit, asset map, marketplace/category contracts, execution plan and supplier/agent-offer verification RFCs | [Run 45541224848](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/actions/runs/45541224848) — **7/7 success on exact HEAD `ccab01d` before the latest agent-verification doc commits** | Documents existing Amadeus comparison code, Booking Demand onboarding/price rules, NDC/NDC[X] distinctions, agent-submitted offer verification states, source-aware margin policy and Premium boundaries. Latest docs commits require another exact-head CI run. | Owner review; RFCs remain proposals, not schema/provider/markup activation approvals. |
| [#106](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/pull/106) | Runtime dependency security baseline | [Run 45521932210](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/actions/runs/45521932210) — **7/7 success** | Next.js/runtime dependency patch and lockfile updates; CI supports stacked security branches. | Merge/release approval and Production deployment. |
| [#107](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/pull/107) | Community MVP + provider directory | [Run 45523334095](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/actions/runs/45523334095) — **7/7 success** | Moderated comments and one-level replies, private reports/review queue, additive migrations, public directory projection for existing evidence-reviewed agencies/independent agents, search and true published-offer facets. | Review/merge; community-to-destination/listing/provider/Trip links, appeals/notifications; new provider kinds require distinct onboarding and evidence. |
| [#108](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/pull/108) | Listing read model + truthful price/availability semantics | [Run 45523801703](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/actions/runs/45523801703) — **7/7 success** | Read-only adapter over existing `offers`, legacy IDs/routes retained, six real category facets, provider-reported price separated from live availability, inquiry/agency lineage preserved. | Review/merge; category-specific publishing schemas, supplier inventory, booking and payments are not included. |
| [#109](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/pull/109) | Traveler Saved Intent → agency opportunity; explicit readiness sharing consent | [Run 45525655144](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/actions/runs/45525655144) — **7/7 success on exact HEAD `d06c562`** | Selected Saved Intent fields reach the agency's commercial intent version; readiness summary is a separate unchecked-by-default per-request opt-in; owner scoping and flag gates retained. | Owner review; PR remains Draft and unmerged. |

All PRs above remain **Draft** and unmerged. PRs #107–#109 are stacked on the security branch so they inherit the patched dependency baseline. After #106 is reviewed and merged, retarget the stacked PRs to `main` and rerun the seven-job CI suite on each exact new head. Do not merge the stack as a blind batch.

### 9.2 Product sequence confirmed for this execution

The marketplace and community remain equal first-class pillars. The practical sequence is:

1. **Community MVP:** comments/replies, reports and moderator workflow; then entity links to public destinations, providers and listings, while keeping private Trips/Request data private.
2. **Provider directory:** reuse existing agent profiles and agency workspaces first. Introduce additional provider kinds only with real onboarding, qualification evidence, accountable service scope and operational ownership.
3. **Listing/category model:** preserve the existing package-shaped `offers` source and public URLs through the compatibility adapter. Record actual field coverage/missingness by category before choosing typed detail tables, constrained JSONB or linked detail records.
4. **Discovery:** category, destination, date and category-specific filters; truthful empty states; explicit price basis, source, observed time, availability scope and expiry.
5. **Traveler Trip and Request:** evolve existing saved intents and inquiry lineage toward a multi-service trip only after its items, participants, revisions, privacy and consent contract are reviewed. Do not create a second trip/request system.
6. **Agency and fulfillment convergence:** keep using existing opportunities, supplier snapshots, immutable quote versions and delivery loop. Distinguish quote acceptance, service acceptance, booking, ticketing and settlement.
7. **Supplier/category activation:** one category/integration at a time, with a real supplier, source/freshness evidence, commercial terms, support owner and exact-head tests.

### 9.3 Current capability boundary

- The existing `offers` table still has a shared package-shaped data model. The six `tripType` values (Umrah, packages, visas, flights, hotels, cruises) are not six specialized publishing workflows.
- PR #108 is a compatibility/read-model contract. It does not create category inventory or supplier availability.
- PR #107 only lists agency and independent travel-agent identities because these are the provider types supported by the current public evidence policy. It does not relabel agents as hotels, airlines, visa authorities or transport operators.
- Existing inquiry flow remains the write path: offer detail → contact request snapshot → optional Saved Intent link → agency opportunity → quote version/delivery.
- PR #109 carries the expressly linked commercial trip fields into the agency opportunity. A readiness summary is shared only when the traveler separately opts in for that specific request; raw advisor answers and unrelated Saved Intents are not included.
- Community reports remain private to moderators; a report does not automatically hide content.
- Rate limiting added to comment/report submission is process-local best effort, not distributed abuse protection.
- No category has live supplier booking, ticket issuance or payment enabled merely because its listing label or read endpoint exists.

### 9.4 Non-negotiable release gates

- Keep existing/default-off feature gates in place until schema, Preview, moderation staffing and rollback proof are complete.
- Apply additive migrations only to isolated test/Preview databases first; no Production DDL has been run in this workstream.
- Preserve public DTO redaction, agent trust scope, agency tenant isolation, traveler ownership and per-request consent.
- A PR is not complete until all seven CI jobs pass on its exact final head and code/migration/security/UI behavior is reviewed.
- Passing CI is evidence for code checks; it is not proof of real suppliers, demand, legal readiness, live inventory or production environment state.
- Merge, migration application, feature activation and Production deployment remain separate owner-approved steps.


### 9.5 External suppliers and unified comparison — source-backed decision

A repository inspection found that the flight comparison surface already exists on the inspected mainline:
- Amadeus Self-Service OAuth and Flight Offers Search adapter: `src/lib/travel-suppliers/amadeus.ts`.
- Canonical flight normalization: `src/lib/travel-suppliers/amadeus-normalize.ts`.
- Supplier registry currently contains Amadeus only: `src/lib/travel-suppliers/index.ts`.
- Comparison engine/page/API: `src/lib/travel-comparison.ts`, `src/app/compare/page.tsx`, `src/app/api/travel/compare/route.ts`, and `src/components/market/FlightCompareWorkbench.tsx`.
- Flight comparison remains gated by `FLIGHT_COMPARE_ENABLED=false` in `.env.example`. CI can enable it for isolated tests; this does not activate Production.
- GDS, NDC and hotel supplier capabilities are defined in the capability catalog but remain without independent connected adapters in the audited mainline.

Architecture decision:
1. Extend the existing comparison path; do not create a parallel compare app.
2. Amadeus Self-Service is the existing flight search adapter, not a booking/ticketing integration.
3. NDC is a standard. Amadeus NDC[X] is a separate Amadeus travel-seller capability and must be assessed under its own contract, airline list and market coverage.
4. Booking.com Demand is a separate partner API. Its current public scope includes stays, car rentals, attractions and transfers; flights are listed as coming soon. Access requires Managed Affiliate Partner onboarding and credentials issued through Partner Centre.
5. Keep live external supplier results separate from SILA provider-published offers and agency quote versions, even when they appear in one traveler decision experience.
6. Begin with read-only search, comparison and authorized redirect/inquiry. Price revalidation, booking, ticketing, payment and post-booking service remain separately gated.
7. Amadeus's published Self-Service Flight Create Orders production guide currently lists Egypt among unavailable markets and calls for a consolidator agreement for ticket issuance. Confirm the current position directly before any ticketing plan; do not promise that this API can issue Egypt-sold tickets.

Detailed source matrix, category data contract, comparability rules, architecture and delivery slices: [SILA Supplier Integration & Unified Comparison RFC](docs/SILA_SUPPLIER_INTEGRATION_COMPARISON_RFC.md).

This is a documentation decision only. No Booking/Amadeus/NDC credentials were added, no external supplier was activated, and no Production or database state was changed.


### 9.6 Agent offer verification and price governance

The product decision is to verify the agent's submitted offer against the exact supplier-backed service before presenting it as source-verified or using it as the basis for an automated selling-price calculation.

- An agent's uploaded listing must have category-specific identifiers and match keys. For flights, exact itinerary/fare/passenger/baggage/rules matter; for hotels, exact property/room/rate/occupancy/board/cancellation/tax basis matters.
- Prefer an exact supplier offer/reference lookup and a provider reprice/revalidation operation. Search-only similarity is a candidate match, not proof that the exact offer exists.
- Verification outcomes include exact matched and revalidated, price changed, partial match, source-confirmed but not repriced, agent-declared only, not found/unsupported, mismatch/review and expired.
- An absent match from a source with known coverage gaps is not proof of a false offer. The public status must explain what the source could and could not verify.
- Compare the verified agent offer against alternatives within the same service scope. Keep supplier results separate from SILA's agency-published offers/quotes; rank only genuinely comparable totals.
- The price engine must separate supplier payable total/net cost, mandatory charges, agent service fee/markup, supplier commission, SILA fee and traveler display total.
- Apply any fee cap only where the exact source contract permits it. Amadeus Self-Service documents flight markups but the current Amadeus Hotel Search/Book product disallows hotel room markups; Booking.com Demand requires correct book/total display and charges. Never copy a flight fee rule to hotels or Booking.com without source-specific approval.
- Basic truth disclosures and minimum verification standards apply to all public offers. Premium can unlock more supplier coverage, bulk rechecks, alerts and margin simulations, but cannot purchase stronger trust or conceal failed verification.
- The detailed draft is in [SILA Agent Offer Verification & Policy-Based Pricing RFC](docs/SILA_AGENT_OFFER_VERIFICATION_AND_PRICING_RFC.md).

No numeric fee cap, premium entitlement, new database schema, partner credential, payment, Production migration or live supplier activation is approved here.

Tracked implementation work:
- [Issue #110 — verify agent-submitted offers against real supplier systems and compare alternatives](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/issues/110).
- [Issue #111 — source-aware agent markup caps and transparent selling-price engine](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/issues/111), sequenced after an eligible offer can be verified through #110.

