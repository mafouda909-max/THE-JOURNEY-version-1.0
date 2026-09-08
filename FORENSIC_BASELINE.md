PHASE: Forensic baseline — 2026-09-08
STATUS: P0 gaps confirmed; not production-ready.

WHAT I VERIFIED:
- Local starting main was 26bcfec, with pre-existing modified .gitignore and untracked docs/, .github/github-app.yml and prod.env. These were preserved.
- GitHub's actual repository is mafouda909-max/THE-JOURNEY-version-1.0. The hyphenated name in the handoff returns 404. Vercel links to the actual repository.
- After fetch, origin/main is 48988742e453c60242e50853f026ce1c866f9fab. Vercel production deployment dpl_13NZ5FdNudC6Jd7JC798zMif4yxi reports this exact SHA and READY.
- Arena branch arena/01a07e36-the-journey-version-1-0 points to c2dfb79, already merged into main by PR #8. Its five commits since ee7c2f7 concern mobile/CI and documentation. The six claimed KYC/onboarding commits do not appear in fetched refs/history. No cherry-pick was warranted.
- Reviewed auth/session, media/R2, identity assurance, KYC, offer routes, risk pipeline, marketplace queries, contact routes/state policy, account/review UI, notifications, schema, CI and mobile contracts.
- Production Neon project icy-firefly-64909570 / br-round-band-b1s8gdka has 17 public tables. Read-only counts: agents=1, offers=0, published=0, verified agents=0, agent_documents=0.
- Production accounts has no email_verified_at/phone verification columns; no verification challenge table exists. Claimed onboarding migration is absent from fetched repository and actual schema.
- Production HTTP: health 200/DEGRADED, database HEALTHY; offers 200 with count=0; auth/me 401; join/account/review return HTML 200 (redirects followed, not authenticated-flow evidence).
- Chrome automation timed out before inspection; no visual evidence claimed.

WHAT I CHANGED: Baseline stage made no application or production changes. Created isolated worktree from origin/main for subsequent implementation.
FILES CHANGED: This record (after baseline).
TESTS: Initial root suite 41/42 on Windows: contract parser assumes LF line endings. After normalizing parser input, 42/42. Prior green CI does not substitute for this rerun.
DATABASE STATUS: Production read-only. Created isolated test branch br-lingering-mouse-b1yridh7, name codex-mvp-verification-20260908; no production migration or test data.
PRODUCTION STATUS: Existing SHA above; no deployment performed.
BLOCKERS: Claimed Stage 1 implementation not present in published Git refs; production storage reports NOT_CONFIGURED; browser tool timed out.
REMAINING P0: Real email/phone verification, KYC upload/review wiring, proof-based eligibility, admin evidence gate, public offer visibility, authenticated contact response/tracking, IDOR/session/media boundaries, DB/HTTP end-to-end verification.
REMAINING P1: Recovery, distributed abuse controls, provider delivery/monitoring, operational UX.
COMMITS: Working branch codex/mvp-verification based on 4898874; initial workspace main unchanged.
EVIDENCE: git fetch/log/diff/worktree output; GitHub repository/branch connector; Vercel project/deployment connector; Neon information_schema and aggregate count queries; local npm test; production HTTP status checks.
