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

This section records the work opened after the repository audit. Status describes GitHub branches and CI evidence, not a Production release.

### 9.1 Current work

| Workstream | Current state | Boundary |
|---|---|---|
| Runtime dependency security | PR #106 open as Draft; the earlier exact-head run passed all 7 CI jobs. A follow-up CI-trigger adjustment is on the branch and its new run is pending/in progress. | No merge or Production deployment. |
| Community discussions | PR #107 open as Draft, stacked on the security branch. Adds comments, one-level replies, public read, authenticated write, moderator publish/reject/hide, audit, and an additive reply migration. | Migration not applied; `COMMUNITY_ENABLED` remains off. Exact-head CI is running. |
| Repository architecture | PR #104 contains the implementation audit, asset map, execution plan and marketplace domain RFC. | Documentation/proposal only; not an approved schema design. |

### 9.2 Product sequence confirmed for this execution

The marketplace and community remain equal first-class pillars. The immediate implementation order is:

1. **Complete the Community MVP:** comments/replies, reports and moderator workflow; then connect community content to public destinations, providers and listings without exposing private Trips or Request data.
2. **Provider directory:** map existing agent profiles and agency workspaces first; then introduce a reusable provider identity only where multiple real provider categories require it. Supplier options remain opportunity-scoped sourcing snapshots, not public directory entries.
3. **Typed marketplace listings:** define stable categories and category-specific validated attributes; preserve current package-shaped `offers` URLs and contracts through an adapter/projection during transition.
4. **Discovery:** category/destination/date facets, truthful empty states, price basis, availability mode, source, observed time and expiry.
5. **Traveler Trip and Request:** evolve saved intents without losing ownership, snapshots, offer links or inquiry lineage. Default to one selected provider per request until explicit consent and multi-provider privacy controls are approved.
6. **Agency and fulfillment convergence:** reuse existing opportunity, sourcing, immutable quote-version and delivery loops. Keep booking, ticketing and payments distinct from quote acceptance and service acceptance.
7. **Provider-specific activation:** one integration/category at a time, only with real supply, commercial terms, evidence freshness, operational owner and exact-head proof.


### 9.3 Active implementation PRs (status at 25 November 2026)

| PR | Scope | Current implementation | Not yet delivered |
|---|---|---|---|
| [#106](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/pull/106) | Dependency security baseline | Next.js and Expo patch updates, lockfiles, removed old advisory exceptions, CI trigger supports stacked security PRs. Exact tested head passed 7/7 jobs before the final branch was retargeted by the follow-on PRs. | Merge/release approval and production deployment. |
| [#107](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/pull/107) | Community MVP + provider directory | Comments and one-level replies with moderator approval, private post/comment reports and resolution queue, additive v2/v3 migrations, public agency/independent-agent directory projection, search and real published-offer facets. | Exact final head CI and review; community ↔ destination/listing/provider/Trip links, appeals and notifications; more provider kinds require onboarding/evidence. |
| [#108](https://github.com/mafouda909-max/THE-JOURNEY-version-1.0/pull/108) | Listing contract + inquiry lineage | Transitional read model over current `offers`; API facets/search; provider price vs confirmed availability distinction; preserve links to existing details/contact/saved intent/agency opportunity flow. Removed unsupported `InStock` and expiry-as-price-validity claims. | Exact final head CI and review; category-specific listing publication and schemas, live supplier evidence, bookings and payments are not included. |

The PRs remain Draft, stacked on the security branch. No PR is merged; no migration, feature activation, or Production deployment has been performed. CI must be checked against each exact final head, not an earlier commit.

### 9.4 Important capability boundary

The existing `offers` table still represents package-shaped provider offers with a `tripType` enum. The six current categories (Umrah, packages, visas, flights, hotels, cruises) are labels on that shared shape, not six fully specialized publishing workflows. PR #108 provides a compatibility/read-model contract only. It does **not** complete category-specific inventory for flights/hotels/visas or introduce a generic supplier marketplace.

The safe next domain step is to agree category-specific required fields and source/freshness semantics, then add a reviewed additive listing extension that keeps legacy offers readable. Do not create generic provider identities for hotel, airline or transport businesses until their onboarding, evidence, operational ownership and commercial terms are defined.

### 9.3 Non-negotiable release gates

- Keep every feature behind its existing/default-off gate until schema and Preview proof are complete.
- Apply only additive migrations to isolated test/Preview databases first; do not run Production DDL in this workstream.
- Keep existing public offer DTOs, agent trust boundaries, agency tenant isolation and traveler ownership unchanged.
- Do not infer verified availability, booking, payment or supplier fulfilment from a listing, request, quote or AI result.
- A PR is not complete until all 7 CI jobs pass on its exact final head and its migration/security/UI behavior is reviewed.
- Merge, feature activation and Production deployment remain separate owner-approved steps.
