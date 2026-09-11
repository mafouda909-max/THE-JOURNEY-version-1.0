# THE JOURNEY — PROJECT EXECUTION STATE

Last update: 2026-09-12
Release status: **UNVERIFIED / SHIP CANDIDATE NOT YET DECLARED**
Deployment status: **Existing production is healthy on the old schema; new branch preview provisioning is blocked before build execution.**

## Current canonical branch

`codex/full-project-completion`

## Current HEAD

`c6dff4903f1d407f9e50bd3bbfe446b968095ec3` — `fix quote delivery freshness test fixture`

## Last verified commit

`c6dff4903f1d407f9e50bd3bbfe446b968095ec3`

Evidence: GitHub Actions CI run `34649507835` / run #274 completed all five jobs successfully, including every database-backed suite with no skipped downstream release tests.

## Completed work

- Agency workspace + membership foundation and tenant boundary.
- Agency client + canonical opportunity domain.
- Marketplace `contact_requests` intake adoption into canonical opportunities.
- Immutable/versioned Traveler Intent snapshots.
- Supplier option provenance, observation time, validity and freshness enforcement.
- Immutable/versioned Quote snapshots and deterministic quoted economics.
- Commercial activities and domain event audit history.
- Deterministic commercial intelligence signals.
- Marketplace projection boundary.
- Agency inbox, pipeline, opportunity workspace, supplier sourcing, quote-version and commercial-health surfaces.
- Phase 4 quote send/outcome integrity:
  - only newest created quote version may be sent;
  - winning version must have actually been sent;
  - newer sent revision supersedes an older sent revision for winning purposes;
  - terminal opportunity outcomes settle quote states consistently.
- Phase 5 secure client quote delivery loop:
  - delivery bearer tokens are generated randomly and only SHA-256 digests are persisted;
  - `prepared` is distinct from `active`; preparing/copying a link does not fabricate `quote_sent` telemetry;
  - activation after agent confirmation creates the real `quote_sent` event;
  - client quote page exposes client-facing sell data/terms only, not cost, commission, margin, supplier references or private traveler identity;
  - first real client view creates one `quote_viewed` activity;
  - client approval/decline/change request creates `client_response` without fabricating booking/payment or a won outcome;
  - terminal quote/outcome transitions revoke active/prepared delivery links safely;
  - responded delivery records remain historical decision evidence.
- Release manifest upgraded through schema version 5.
- CI explicitly runs Phase 4 + Phase 5 regressions and complete release-migration upgrade coverage.
- Draft PR #13 has been rewritten to represent the broader canonical commercial-core scope and remains Draft intentionally.

## Verified evidence

### Git / architecture

- Resume baseline: `0cbb20593147dff643e8170a3c9f85194c7a05bd` on `codex/full-project-completion`.
- At resume the branch was 166 commits ahead of `main`, 0 behind, with merge base/current `main` `2265ebc4ddc2216b101e4d6b106e2eac45053e12`.
- The branch already contained the Agency/Intent/Quote commercial stack; rebuilding it from scratch was rejected as duplicate architecture.
- `contact_requests` remains channel-specific marketplace intake; `agency_opportunities` is the canonical commercial work aggregate. No duplicate `agency_inquiries` aggregate is currently justified.

### Phase 4 / Phase 5 database integrity

- `db/phase4_quote_delivery_integrity.sql` is in release order after Phase 3.
- `db/phase5_quote_delivery_loop.sql` is in release order after Phase 4.
- Phase 5 terminal settlement bug was found and fixed before acceptance: the delivery guard now permits the safety transitions `prepared|active -> revoked|expired` after canonical linkage validation, even when the quote/opportunity has just become terminal or validity elapsed.
- Delivery identity/linkage fields and token digest cannot be changed during operational state transitions.
- `tests/quote-delivery-loop-db.test.ts` proves prepare ≠ send, digest-only token storage, private-data projection safety, first-view telemetry, client-response semantics, duplicate-response conflict, newer delivery behavior and confirmed win -> quote accepted -> active delivery revoked.

### Current CI

GitHub Actions run `34649507835` / CI #274 on HEAD `c6dff4903f1d407f9e50bd3bbfe446b968095ec3`:

- Typecheck & lint — **success**.
- Unit & contract tests — **success**.
- Production build — **success**.
- Mobile app typecheck/tests/iOS Metro bundle — **success**.
- Database security — **success**.

The DB job ran and passed all of these, with no downstream skip:

- Agency database security.
- Marketplace database trust.
- Marketplace workflow integrity.
- Canonical commercial workflow.
- Marketplace inquiry adoption.
- Supply freshness integrity.
- Quote delivery integrity.
- Secure quote client delivery loop.
- Full marketplace-to-outcome E2E.
- Offer review lifecycle.
- Release migration upgrade.

Prior failed CI run `34648915815` is superseded by #274. Its two failures were diagnosed and fixed: React effect lint lifecycle and an invalid test fixture that modeled a volatile hotel line without provenance `validUntil`.

### Neon Production V1 clone validation

Production project: `THE JOURNEY Production V1` / `icy-firefly-64909570`, PostgreSQL 18.

Safe validation branch created from the actual production branch:

- name: `ship-candidate-migration-20260912`
- branch id: `br-wild-meadow-b1erpo93`
- parent production branch: `br-round-band-b1s8gdka`

No production-branch writes were performed.

On the production clone:

- `contact_request_ownership` applied successfully.
- AI verification table/alignment requirement is satisfied.
- Phase 1 agency foundation applied successfully.
- Phase 2 commercial domain applied successfully.
- Phase 3 freshness/provenance integrity applied successfully.
- Phase 4 quote delivery/outcome integrity applied successfully.
- Phase 5 secure client-delivery loop applied successfully.
- Equivalent read-only validation of `scripts/check-production-schema.ts` required base tables/columns returned **zero missing columns/tables**.
- A functional Postgres 18 smoke transaction created a synthetic agency commercial chain, sent a quote, created an active delivery, then confirmed the opportunity won.
- Final smoke state was:
  - `quote_sent` count = 1;
  - opportunity stage = `won`;
  - won quote version bound;
  - quote status = `accepted`;
  - active delivery status = `revoked`.
- An earlier smoke attempt deliberately failed and rolled back because `observedAt` was slightly in the future; Phase 3 correctly rejected it. This is evidence of fail-closed freshness enforcement, not a migration incompatibility.

Conclusion: the ordered commercial migration chain is compatible with a branch cloned from the current Production V1/Postgres 18 state for the schema/invariants exercised. Applying it to the parent production branch remains owner-gated.

### Live Vercel / deployment

Connected project:

- project: `the-journey-version-1-0`
- project id: `prj_WTa6Q1jnXOst1rKvR3dpEJh309iP`
- team: `team_GASBeP4k1Whgjv8OkggLyUEH`
- framework: Next.js
- Node: 24.x
- plan observed: Hobby

Current evidence:

- Existing production alias previously returned `/api/health` HTTP 200 with healthy DB and Backblaze B2.
- Current project metadata still reports `live: false` while an older production deployment remains reachable.
- Repeated Git-linked preview deployments for `codex/full-project-completion` fail with `BUILD_FAILED` / `Resource provisioning failed` before application build execution.
- Latest inspected failing preview: `dpl_sFGM9BXseamA6PW2NvQBbWhooa1P` for commit `bef1e3b...`.
- That deployment produced **zero build-log events**.
- GitHub CI production build for the newer HEAD succeeds, so there is no current evidence that application compilation is causing the preview failure.
- Vercel public status currently reports Build & Deploy operational; therefore a project/account/integration provisioning issue is more likely than a platform-wide deployment outage, but the exact provisioning dependency is still unverified.
- `https://alrehlla.com/api/health` still fails to fetch through the connected Vercel path. Domain/DNS configuration remains unresolved.
- The available direct-deploy connector returned an internal input-schema validation mismatch before creating any deployment; this is a connector limitation and is not counted as product/deployment evidence.

## Failed checks

- **Current HEAD CI:** none after run #274.
- **Vercel preview:** failing before build with `Resource provisioning failed`; no build logs.
- **Custom domain:** `alrehlla.com` reachability remains failing/unverified.
- **Production schema for new branch:** production parent still lacks the Phase 1–5 commercial schema until an owner-approved migration is applied.

## Skipped checks and exact reason

- Production migration execution: **skipped intentionally** because it writes production schema and is owner-gated after clone validation.
- Production promotion/merge: **skipped intentionally** because preview/browser smoke and production migration are not yet cleared.
- Browser smoke against the new branch: **blocked** because Vercel cannot currently provision a preview deployment.
- Deletion of the Neon validation branch: **not performed**; deletion is destructive and the connected Neon tool requires explicit user approval. The branch is also useful as temporary release evidence.

## Decisions already made

1. Keep `codex/full-project-completion` as canonical until stronger evidence says otherwise.
2. Do not reset to `main`.
3. Do not build a duplicate Inquiry aggregate without a real distinct intake/SLA/dedup lifecycle.
4. Keep Intent and Quote snapshots immutable/versioned.
5. Distinguish latest created quote version from latest communicated quote version.
6. Keep DB triggers/constraints as the final integrity boundary; service UX guards are defense-in-depth.
7. A client response `approved` is evidence of client intent, not proof of payment, supplier confirmation or a completed sale.
8. A prepared share link is not a sent quote; activation after human confirmation is the communication boundary.
9. Do not expose internal supplier economics/provenance through the public quote surface.
10. Do not diagnose Vercel provisioning failures as code/build failures without build evidence.
11. Do not apply production migrations or promote the branch without owner approval after the now-completed production-clone migration validation.

## Remaining blockers

### P0 / release

1. Resolve or isolate Vercel preview `Resource provisioning failed` enough to obtain a real deployable preview and browser smoke target.
2. Resolve `alrehlla.com` DNS/custom-domain reachability.
3. Owner approval is required to apply the tested schema-v5 existing-database migration chain to the Production V1 parent branch.
4. After production migration, promote only a CI-green reviewed commit and verify production health/runtime.

### P1 / product / commercial truth

1. Add explicit service-level 409 guidance for stale send / unsent or superseded winning-version conflicts where DB triggers currently provide the final guard.
2. Model **realized economics** separately from immutable quoted economics: supplier settlement, actual commission, refunds/cancellations, fees/taxes and FX effects. Do not mutate historical `agency_quote_versions`.
3. Add a structured outcome-reason taxonomy with optional free-text detail for aggregate learning and PII minimization.
4. Determine whether follow-up needs scheduled reminder semantics for launch or whether recording activities plus current pipeline priority is sufficient; do not grow into a generic CRM.

### P1 / intelligence

- Current intelligence is deterministic/evidence-backed and now has real `quote_viewed` / `client_response` telemetry, but it is not a learned closed loop.
- Before any learned/cross-agency model, define privacy-safe features and prove measurable value from outcomes; no speculative ML layer is required for launch.

## Pending implementation actions

1. Add service-level conflict preflight and targeted regression tests for Phase 4 send/outcome errors.
2. Design and implement a minimal realized-economics boundary only if it is necessary to correctly report won/cancelled/refunded commercial value at launch.
3. Add structured outcome reason taxonomy if it materially improves launch intelligence without feature creep.
4. Continue Vercel provisioning diagnosis through project/account/integration configuration evidence; avoid application-code changes without causation evidence.
5. Fix custom-domain DNS/configuration when actionable configuration access is available.
6. When a preview is available, run browser reality smoke for traveler -> inquiry -> adoption -> opportunity -> evidence -> quote -> secure client delivery -> view/response -> confirmed outcome.
7. Update PR #13 evidence section after the final preview/deployment result.
8. Run final reality audit across traveler, agent, agency owner, admin/trust operator, attacker, search engine, mobile user and business owner before declaring SHIP CANDIDATE.

## Owner-only actions

- Approve application of schema-v5 existing-database migrations to production parent branch `br-round-band-b1s8gdka` after reviewing this clone evidence.
- Approve final merge/promotion to the production deployment path after preview/browser smoke.
- Any paid Vercel plan/support escalation if the provisioning failure requires an account/billing/platform intervention.
- Approve deletion of Neon validation branch `br-wild-meadow-b1erpo93` when it is no longer needed.

## Exact next action

Continue Vercel provisioning/root-cause diagnosis and domain state while implementing only the remaining launch-critical commercial truth gaps; do not touch production. If Vercel remains externally blocked, isolate it as an owner/platform blocker and finish the remaining release gates so the repository reaches SHIP CANDIDATE independent of that external dependency.
