# THE JOURNEY — PROJECT EXECUTION STATE

Last updated: 2026-09-11T21:00:13Z
Update state: ACTIVE — Phase 4 commercial integrity implemented and CI-passing; live release diagnosis in progress

## Canonical branch

`codex/full-project-completion`

## Current HEAD

`3c2f7e267d3bba3117fd741ebf2bfbdfdcbf84e3` — `ci: enforce quote delivery integrity regressions`

## Completed work already present

- Agency workspace and membership foundation.
- Agency client and opportunity domain.
- Versioned traveler intent snapshots.
- Supplier option provenance/freshness model.
- Quote aggregate plus immutable/versioned quote snapshots.
- Quote economics fields and deterministic economics calculation.
- Commercial activity lifecycle (`quote_sent`, `quote_viewed`, `follow_up`, `client_response`, `outcome_won`, `outcome_lost`).
- Deterministic commercial intelligence signals.
- Marketplace projection boundary.
- Agency workspace, inquiry/opportunity and commercial API/UI surfaces.
- Phase 4 quote-delivery/outcome-integrity migration and targeted DB regression coverage.
- Release manifest upgraded to schema version 4 and release-migration test upgraded accordingly.
- CI database job explicitly runs the Phase 4 quote-delivery-integrity regression.
- Existing production/readiness/handoff reports are retained as historical evidence only; stale baseline claims are not treated as current release evidence.

## Verified evidence in this resumed cycle

### Git / branch

- Resume baseline was `0cbb20593147dff643e8170a3c9f85194c7a05bd` on `codex/full-project-completion`.
- At resume, `codex/full-project-completion` was 166 commits ahead of `main` and 0 behind; merge base/current `main` was `2265ebc4ddc2216b101e4d6b106e2eac45053e12`.
- The branch already contained the canonical agency commercial stack; the earlier claim that Agency/Intent/Quote foundations were missing was stale.

### Canonical domain / architecture

- `contact_requests` is marketplace intake; adoption creates a canonical `agency_opportunity` and immutable traveler intent v1.
- Manual/referral/repeat/partner work can create an opportunity directly without fabricating a marketplace inquiry.
- DB append-only triggers already enforce immutability of `agency_intent_versions`, `agency_quote_versions`, and `agency_commercial_activities`.
- Phase 3 DB triggers already enforce volatile supplier provenance/freshness and prevent quote validity from outliving supplier evidence.
- The material lifecycle gap found in this cycle was quote-version selection semantics: previously an older created version could be sent, an unsent version could be selected as won, and an older sent version could win after a newer version of the same quote had been sent.

### Phase 4 implementation

- Added `db/phase4_quote_delivery_integrity.sql`.
- Sending is now constrained to the newest created version of a quote.
- A won opportunity must bind a quote version that was actually sent.
- A newer sent version of the same quote supersedes an older sent version for winning-outcome purposes.
- Won/lost/cancelled opportunity outcomes settle sibling quote statuses consistently.
- Added `tests/quote-delivery-integrity-db.test.ts` covering stale-send, unsent-win, superseded-sent-win and sibling-quote settlement cases.
- `db/release_manifest.json` is schema version 4 and includes Phase 4 after Phase 3.
- `tests/release-migrations-db.test.ts` checks Phase 4 ordering/idempotence and the four new integrity triggers.

### Current CI evidence

GitHub Actions run `34647007977` / CI run #247 on HEAD `3c2f7e267d3bba3117fd741ebf2bfbdfdcbf84e3` completed successfully across all jobs:

- Typecheck & lint — success.
- Unit & contract tests — success.
- Production build — success.
- Mobile app: typecheck, tests and iOS Metro bundle — success.
- Database security suite — success, including agency security, marketplace trust/workflow, canonical commercial workflow, inquiry adoption, supply freshness, **quote delivery integrity**, full marketplace-to-outcome E2E, offer-review lifecycle and release-migration upgrade tests.

### Live Vercel evidence

- Connected Vercel project: `the-journey-version-1-0` (`prj_WTa6Q1jnXOst1rKvR3dpEJh309iP`).
- Project is linked to GitHub repo `mafouda909-max/THE-JOURNEY-version-1.0`.
- Vercel project API currently reports `live: false` for the project metadata and the recent preview deployment stream for `codex/full-project-completion` is failing before build execution.
- Deployment `dpl_BTfFFpohtpaMN18sgLaWh714V65K` for checkpoint commit `2db244f...` failed with `BUILD_FAILED` / `Resource provisioning failed` in under one second and produced zero build-log events.
- Many preceding preview deployments on the same branch show the same `ERROR` state, so this is not evidence of a code compilation failure.
- Current GitHub CI production build succeeds on the newer HEAD, reinforcing that distinction.
- The existing production alias `https://the-journey-version-1-0.vercel.app/api/health` returned HTTP 200 with `HEALTHY` database and Backblaze B2 storage at `2026-09-11T21:00:13.616Z`.
- `https://alrehlla.com/api/health` did not fetch successfully through the connected Vercel fetch path; custom-domain/DNS state still needs diagnosis.
- A current Vercel Community report describes the same preview-only `Resource provisioning failed` + zero-build-log symptom, suggesting a Vercel preview resource/integration-layer failure is plausible; this is supporting context, not proof of the cause for THE JOURNEY.

### Live Neon evidence

- Approved-looking production project exists as `THE JOURNEY Production V1` (`icy-firefly-64909570`) and was active during the live health probe.
- Read-only schema inspection of the default `neondb` shows **none of Phase 1–4 is installed**:
  - no `agency_workspaces`,
  - no `agency_quote_versions`,
  - no Phase 3 freshness trigger,
  - no Phase 4 quote-delivery trigger.
- `contact_requests.traveler_account_id` is also absent.
- Existing production does have `agent_ai_verification_runs`, `offers.title_en`, and `offers.expires_at`, confirming it is not an empty database but an older partially-aligned production schema.
- Therefore the new branch must not be promoted against the current production database until the ordered existing-database migration chain is tested against a production clone/branch and explicitly approved for application.

## Decisions already made

1. Keep `codex/full-project-completion` as the canonical working branch unless stronger evidence justifies a branch strategy change.
2. Do not return to `main`; it is materially behind the current product branch.
3. Do not create a duplicate `agency_inquiries` aggregate now. Treat `contact_requests` as channel-specific intake and `agency_opportunities` as the canonical commercial work aggregate. Revisit only if real multi-channel intake/SLA/deduplication requirements prove a distinct inquiry lifecycle is needed.
4. Keep Traveler Intent and Quote snapshots versioned and immutable; do not mutate historical commercial truth.
5. Distinguish **latest created version** from **latest communicated version**:
   - only the latest created quote version may be sent;
   - a previously sent version can remain the client decision surface while a newer version is only a draft;
   - once a newer version of that same quote is sent, the older sent version can no longer be the winning version.
6. Keep DB constraints/triggers as the final integrity boundary even when service-level UX guards are later added.
7. Preserve historical audits/tests as completed evidence; rerun only when changed invariants/current-HEAD risk require it.
8. Treat the September 4 Railway-oriented release report as historical; the live environment is currently demonstrably Vercel + Neon + Backblaze B2.
9. Do not apply production migrations or promote the new branch to production without explicit owner approval after production-clone migration evidence.

## Decisions rejected and why

- Rejected: reset/rebase work back to `main` by default. Reason: live comparison shows the canonical branch materially ahead with no missing main commits at resume.
- Rejected: rebuild Agency/Intent/Quote foundations from scratch. Reason: those domains already exist materially in schema, service, API, UI and tests.
- Rejected: add `agency_inquiries` merely to match the earlier thesis. Reason: it would currently duplicate intake/opportunity state without a proven lifecycle need.
- Rejected: treat snapshot tables as immutable merely by convention. Reason: DB append-only enforcement is required and already exists.
- Rejected: allow any historical quote version to be sent/accepted as long as it belongs to the quote. Reason: that permits stale or never-communicated commercial truth.
- Rejected: diagnose Vercel preview failures as application build failures. Reason: failures occur before build-log creation while GitHub CI production build succeeds.
- Rejected: deploy branch code against the current Production V1 schema. Reason: production is missing the required ordered migrations including the agency foundation.
- Rejected: declare completion/readiness from historical release reports. Reason: they do not describe the current branch, schema or hosting reality.

## Unresolved issues

### P0 / release

- Diagnose/fix Vercel preview `Resource provisioning failed` so the branch can receive a real preview deployment and browser smoke test.
- Diagnose `alrehlla.com` custom-domain reachability/configuration.
- Test the full ordered existing-database migration chain against a Neon branch cloned from current Production V1 (Postgres 18), including preservation of current production rows and current runtime health.
- Production migration application and branch promotion remain owner-gated after that evidence.
- Draft PR #13 title/body are stale and under-describe the 170+ commit branch; release review surface must be corrected before merge consideration.

### P1 / product correctness

- Add service-level preflight UX for stale quote send / unsent or superseded winning versions so users receive specific conflict guidance while DB triggers remain authoritative.
- Decide and model realized economics separately from quoted/expected economics: supplier settlement, actual commission received, refunds/cancellations, taxes/fees and FX effects.
- Review whether `quote_viewed` and `client_response` are wired to real product events or only represented in schema.
- Audit follow-up scheduling/reminders versus merely recording follow-up activity.

### P1 / intelligence

- Current intelligence is deterministic and outcome-aware but not yet a closed learning loop.
- Need outcome taxonomy beyond free-text lost reason if we want aggregate learning.
- Need privacy-safe feature/event design before any model training or cross-agency benchmark layer.
- Need measurement plan proving recommendations improve conversion/margin/response time rather than merely generating signals.

### P2 / commercial moat / UX / brand

- Validate commercial wedge with real agent workflow: inquiry adoption → sourcing → quote → follow-up → outcome, measuring time-to-first-quote and quote-to-win.
- Review quote client-facing experience and approval semantics once preview deployment works.
- Revisit brand/logo/UI differentiation after core commercial loop has trustworthy live usage evidence, not as cosmetic churn.

## Codex-ready execution queue

1. Add service-level explicit `409` conflict guards/messages for stale quote send, unsent winning version and superseded sent winning version; retain Phase 4 DB triggers as defense in depth; update targeted tests accordingly.
2. Audit actual producers/consumers of `quote_viewed` and `client_response`; implement missing real event paths or remove misleading surface area.
3. Add structured outcome-reason taxonomy plus optional free-text detail, preserving backward compatibility and PII minimization.
4. Design realized-economics ledger/snapshot boundary separately from immutable quoted economics; do not overload `agency_quote_versions` with post-sale mutable facts.
5. Add targeted tests for realized economics and cancellation/refund invariants once the model is accepted.
6. Investigate Vercel preview resource provisioning configuration/integration state; do not change application code unless evidence points to code.
7. Prepare and test the complete release migration chain on a Neon clone/temporary branch based on `THE JOURNEY Production V1` Postgres 18; do not apply to the parent production branch without owner approval.
8. Refresh PR #13 release description/title to represent the actual branch scope and current blockers.
9. After preview works, run browser smoke tests for traveler marketplace, inquiry adoption, agency pipeline/opportunity workspace and quote/outcome flow.

## Owner-only blockers

- Applying the existing-database migration chain to `THE JOURNEY Production V1`.
- Promoting/merging the new branch into the production deployment path.
- Any paid-plan change or Vercel support/account action if the preview provisioning failure proves account/platform-side and requires billing/support intervention.

## Exact next action

Diagnose the Vercel preview provisioning failure and production custom-domain state while preparing a production-clone migration validation plan; then continue into explicit service conflict UX and the realized-economics design without changing production.
