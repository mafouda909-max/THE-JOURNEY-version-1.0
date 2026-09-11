# THE JOURNEY — PROJECT EXECUTION STATE

Last update: 2026-09-12
Release status: **SHIP CANDIDATE — repository/internal release gates clear; production promotion is still blocked by explicit owner/platform actions.**
Deployment status: **UNVERIFIED for this candidate in Vercel/browser. Git-linked previews are blocked by the Vercel Hobby build-rate limit; the custom domain is not resolving; Production V1 still runs the older deployed application/schema.**

## Current canonical branch

`codex/full-project-completion`

## Current HEAD

The commit containing this checkpoint file is the canonical branch HEAD at checkpoint time. Resolve its SHA from Git rather than hard-coding a self-invalidating value into the file.

Checkpoint parent / last code-and-test commit before the checkpoint documentation:

`246575fd1c24cce3ed274e88ebb5f561d30093ad` — `test public trust claims stay evidence-backed`

## Last verified commit

`246575fd1c24cce3ed274e88ebb5f561d30093ad`

Evidence: GitHub Actions CI run `34650440577` / run #286 completed all six jobs successfully. No database-backed release test was skipped.

## Completed work

- Agency workspace, memberships, client records and tenant isolation.
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
- Phase 5 terminal-settlement trigger bug fixed and regression-covered.
- Release manifest and migration tests upgraded through schema version 5.
- Commercial metrics no longer claim immutable quote economics are realized settlement; won quoted economics are labeled explicitly and kept separate by currency.
- Public Trust page rewritten to match implemented evidence:
  - no unsupported review feature claim;
  - no unverified 48-hour/business-day SLA;
  - no unverified storage-encryption claim;
  - no automatic implication that client approval equals payment/booking;
  - agent onboarding links to the actual `/join?mode=agent` flow.
- PostgreSQL connection TLS hardened:
  - remote certificate/hostname verification is explicit;
  - connection-string SSL controls cannot silently override application TLS policy;
  - localhost CI remains non-TLS.
- Security dependency line upgraded to patched stable versions:
  - Next.js `16.3.3`;
  - React `19.2.8`;
  - React DOM `19.2.8`;
  - eslint-config-next `16.3.3`.
- Permanent CI gate added for high/critical runtime dependency vulnerabilities in web and mobile lockfiles.
- Security headers/CSP, admin-session protection, marketplace public projection, KYC private-storage access, health-response sanitization and mobile validation/bundling remain covered by the existing implementation/tests.

## Verified evidence

### Git / architecture

- Resume baseline was `0cbb20593147dff643e8170a3c9f85194c7a05bd` on `codex/full-project-completion`.
- At resume the completion branch was 166 commits ahead of `main`, 0 behind; `main` was materially missing the Commercial OS.
- The implemented Opportunity + versioned Intent + versioned Quote model was challenged and retained; no duplicate `agency_inquiries` aggregate was justified.
- `contact_requests` is marketplace-channel intake; `agency_opportunities` is the canonical commercial work aggregate.

### Current CI — run #286

GitHub Actions run `34650440577` on `246575fd1c24cce3ed274e88ebb5f561d30093ad`:

- Typecheck & lint — **success**.
- Unit & contract tests — **success**.
- Runtime dependency audit — **success** for web and mobile at `audit-level=high` with runtime packages audited.
- Production build — **success**.
- Mobile app typecheck/tests/iOS Metro bundle — **success**.
- Database security — **success**.

The database job executed and passed, with no downstream skip:

- Agency authorization/isolation/security.
- Marketplace DB trust.
- Marketplace workflow integrity.
- Canonical commercial workflow.
- Marketplace inquiry adoption.
- Supply freshness integrity.
- Quote delivery integrity.
- Secure quote client delivery loop.
- Full marketplace-to-outcome E2E.
- Offer review lifecycle.
- Release migration upgrade.

Relevant contract regressions also cover:

- public trust claims remain evidence-backed;
- quoted-vs-realized economics semantics;
- PostgreSQL TLS cannot be weakened by URI SSL parameters.

### Neon Production V1 clone validation

Production project: `THE JOURNEY Production V1` / `icy-firefly-64909570`, PostgreSQL 18.

Safe validation branch cloned from the actual production parent:

- name: `ship-candidate-migration-20260912`
- branch id: `br-wild-meadow-b1erpo93`
- production parent: `br-round-band-b1s8gdka`

No production-parent writes were performed.

On the production clone:

- `contact_request_ownership` applied successfully.
- AI verification alignment requirement is satisfied.
- Phase 1 applied successfully.
- Phase 2 applied successfully.
- Phase 3 applied successfully.
- Phase 4 applied successfully.
- Phase 5 applied successfully.
- Equivalent validation of the required production schema returned zero missing required base tables/columns.
- Functional Postgres 18 commercial smoke succeeded:
  - one `quote_sent` event;
  - opportunity transitioned to `won`;
  - winning quote version bound;
  - quote transitioned to `accepted`;
  - active delivery transitioned to `revoked`.
- A prior smoke transaction with a future `observedAt` was correctly rejected and rolled back by Phase 3, confirming fail-closed freshness enforcement.

Conclusion: schema-v5 migration compatibility has been verified against a branch cloned from the live Production V1 state for the release invariants exercised.

### Security / privacy evidence

- Agency DB tests reject unauthenticated workspace access, cross-workspace access, membership privilege escalation and actor impersonation; domain events are append-only and reject sensitive event payload fields.
- Admin session tests prove browser admin session tokens are signed/expiring and do not contain the master key; admin media routes fail closed before storage operations.
- Public agent projection exposes trust state without raw license numbers or verification timestamps and fails closed for non-verified agents.
- KYC uploads use private object storage and time-limited signed URLs; server routes re-check stored object evidence before review state transitions.
- Global security headers include CSP, frame denial, content-type hardening, HSTS, referrer policy, permissions policy and COOP.
- PostgreSQL TLS now explicitly verifies remote certificates instead of using `rejectUnauthorized: false`.
- Runtime dependency audit is now a permanent CI release gate.

### SEO / public web evidence

- `robots.ts` allows public discovery but excludes account/admin/join/API surfaces from crawling and declares the sitemap.
- `sitemap.ts` includes home/offers/agents/destinations/trust plus dynamic published offers, verified agents and destinations, and falls back safely to static entries if dynamic loading fails.
- `/trust` exists and its claims now match implemented product/storage/review behavior.
- Private quote routes remain noindex/nofollow and use referrer suppression.

### Deployment evidence

Vercel project:

- `the-journey-version-1-0`
- project id `prj_WTa6Q1jnXOst1rKvR3dpEJh309iP`
- team `team_GASBeP4k1Whgjv8OkggLyUEH`
- Node 24.x
- observed plan: Hobby

Observed state:

- Existing older production deployment has previously returned `/api/health` HTTP 200 with healthy database and Backblaze B2.
- Canonical-branch preview deployments fail before any application build event with `BUILD_FAILED / Resource provisioning failed` and zero build logs.
- GitHub commit status for the branch identifies the root cause by linking to `upgradeToPro=build-rate-limit`.
- Therefore the current preview blocker is the Vercel Hobby build-rate limit, not evidence of a TypeScript/Next/DB build failure.
- GitHub production build succeeds on the patched candidate.
- `alrehlla.com` is associated with the Vercel project but does not currently resolve/reach `/api/health`; public search also returns no indexed result. DNS/custom-domain state is owner-controlled and unresolved.
- Because no current candidate preview can be provisioned, browser smoke against this exact candidate remains **UNVERIFIED**.

## FINAL REALITY AUDIT

### 1. Traveler

PASS at repository/E2E level. Public marketplace hides raw KYC/license identifiers, intake can become a canonical opportunity, secure quote delivery exposes only client-facing terms/prices, real view/response events exist, and client approval is not misrepresented as a completed booking.

Browser interaction on the exact candidate is **UNVERIFIED** only because Vercel preview provisioning is quota-blocked.

### 2. Travel Agent

PASS. The workspace supports inbox adoption, manual opportunities, intent history, supplier sourcing/evidence, quote versions/economics, secure delivery, follow-up recording, outcomes, activities and intelligence. It is an operating workflow rather than a decorative dashboard.

### 3. Agency Owner

PASS for launch scope. Membership isolation is enforced; commercial health reports adoption/quote/win/supply signals; currencies are not combined into a fake total; immutable quoted economics are no longer labeled as realized profit.

A full accounting/settlement/refund ledger is intentionally not part of launch scope.

### 4. Admin / Trust Operator

PASS. Admin data is not fetched before admin-session verification; KYC evidence is rechecked server-side at decision time; trust transitions are audited; public discovery fails closed for non-verified agents.

### 5. Attacker

PASS for known material launch surfaces. Tested boundaries include authentication, workspace IDOR/tenant isolation, membership escalation, admin sessions, sensitive event payloads, private media access, quote bearer-token storage, public projection minimization, security headers, TLS verification and high/critical runtime dependency audit.

No known P0/P1 security defect remains open in the repository candidate.

### 6. Search Engine

PASS baseline. Public routes have sitemap/metadata surfaces; private/admin/API routes are excluded; dynamic public entities are represented in sitemap; Trust route exists. Custom-domain crawlability is **UNVERIFIED** until DNS is fixed.

### 7. Mobile User

PASS at build/test level. Mobile typecheck, tests and iOS Metro bundle are green on the candidate dependency line. Real-device production-network smoke is **UNVERIFIED** until deployment is available.

### 8. Business Owner

PASS for the core commercial wedge. The system can transform an inquiry into a sourced, versioned, evidence-backed, margin-aware quote, communicate it securely, record real client engagement, follow it through confirmed outcome and retain evidence for intelligence. It does not pretend quoted profit is settled cash, client approval is payment, AI is authority, or stale supplier evidence is current truth.

## Failed checks

No repository/internal release check is currently failing on the last verified commit.

External/production checks still not passing:

1. Vercel candidate preview provisioning — blocked by Hobby build-rate limit.
2. `alrehlla.com` reachability/DNS — unresolved.
3. Production parent database does not yet have schema-v5 migrations applied.
4. Browser smoke and final production health on this candidate — cannot occur until deployment blockers are cleared.

## Skipped / UNVERIFIED checks and exact reason

- Production migration execution: intentionally not performed; production schema change is owner-gated after successful clone validation.
- Final merge/promotion: intentionally not performed; owner/deployment action.
- Browser smoke on current candidate: unavailable because Vercel refuses preview provisioning at the account build-rate limit.
- Custom-domain SSL/crawl verification: unavailable because DNS does not currently resolve correctly.
- Real-device production smoke: unavailable until the candidate is deployed.
- Validation-branch deletion: not performed; destructive cleanup requires explicit approval and the branch currently preserves release evidence.

## Decisions frozen for ship candidate

1. `codex/full-project-completion` remains canonical.
2. No duplicate Inquiry aggregate.
3. Intent and Quote history remain immutable/versioned.
4. Evidence provenance/freshness remains authoritative for dynamic supplier truth.
5. Prepared client link is not a sent quote.
6. Client approval is a response signal, not payment/booking/won state.
7. AI remains advisory/derived intelligence above evidence and human decision.
8. Won quote economics are quoted/expected economics, not realized settlement.
9. Realized accounting ledger, generic CRM reminders, learned cross-agency ML, social/community features and booking-engine scope are deferred; none is required to deliver the launch wedge.
10. No more feature work before deployment unless a new P0/P1 is proven by evidence.

## Remaining blockers

Only release/deployment blockers remain:

1. **Vercel build quota:** wait for the Hobby build-rate window to clear or owner chooses a paid plan/support path.
2. **Domain DNS:** configure/verify `alrehlla.com` with the DNS values Vercel recommends for this project, then verify SSL/reachability.
3. **Production database:** apply the already-tested schema-v5 existing-database migration chain to production parent `br-round-band-b1s8gdka` after explicit owner approval.
4. **Promotion:** merge/promote this CI-green candidate only after the above are cleared, then run browser smoke + `/api/health` + key commercial-path smoke.

## Pending implementation actions

None. Scope is frozen at SHIP CANDIDATE.

Only release operations remain unless a deployment/reality check exposes a new material defect.

## Owner-only actions

1. Decide Vercel quota path: wait for reset or upgrade/escalate the account.
2. Fix/confirm registrar DNS for `alrehlla.com` according to the Vercel project’s domain-inspection recommendation.
3. Approve application of schema-v5 existing-database migrations to production parent `br-round-band-b1s8gdka`.
4. Approve final merge/promotion after preview/browser smoke is available.
5. Approve deletion of Neon validation branch `br-wild-meadow-b1erpo93` after release evidence is no longer needed.

## Exact next action

Clear the Vercel build-rate/DNS blockers, deploy this SHIP CANDIDATE to a preview, execute the final browser smoke, then apply the already-validated production migration and promote the same CI-green commit. If browser/production smoke exposes no material defect, release THE JOURNEY; do not resume feature development before that decision.
