# THE JOURNEY — PROJECT EXECUTION STATE

Last updated: 2026-09-11T23:51:00+03:00
Update state: ACTIVE — observe/decision cycle resumed from live repository evidence

## Canonical branch

`codex/full-project-completion`

## Current HEAD

`0cbb20593147dff643e8170a3c9f85194c7a05bd` — `Stabilize mobile nav focus restoration`

## Completed work already present

- Agency workspace and membership foundation.
- Agency client and opportunity domain.
- Versioned traveler intent snapshots.
- Supplier option provenance/freshness model.
- Quote aggregate plus versioned quote snapshots.
- Quote economics fields and deterministic economics calculation.
- Commercial activity lifecycle (`quote_sent`, `quote_viewed`, `follow_up`, `client_response`, `outcome_won`, `outcome_lost`).
- Deterministic commercial intelligence signals.
- Marketplace projection boundary.
- Agency workspace, inquiry/opportunity and commercial API/UI surfaces.
- Commercial, marketplace, migration, security and workflow test files are present on this branch.
- Existing production/readiness/handoff reports are retained as historical evidence; they are not treated as proof of the current HEAD unless corroborated by current Git/CI/runtime evidence.

## Verified evidence in this resumed cycle

- Live GitHub branch ref resolves to `0cbb20593147dff643e8170a3c9f85194c7a05bd`.
- `codex/full-project-completion` is 166 commits ahead of `main` and 0 behind; merge base is current `main` HEAD `2265ebc4ddc2216b101e4d6b106e2eac45053e12`.
- The branch contains `src/db/agency-schema.ts`, `src/lib/commercial-domain.ts`, `src/lib/commercial-service.ts`, phase 1/2/3 agency migrations, agency APIs/UI, and dedicated commercial DB/workflow tests.
- `PROJECT_EXECUTION_STATE.md` did not exist before this checkpoint.

## Unresolved issues

- The Inquiry/Quote thesis must be challenged against the implemented domain before any new parallel model is added.
- Need to determine whether `contact_requests` → agency opportunity adoption is the correct canonical inquiry boundary or whether an explicit inquiry aggregate is still required.
- Need to verify whether quote-version immutability is enforced behaviorally/database-side, not merely represented by append-only intent.
- Need to verify lifecycle invariants across sent/viewed/follow-up/outcome transitions and quote/opportunity status synchronization.
- Need to evaluate economics correctness for commissions, refunds/cancellations, FX/multi-currency sourcing, taxes/fees, and realized vs expected margin.
- Need to inspect intelligence loop persistence and whether recommendations learn from outcomes without leaking traveler PII.
- Need to verify release migration ordering and production compatibility from current HEAD evidence without rerunning already-proven audits unnecessarily.
- Need current CI/runtime evidence for this HEAD before any production-readiness claim.

## Decisions already made

1. Keep `codex/full-project-completion` as the canonical working branch unless stronger evidence justifies a branch strategy change.
2. Do not return to `main`; it is materially behind the current product branch.
3. Do not create a duplicate Inquiry/Quote subsystem merely because an older summary said it was missing.
4. Treat the implemented Opportunity + versioned Intent + Quote/QuoteVersion model as a candidate architecture to challenge, not as automatically correct.
5. Preserve historical audits/tests as completed evidence; only rerun or replace them when current-HEAD risk or a changed invariant requires it.

## Decisions rejected and why

- Rejected: reset/rebase work back to `main` by default. Reason: live comparison shows the canonical branch is 166 commits ahead and 0 behind.
- Rejected: rebuild Agency/Intent/Quote foundations from scratch. Reason: those domains already exist materially in schema, services, APIs, UI and tests.
- Rejected: declare completion/readiness based on historical reports. Reason: they do not by themselves prove the current HEAD/runtime state.

## Codex-ready execution queue

1. Review `commercial-service.ts`, inquiry adoption APIs, quote mutation paths, and DB migration constraints for canonical aggregate boundaries and immutability gaps.
2. Add/adjust database constraints or service guards for any proven quote-version immutability/status invariant gaps.
3. Add targeted regression tests only for newly discovered gaps; do not rerun unrelated historical audits.
4. Strengthen lifecycle synchronization among quote status, opportunity stage, activities and won quote selection.
5. Extend economics model only where a concrete travel-agency accounting need is unsupported; avoid speculative complexity.
6. Harden intelligence-loop event/evidence model after outcome and PII review.
7. Verify migration manifest/order against the current schema and current CI evidence.

## Owner-only blockers

None identified in this resumed cycle.

## Exact next action

Inspect the implemented commercial service and inquiry/adoption flows to decide whether the current Opportunity + IntentVersion + QuoteVersion aggregate is the correct canonical product model or requires a surgical redesign.
