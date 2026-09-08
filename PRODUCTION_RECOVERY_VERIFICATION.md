# THE JOURNEY / الرحلة — Recovery & CI verification record

**Date:** 2026-09-08 (Africa/Cairo)
**Repository state examined:** `main` @ `ee7c2f755f18e6b74b4fe1759df1d871afaf6715`
**Why this document exists:** PR #7 (`revert-6-arena/01a06920-...`) merged a revert of
the production-hardening PR, which raised the question *"did we lose verified
production work from `main`, and does it need to be recovered?"*

---

## 1. Verdict: nothing was lost — no recovery is required

The revert did not remove any hardened code from `main`.

```
$ git diff --stat main 428a5ba      # 428a5ba = head of the reverted PR #6
                                    # (empty output: trees are identical)
```

`main`'s tree is byte-for-byte the tree of the branch that was "reverted", and the
artifacts that PR carried are all present on `main`:

| Artifact landed by PR #5 / #6 | Present on `main` at `ee7c2f7` |
| --- | --- |
| `src/lib/seed-safety.ts` (production seed guard) | yes |
| `src/lib/contact-state.ts` (lead state machine) | yes |
| `tests/{seed-safety,contact-state,rate-limit,legal,format}.test.ts` | yes — 5 files, 21 tests |
| `db/production_schema.sql` + `db/production_alignment.sql` (incl. `ALTER TABLE offers ADD COLUMN IF NOT EXISTS title_en TEXT`) | yes |
| `scripts/check-production-schema.ts` (validates `offers.title_en`, the 42703 incident) | yes |
| production indexes (`offers_published_at_idx`, `offers_expires_at_idx`, …) | yes |
| offline/self-hosted-font build, hardened `src/db/index.ts` | yes |

The most likely explanation is that the identical change set had already reached
`main` through **PR #5** (same head branch `arena/01a06920-the-journey-version-1-0`,
same 601 additions / 27 deletions as PR #6), so reverting the duplicate merge was a
no-op on content. No cherry-picks, no re-apply, no branch rescue — **do not** open a
"recovery" PR for this; it would be an empty diff.

## 2. Code gates re-run locally on this commit

`npm ci` first, then the exact commands CI runs:

| Gate | Command | Result |
| --- | --- | --- |
| Install | `npm ci --no-audit --no-fund` | PASS — 437 packages |
| Typecheck | `npm run typecheck` | PASS |
| Lint | `npm run lint` | PASS |
| Unit tests | `npm test` | PASS — 21 tests (before this PR) |
| Production build | `env -u DATABASE_URL npm run build` | PASS — Next.js 16.2.6, no database present |

Two points worth pinning down:

- The build succeeds with **no `DATABASE_URL` at all**, so "offline build" is a real
  property, not an assumption. The old CI job injected a fake connection string,
  which hid any accidental build-time data access.
- The unit tests do not need a database either, which is what makes the new parallel
  `test` job possible.

## 3. What CI now gates (the gap this PR closes)

Before this PR, `.github/workflows/ci.yml` had a single `verify` job running
typecheck → lint → build and **never ran `npm test`**: the five suites above were
not executed by any automated check, so a regression that only unit tests catch
could reach `main`.

Now:

| Job | Runs | Notes |
| --- | --- | --- |
| `static` | typecheck, lint | no build, fastest feedback |
| `test` | `npm test` (unit + web⇄mobile contract) | runs with `DATABASE_URL` unset, plus a guard step that fails if the suites start depending on a database |
| `build` | `next build` | no `DATABASE_URL`, so a build-time DB dependency fails CI |
| `mobile` | mobile typecheck, unit tests, Metro bundle, artifact | separate package, own lockfile |

Also hardened: workflow `permissions: contents: read`, per-job
`timeout-minutes`, `npm ci --no-audit --no-fund`, and `actions/checkout`,
`actions/setup-node`, `actions/upload-artifact` pinned to commit SHAs (tags
recorded in the comments) so a moved tag cannot silently change what CI executes.

### 3.1 The CI `startup_failure` seen earlier — root cause and status

Two separate effects showed up while this PR was being prepared:

1. **Policy: every action must be pinned to a full commit SHA.** This repository
   enforces `Require actions to be pinned to a full-length commit SHA`. The
   workflow that was on `main` (single `verify` job) used `actions/checkout@v7`
   and `actions/setup-node@v7`, so its run died at the first step with:
   `… are not allowed because all actions must be pinned to a full-length commit SHA`.
   Any run of the *old* file — a `main` push, a `workflow_dispatch` against
   `main`, or another session's branch still carrying that file — reports the same
   error. It is not a symptom of the workflow in this PR.
2. **An Actions resolution outage** in the window when this branch was first
   pushed: during that period *every* run referencing an action failed to start,
   including ones already pinned by SHA, while a probe workflow with only `run:`
   steps succeeded in 8s. That is why the earliest `CI` runs on this PR show
   `startup_failure` with zero jobs and no log.

State of the pins in this repository after this PR:

| Workflow | `uses:` references | Pin status |
| --- | --- | --- |
| `.github/workflows/ci.yml` | 9 (checkout ×4, setup-node ×4, upload-artifact ×1) | all full-length SHAs |
| `.github/workflows/production-db-check.yml` | 2 (checkout, setup-node) | tags → SHAs, pinned in this PR |

Each pin was resolved from the action's own tag ref and cross-checked as a real
commit (`gh api repos/<action>/commits/<sha>`), and the tags still point at those
same commits, so the pins are current rather than stale:

```
actions/checkout      3d3c42e5aac5ba805825da76410c181273ba90b1  = tag v7
actions/setup-node    820762786026740c76f36085b0efc47a31fe5020  = tag v7
actions/upload-artifact ea165f8d65b6e75b540449e92b4886f43607fa02 = tag v4
```

No workaround was used: the security setting stays enabled, the pinning stays in
place, and `upload-artifact` is intentionally left on the pinned v4 commit (a major
bump is a separate change that cannot be validated from this environment).

## 4. Contract coverage for the mobile companion app

`tests/mobile-contract.test.ts` compares the web server and `mobile/` as text, so
the two cannot drift apart silently: declared routes must exist and export the
declared verb, shared literals (trip types, currencies, price labels, status
unions) must match, contact-form limits and Arabic refusal copy must match the
route, and every `offers`/`agents` column the API returns must be modelled while
internal fields (`rejectionReason`) stay excluded.

The guard was mutation-tested rather than trusted:

| Injected defect | Result |
| --- | --- |
| mobile renames a trip-type label | FAIL — "uses the same trip types…" |
| mobile message minimum 10 → 5 | FAIL — "mirrors the server's minimum lengths" |
| client declares `DELETE /api/agents` | FAIL — route/verb assertion |
| baseline (no mutation) | PASS — 42 tests |

## 5. Not verified from this environment

Stated so nobody reads this as a production sign-off:

- **Live database.** `scripts/check-production-schema.ts` was not run against the
  Neon production database — no `DATABASE_URL` is reachable here. The manual
  `Production DB Contract` workflow remains the way to do that.
- **Deployment / smoke tests.** No Railway or Vercel environment was contacted, and
  no production health endpoint was probed.
- **Device behaviour.** The mobile app is verified by typecheck, unit tests and a
  Metro bundle only. No emulator or physical-device run was performed here, so
  layout, gestures and image loading on real devices are unproven.
- **Secrets.** Nothing was added to or read from production credentials; `mobile/app.json`
  intentionally commits no deployment hostname.
