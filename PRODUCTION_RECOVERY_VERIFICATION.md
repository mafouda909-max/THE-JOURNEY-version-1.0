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

### 3.1 Known blocker on the GitHub side (not caused by this change)

Every run of the `CI` workflow in this repository currently ends in
`startup_failure` with **zero jobs and no log** — including runs of the
pre-existing workflow on `main` (`ee7c2f7`, 2026-09-07 23:15 UTC), i.e. ~1 h
before this branch existed.

Bisected empirically on this branch:

| Probe workflow | Steps | Result |
| --- | --- | --- |
| `run: echo` only | no `uses:` | **success** — runners and Actions are reachable |
| `uses: actions/checkout@v7` | any action, tag pin | `startup_failure` |
| `uses: actions/checkout@3d3c42e5…` | any action, SHA pin | `startup_failure` |
| `uses: actions/setup-node@v7` | any action | `startup_failure` |
| `uses: actions/upload-artifact@v4` | any action | `startup_failure` |

So *any* workflow that resolves an action fails for this repository, while a pure
`run:` workflow passes. That points at an account/repository-level restriction on
action usage (spend limit / included minutes / an "allowed actions" policy or an
Actions outage), not at the workflow YAML — which parses and was validated with
`js-yaml` (`4 jobs, permissions: contents: read`, per-job timeouts).

Consequence: the four CI jobs cannot be proven green from here. Re-run
`CI` once action usage is restored; the local gate table in §2 is the interim
evidence.

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
