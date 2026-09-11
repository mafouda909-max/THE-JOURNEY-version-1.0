# THE JOURNEY — PROJECT EXECUTION STATE

Last update: 2026-09-12 (Africa/Cairo)

Release status: **SHIP CANDIDATE** — repository/internal release gates are green. Production promotion is still blocked by explicit owner/platform actions.

Deployment status: **UNVERIFIED for this candidate in a real Vercel preview/browser.** The older production deployment is healthy, but it is not this candidate and still serves older product copy/schema.

## Canonical branch

`codex/full-project-completion`

## Current HEAD rule

The commit containing this checkpoint is the canonical branch HEAD at checkpoint time. Do not hard-code that self-referential SHA here.

Last code-and-test commit before this checkpoint documentation:

`1345c44baedebb602cdab05804e5f0f144f673b0` — `seo: derive social card host from owned site origin`

## Last verified code commit

`1345c44baedebb602cdab05804e5f0f144f673b0`

Evidence: GitHub Actions run `34654111687` / CI #296 completed successfully on that commit.

The release matrix remains green for:

- Typecheck & lint.
- Unit & contract tests.
- Runtime dependency audit for web + mobile.
- Production build.
- Mobile typecheck/tests/iOS Metro bundle.
- Database security / release migration suites.

Database coverage includes agency isolation, marketplace trust/workflow, canonical commercial workflow, inquiry adoption, supplier freshness, Phase 4 quote-delivery integrity, Phase 5 secure quote client delivery, marketplace→outcome E2E, offer review lifecycle and release migration upgrade.

## Canonical product direction

The retained commercial thesis is:

**Marketplace intake → Opportunity → immutable Traveler Intent versions → supplier evidence/freshness → immutable Quote versions → quoted economics → secure client delivery → real view/response telemetry → follow-up → confirmed outcome → intelligence.**

Decisions retained:

1. `contact_requests` remains marketplace-channel intake; `agency_opportunities` is the canonical commercial work aggregate.
2. No duplicate Inquiry aggregate until real multichannel routing/SLA/dedupe behavior proves it deserves an independent lifecycle.
3. Traveler Intent and Quote history remain immutable/versioned.
4. Supplier provenance, observation time and validity remain authoritative for dynamic supply truth.
5. Preparing/copying a client quote link does **not** create `quote_sent`; activation after confirmed sharing does.
6. Client approval is a response signal, not payment, booking confirmation or `won` outcome.
7. Quoted gross profit is quoted/expected economics; it is not realized settlement.
8. AI stays advisory/derived above evidence and human decisions.
9. Realized accounting ledger, generic CRM reminders, learned cross-agency ML, social/community features and booking-engine scope remain deferred from launch.

## Completed material implementation

- Agency workspaces, memberships, clients and tenant isolation.
- Canonical opportunities and marketplace inquiry adoption.
- Immutable Traveler Intent versions.
- Supplier provenance/freshness integrity.
- Immutable Quote versions and deterministic quoted economics.
- Commercial activities and append-only audit/domain events.
- Phase 4 send/outcome integrity:
  - only newest quote version may be sent;
  - winning version must actually have been sent;
  - newer sent revision supersedes older sent revision;
  - terminal outcomes settle quote states consistently.
- Phase 5 secure client quote delivery:
  - bearer token generated randomly;
  - only SHA-256 digest persisted;
  - prepared ≠ active/sent;
  - public projection excludes supplier cost, commission, margin, private traveler identity and supplier source references;
  - first real client view records one `quote_viewed` activity;
  - client decision records `client_response` without fabricating booking/payment/won state;
  - terminal quote/outcome transitions revoke active/prepared links safely.
- Commercial metrics corrected so won quoted economics are not called realized profit.
- PostgreSQL TLS certificate/hostname verification hardened.
- Next.js / React security line upgraded to patched stable releases.
- Permanent CI gate for high/critical runtime dependency vulnerabilities.
- Trust/public copy corrected to remove unsupported SLA, review-feature and storage-encryption claims.
- Private quote routes remain noindex/nofollow with referrer suppression.

## Domain / public-origin finding

A final release audit found that `alrehlla.com` is currently reported by Vercel as **available for registration**. It therefore must not be treated as an owned production domain.

The candidate now fails safe:

- default public origin is `https://the-journey-version-1-0.vercel.app`;
- `NEXT_PUBLIC_SITE_URL` is the explicit override for an owned, DNS-verified custom domain;
- metadata, JSON-LD, robots/sitemap URL generation and public absolute URLs use centralized `SITE_ORIGIN`/`SITE_URL`;
- Open Graph social image derives the displayed hostname from `SITE_ORIGIN` instead of hard-coding `alrehlla.com`;
- `tests/site-url-safety.test.ts` verifies the safe fallback and scans application source to reject reintroduction of `alrehlla.com`.

The repository still uses `hello@alrihla.travel` as a public contact email. Current evidence only proves that domain is not available for purchase; it does **not** prove account ownership from the available connectors. Owner should confirm that this email domain is controlled before production launch.

## Vercel evidence

Project:

- name: `the-journey-version-1-0`
- project id: `prj_WTa6Q1jnXOst1rKvR3dpEJh309iP`
- team id: `team_GASBeP4k1Whgjv8OkggLyUEH`
- Node: 24.x

Observed preview behavior on current candidate family:

- deployment fails before any application build logs are emitted;
- Vercel reports `BUILD_FAILED / Resource provisioning failed`;
- PR bot comment gives the precise platform error: `Resource is limited - try again in 24 hours (more than 100, code: "api-deployments-free-per-day")`;
- latest affected preview for code commit `1345c44…`: `dpl_4Q2Xni2xMfDXknGbsiFxDoZ82XJ8`;
- build log stream for that deployment is empty.

Conclusion: current preview blocker is the Vercel Hobby deployment quota, not evidence of an application build failure.

A condition-watch automation is scheduled to begin checking the Vercel quota on 2026-09-12 at 19:20 Africa/Cairo and notify only when the build-rate limit is no longer blocking deployment.

## Existing production evidence

The older Vercel production alias currently responds successfully at `/api/health` with HTTP 200 and healthy database + Backblaze B2.

This does **not** verify the ship candidate. The older deployed homepage still contains legacy copy such as 48-hour verification claims that the candidate has removed.

## Neon production-clone validation

Production project: `THE JOURNEY Production V1` / `icy-firefly-64909570`, PostgreSQL 18.

Validation branch cloned from the actual production parent:

- validation branch: `ship-candidate-migration-20260912`
- branch id: `br-wild-meadow-b1erpo93`
- production parent: `br-round-band-b1s8gdka`

No production-parent writes were performed.

The ordered existing-database migration chain through schema v5 applied successfully to the clone. Functional smoke proved:

- valid `quote_sent` activity accepted;
- opportunity can reach confirmed `won`;
- winning quote becomes `accepted`;
- active client delivery becomes `revoked`;
- future/stale provenance fails closed and rolls back.

Release manifest remains authoritative:

1. `db/production_alignment.sql`
2. `db/contact_request_ownership.sql`
3. `db/agent_ai_verification_runs.sql`
4. `db/ai_verification_alignment.sql`
5. `db/phase1_agency_foundation.sql`
6. `db/phase2_agency_commercial_domain.sql`
7. `db/phase3_supply_freshness_integrity.sql`
8. `db/phase4_quote_delivery_integrity.sql`
9. `db/phase5_quote_delivery_loop.sql`

Production execution requires explicit Owner approval and a tested direct/unpooled connection.

## Final reality audit status

- Traveler — PASS at repository/E2E level; exact candidate browser smoke still UNVERIFIED.
- Travel Agent — PASS for launch workflow.
- Agency Owner — PASS for launch commercial scope; realized accounting ledger intentionally deferred.
- Admin/Trust Operator — PASS for verified review/security boundaries.
- Attacker — PASS for known material tested surfaces; no known P0/P1 repository security defect remains open.
- Search Engine — PASS baseline; custom-domain crawlability remains UNVERIFIED until an owned domain is configured.
- Mobile User — PASS at typecheck/test/iOS bundle level; production-network/device smoke remains UNVERIFIED.
- Business Owner — PASS for the core inquiry→quote→engagement→outcome wedge.

PR #13 has no inline review threads. Its visible comments are Vercel bot deployment/quota messages.

## Failed / UNVERIFIED checks

No repository/internal release check is failing on the last verified code commit.

Still UNVERIFIED / blocked:

1. Current-candidate Vercel preview provisioning — Hobby deployment quota.
2. Browser smoke on the exact candidate — no preview target available yet.
3. Owned custom-domain SSL/crawl/health — no owned custom domain has been confirmed through available evidence.
4. Production schema-v5 application — intentionally not executed without owner approval.
5. Final production promotion/health/commercial smoke — intentionally not executed before the above gates.
6. Real-device production-network smoke — candidate not deployed.
7. Validation-branch deletion — destructive cleanup deferred until owner approves and release evidence is no longer needed.

## Remaining blockers

Only release operations remain unless a new material defect is proven:

1. **Vercel quota:** wait until `api-deployments-free-per-day` clears or owner chooses a paid/support path.
2. **Domain ownership:** owner confirms the intended public domain and the `alrihla.travel` email domain. If using a custom website domain, register/control it, attach it to Vercel, verify DNS/SSL, then set `NEXT_PUBLIC_SITE_URL`.
3. **Production migration:** owner explicitly approves applying schema-v5 existing-database migrations to production parent `br-round-band-b1s8gdka`.
4. **Promotion:** deploy the same CI-green candidate, run browser + `/api/health` + key commercial-path smoke, then merge/promote only if those checks pass.

## Pending implementation actions

None known. Feature scope is frozen at SHIP CANDIDATE.

## Exact next action

Wait for the Vercel quota watch to report that deployment is available. Then deploy the same candidate without adding feature work, run browser smoke on Traveler + Agent + secure quote-delivery paths, verify public metadata/social image/robots/sitemap against the actual deployment origin, and only then request/execute owner-approved production schema-v5 migration and final promotion.
