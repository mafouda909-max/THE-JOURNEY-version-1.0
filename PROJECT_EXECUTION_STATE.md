# THE JOURNEY — PROJECT EXECUTION STATE

Last update: 2026-09-13 (Africa/Cairo)

Release status: **RELEASE CANDIDATE / SHIP CANDIDATE** — repository/internal verification is green. This is **not LAUNCHED** and is not yet runtime-verified on the exact candidate because Vercel preview provisioning is still blocked before application build.

Canonical branch: `codex/full-project-completion`

`main` has not been modified or merged in this verification round. No Production deploy/promotion or Production database migration was performed.

## Current HEAD rule

The commit containing this checkpoint is the branch HEAD at checkpoint time. Do not hard-code that self-referential SHA here.

Last application/test commit before this checkpoint:

`5c6a158a221db8fc336faee532a7e3f860d7d087` — `a11y: name join form controls explicitly`

Last full verified application/test evidence:

GitHub Actions run `34743840218` / CI #300 — **success**.

## Resume / working-tree reality

The active execution runtime did not contain a persistent local Git checkout from the previous run, so a truthful local `git status` / uncommitted-file inspection was not possible. No local state was guessed or discarded. The canonical GitHub branch and PR were used as source of truth, and every branch mutation in this round was a fast-forward commit on `codex/full-project-completion` only.

PR #13 remains open, non-draft and mergeable into `main`; it has no inline review threads.

## Changes made in this verification round

### 1. Cross-platform mobile contract test stability

Commit `1cdfe89f52d28e963c690f7bd7f1274460ee1bf8` — `test: normalize mobile contract line endings`

Only `tests/mobile-contract.test.ts` changed.

- source fixtures are normalized from CRLF / CR to LF before text comparisons;
- an explicit regression proves Windows/classic-Mac line endings normalize correctly;
- no application behavior changed.

Verification: CI #298 (`34743377514`) — **success**.

### 2. Offers/search origin-filter correctness

Commit `dcde0c4f99f01ee1338e5436ae7f77cf4a59955c` — `fix: make origin filter clearable in offers search`

Changed:

- `src/components/market/OffersBrowser.tsx`
- `tests/offers-browser-contract.test.ts`

Real defect fixed:

- `initial.from` had been permanently pinned for the component lifetime;
- global clear/reset did not remove the origin city;
- the no-results “عرض كل العروض” action therefore could remain filtered by origin;
- origin was absent from the active-filter count and had no direct removable control.

Current behavior:

- origin city is stateful and removable;
- it is shown as an active filter chip;
- it participates in active-filter count and search telemetry;
- global “مسح” clears origin, destination/query, type, traveler count, fast-response filter and sort;
- no-results “عرض كل العروض” uses the same reset path;
- search after clearing is no longer pinned to the initial origin.

Verification: CI #299 (`34743579046`) — **success** across all six jobs, including root contracts, production build, mobile and database/E2E suites.

### 3. Auth-screen accessibility

Commit `5c6a158a221db8fc336faee532a7e3f860d7d087` — `a11y: name join form controls explicitly`

Changed:

- `src/app/join/page.tsx`
- `tests/join-accessibility.test.ts`

Behavior remains the same; accessibility was hardened:

- explicit accessible names for signup/login controls;
- correct email/password autocomplete hints;
- mode selector exposes `aria-pressed`;
- decorative submit icons are hidden from assistive technology.

Verification: CI #300 (`34743840218`) — **success**.

## Final full verification — CI #300

The current application/test tree passed the complete CI matrix:

- Typecheck & lint — **success**.
- Unit & contract tests — **success**.
- Runtime dependency audit, web + mobile — **success**.
- Production build — **success**.
- Mobile app typecheck/tests/iOS Metro bundle — **success**.
- Database security / release suites — **success**.

Database verification includes:

- agency authorization and tenant isolation;
- marketplace DB trust and workflow integrity;
- canonical commercial workflow;
- marketplace inquiry adoption;
- supplier freshness/provenance integrity;
- quote delivery integrity;
- secure quote client delivery loop;
- full marketplace-to-outcome E2E;
- offer review lifecycle;
- release migration upgrade.

No repository/internal test is currently known to be failing.

## Final product review

### Security / authorization / data ownership

PASS for known launch-critical tested surfaces.

Evidence includes:

- session-based account identity and role checks;
- active workspace membership derived from authenticated account;
- cross-workspace access fails closed;
- owner-only agency actions are role-gated;
- public agent projection hides internal verification/license evidence;
- private KYC/document access uses private storage and signed access;
- quote-delivery bearer tokens are persisted as digests, not plaintext;
- public quote projection excludes supplier cost/commission/margin and private traveler identity;
- PostgreSQL remote connections use certificate/hostname verification and strip URI SSL controls that could override it;
- high/critical runtime dependency audit is a permanent CI gate;
- global CSP, frame denial, HSTS, nosniff, referrer policy, permissions policy and COOP are configured.

Residual defense-in-depth limitations, not proven release blockers:

- login/public throttling is process-local best-effort in a serverless environment, not a distributed hard cap;
- web session tokens are stored in the sessions table rather than digest-only storage. This is not treated as an open P0/P1 from current evidence, but is a future hardening opportunity.

### Validation / error handling

PASS for verified paths.

- auth validates email/password/name/role and handles duplicate signup races;
- offer creation validates role, verified-agent status, text bounds, trip type, currency, price basis, travelers, route and commercial detail;
- quote delivery validates token/state/version/public projection and one-response semantics;
- mobile contact validation is contract-mirrored against the server;
- public discovery hides expired/non-published/unverified supply;
- key UI flows have explicit error/loading/empty states.

### Offers/search

PASS at source-contract + CI level after the origin-reset fix.

Covered scenarios:

- offers search;
- empty search results;
- removing origin-city filter;
- clear filters;
- search/results after clearing origin;
- traveler count/type/fast-response/sort behavior remains in the same component contract.

Interactive browser verification on the exact candidate remains UNVERIFIED because no candidate preview can currently be provisioned.

### Mobile

PASS at code/test/bundle level.

- API contract is cross-checked against the web routes;
- CRLF/LF fixture behavior is now stable;
- typecheck/tests/iOS Metro export pass;
- offers screen has loading/error/offline/stale/empty/filter states;
- the mobile client intentionally has no authenticated session surface and only uses public marketplace/contact endpoints.

Production/mobile device limitations:

- `mobile/app.json` intentionally leaves `expo.extra.apiBaseUrl` empty;
- a release must provide `EXPO_PUBLIC_API_BASE_URL` or release-profile `apiBaseUrl`;
- real-device visual, gesture, image, Arabic-locale RTL and production-network smoke remain UNVERIFIED.

### Accessibility / RTL / Arabic presentation

PASS baseline with one issue fixed in this round.

- root document is `lang="ar" dir="rtl"`;
- skip-to-content link exists;
- navigation has keyboard focus handling, mobile-dialog focus trap and Escape behavior;
- offers search has explicit labels/live result count and focus-visible states;
- join form now has explicit accessible names and selector state;
- primary forms use Arabic-first copy and visible error/status states.

A full assistive-technology/manual device audit is still outside automated evidence.

### Branding / public identity

Code-level branding is consistent around `الرحلة · THE JOURNEY`, with one owner-controlled identity decision remaining:

- `alrehlla.com` is not treated as an owned canonical domain; the safe fallback is the Vercel project alias;
- the repository still publishes `hello@alrihla.travel`; available tooling does not prove owner control of that domain;
- owner must confirm the intended public domain/contact domain before launch.

### SEO

PASS baseline at repository/build level.

- centralized site origin drives metadata/JSON-LD/robots/sitemap/social image hostname;
- public sitemap includes static and dynamic marketplace entities with static fallback on DB failure;
- account/review/join/API surfaces are excluded from crawling;
- private quote routes are noindex/nofollow;
- Open Graph/Twitter metadata exists;
- unowned `alrehlla.com` is rejected by regression coverage.

Custom-domain SSL/crawlability remains UNVERIFIED until an owned domain is configured.

### Performance

No launch-blocking regression identified from code/build evidence.

- production build passes;
- offer imagery uses Next Image with responsive sizes;
- mobile GETs have bounded cache/freshness behavior;
- DB pool is bounded for serverless use.

Known scaling consideration: the web offers browser currently receives the published offer set then filters client-side. This is acceptable for current launch scope but should become server-side pagination/search if marketplace volume grows materially.

### Routes / links

No broken primary navigation route was found in the reviewed public chrome/trust/search surfaces:

- `/`, `/offers`, `/agents`, `/destinations`, `/join`, `/account`, `/trust` and referenced trust anchors exist in the application tree;
- PR #13 has no inline review threads.

Exact browser/link traversal of the current candidate remains blocked with the preview.

## Runtime / deployment evidence

### Exact candidate

Latest checked exact-candidate deployment for `5c6a158…`:

- deployment: `dpl_2HSVNT71FtatUHem9taAfzx8hQG2`
- state: `ERROR`
- error: `BUILD_FAILED / Resource provisioning failed`
- build log events: **none**.

Vercel PR bot evidence identifies the project-level cause as:

`Resource is limited - try again in 24 hours (more than 100, code: "api-deployments-free-per-day")`.

Therefore exact-candidate preview/browser smoke is blocked by Vercel Hobby deployment quota before application build. GitHub production build is green; this Vercel state is not evidence of an application build failure.

### Existing older production

`https://the-journey-version-1-0.vercel.app/api/health` was checked on 2026-09-13 and returned HTTP 200 with:

- database: HEALTHY;
- Backblaze B2: HEALTHY.

This older production deployment is **not** the current candidate.

Seven-day runtime errors on the older deployed family show historical DB connection-timeout query errors ending on 2026-09-08. The only group still appearing on 2026-09-13 is the old pg/connection-string SSL-mode warning; the current candidate already contains the TLS/URI hardening intended to remove that warning, but runtime disappearance cannot be verified until the candidate actually deploys.

## Neon release evidence

Production project: `THE JOURNEY Production V1` / `icy-firefly-64909570`, PostgreSQL 18.

Production parent: `br-round-band-b1s8gdka`.

Validation branch: `br-wild-meadow-b1erpo93` (`ship-candidate-migration-20260912`).

The ordered existing-database schema-v5 migration chain has already been applied and smoke-tested successfully on the Production clone. No production-parent migration was performed in this round.

Production migration remains explicitly owner-gated.

## Final reality status

- Traveler — PASS repository/E2E; exact browser smoke UNVERIFIED.
- Travel Agent — PASS launch workflow and authorization tests.
- Agency Owner — PASS launch commercial scope and tenant isolation.
- Admin/Trust — PASS tested review/security boundaries.
- Attacker — PASS known material tested surfaces; no known P0/P1 repository security defect remains open.
- Search Engine — PASS baseline; owned-domain crawlability UNVERIFIED.
- Mobile — PASS typecheck/tests/bundle; real-device production-network smoke UNVERIFIED.
- Business Owner — PASS core inquiry → sourced/versioned quote → secure engagement → outcome workflow.

## Remaining blockers / human approvals

1. **Vercel preview quota:** current candidate cannot receive real browser smoke until `api-deployments-free-per-day` clears or account plan/support changes.
2. **Public domain ownership:** confirm the intended website domain and control of `alrihla.travel` used for public contact email; then configure/verify DNS/SSL and `NEXT_PUBLIC_SITE_URL` as appropriate.
3. **Mobile release origin/device check:** if native mobile is part of this launch, inject the real API origin and run real-device production-network + RTL/visual smoke.
4. **Production schema-v5 migration:** requires explicit owner approval before touching production parent `br-round-band-b1s8gdka`.
5. **Merge/promotion:** intentionally not performed. `main` remains untouched.

## SHIPPABLE verdict

**Yes as a repository-internally verified RELEASE CANDIDATE. No as a fully production-verified/LAUNCHED release yet.**

The code, security contracts, migrations-on-clone, production build, mobile build and regression suites are green. The remaining gaps are release-environment evidence, not known application defects: exact-candidate Vercel preview/browser smoke, owned-domain confirmation, optional native-device production smoke, and the explicitly owner-gated Production migration/promotion.

## Exact next action

Do not add feature development. Wait for Vercel preview quota to clear, deploy this same CI-green candidate to Preview, run browser smoke covering Traveler search/empty/reset/origin-clear, auth, agent/account, offer/quote secure delivery, `/api/health`, metadata/robots/sitemap/Open Graph and console/runtime errors. If Preview passes, stop and request explicit owner approval for Production schema-v5 migration. Only after that approval: migrate Production, run Production smoke, then merge/promote if all evidence remains green.
