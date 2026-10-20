# Password registration for the Vercel pilot

Owner decision, 2026-10-05: activate registration using an available method,
without Google setup, a purchased domain or a configured email sender. The
first-party email/password flow uses the existing PostgreSQL accounts and sessions.

Agent signup opens `/account` immediately. It requires a name, email and password;
city is optional. No documents, license or review are required to create or access
the account. The internal `pending` status means verification has not started;
it does not mean login is pending. Verification is a later step whose benefits
are public discovery, trusted status and permission to submit offers for review.
No agent becomes publicly visible or verified simply by registering.

## Interface direction and reference lock

Direct build against the existing SILA design system: IBM Plex Sans Arabic,
navy/blue action colors, white form surfaces, existing identity/agent marks and
24 px windows. Green remains a verified state, not a signup-success implication.
The Refero MCP research tools returned `NO_SUBSCRIPTION`. The owner then supplied
the public [Styles library](https://styles.refero.design/), where three live style
references were reviewed on 2026-10-05:

- [Bevel](https://styles.refero.design/style/c0717d1a-b446-4166-a445-6497fe287fea):
  comfortable spacing, pale supporting surfaces and generous rounded containers.
- [Vercel](https://styles.refero.design/style/f24daf3a-d43f-4dec-85a9-8ac1d5148a03):
  a distinct primary action and quiet secondary controls.
- [Ramp](https://styles.refero.design/style/b38702a0-75ab-474c-9106-00b624535825):
  borders and typography provide hierarchy without piling shadows onto forms.

These are bounded secondary references, alongside the bundled Craft Details and
Copywriting guides. SILA's existing Arabic typography, palette, iconography and
the owner's immediate-access decision remain the primary reference. No external
fonts, brand colors, imagery or subscription are added.

| Decision | Source | Application |
|---|---|---|
| Account creation before verification | Owner decision | Account opens immediately; verification CTA describes visibility/approval benefits. |
| Context before form | Refero copywriting + existing SILA join pattern | Heading and role choices appear before fields. |
| Persistent labels and mobile inputs | Refero Craft Details | Visible labels, email keyboard, autocomplete, optional city, password visibility control. |
| Clear next actions | Refero copywriting | Home, navigation, directory and trust pages link directly to registration; remove invented 48-hour/weekly review promises. |
| Consistent identity | Existing SILA tokens | Preserve type, palette, marks and component roles across responsive surfaces. |
| Calm form hierarchy | Public Bevel / Ramp references | Keep the 24 px SILA window, generous form spacing and subtle border; remove the extra form shadow. |
| One primary action | Public Vercel reference | A single filled submit button, secondary role controls and explicit pending feedback. |

Rendered desktop/mobile QA must verify these choices as well as the auth flow.

## Security and truthful identity

- Signup accepts only traveler/agent. Existing accounts are never overwritten,
  assigned new roles or given a new password by public signup.
- Email is an unverified login identifier. Responses and account UI say so;
  signup creates no verified email or Google identity.
- Google/magic-link auto-linking refuses an unlinked password-pilot account with
  the same email. A future linking feature must require the existing account's
  authenticated session and verified provider, preventing pre-registration takeover.
- Passwords use asynchronous scrypt (`N=131072,r=8,p=1`), random salts and constant-time
  comparison. Passwords are 15–128 characters; whitespace/Unicode are retained.
  Unknown, legacy and OAuth-only accounts use a dummy derivation for failed login.
- The pilot does not activate old password or admin login switches. Public
  password login rejects every role other than traveler/agent.
- Same-origin JSON POSTs, bounded 4 KiB bodies, private/no-store responses and
  HttpOnly/Secure/SameSite=Lax sessions protect the registration boundary.
- PostgreSQL atomically enforces shared IP, email and global attempt budgets.
  Keys are HMACs under a hosting secret; raw email/IP/password never enters
  counters, logs or analytics. Expired counters are cleaned after one hour.
- Password recovery by email is unavailable until a real verified sender exists;
  the signup form tells users to keep their password. No fake reset button/mail.

References: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html),
[OWASP authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).

## Deployment preparation and activation

The reviewed preparation applies `db/contact_request_ownership.sql` followed by
`db/password_pilot_auth.sql`. The former adds a nullable ownership column, foreign
key and index; existing guest requests remain unclaimed. It never links a request
by matching its email. The latter adds only a normalized-email unique index and
`auth_password_attempts`. Both preserve existing data and are idempotent.
Case-insensitive duplicate emails make preparation fail rather than merging or
deleting accounts.

The first live activation found that ownership was absent from the existing
Production schema even though fresh-schema CI passed. The stable alias was
returned to the preceding release while correcting this prerequisite. Preparation
and runtime readiness now check every column consumed by the account page,
including requests, offers and notifications, with zero-row queries. Native
PostgreSQL regression tests simulate the legacy state in an owned disposable
schema; browser fixtures also exercise this upgrade before signup.

1. Pass unit, native PostgreSQL and desktop/mobile browser registration tests.
2. Store `PASSWORD_AUTH_RATE_LIMIT_SECRET` as a sensitive Production environment
   variable: 32 random bytes encoded as 64 lowercase hex characters.
3. Set Production `PASSWORD_PILOT_PREPARE_ENABLED=true`. The build hook only runs
   for explicitly enabled Vercel Production, over direct certificate-verified
   TLS to the same managed database. It rejects unknown/legacy Neon projects.
   It checks account-page schema readiness before the build can succeed. It never
   applies the full release chain, resets tables, seeds users or creates
   schema from a request handler. Preview remains off by default and uses a
   separate `PASSWORD_PILOT_PREVIEW_PREPARE_ENABLED` gate. When that Preview
   gate is explicitly enabled, `selectDatabaseUrl()` requires a distinct
   branch-scoped `SILA_PREVIEW_DATABASE_URL`; managed Neon project and branch
   identity must both be present and the legacy project remains rejected.
4. Set `PASSWORD_AUTH_ENABLED=true` and `NEXT_PUBLIC_PASSWORD_AUTH_ENABLED=true`.
   Keep Google, magic links and all legacy/admin migration flags false.
5. For isolated Preview QA only, enable `PASSWORD_PILOT_PREVIEW_PREPARE_ENABLED=true`
   for that Git branch, deploy once, verify the password schema gate passes, then
   disable the preparation flag and redeploy the same reviewed commit. Never point
   this Preview flag at inherited Production credentials.
6. Deploy the tested commit. `/api/health` must show password readiness; the UI
   remains unavailable if origin, secret, schema or index readiness fails.
7. Assign the stable Vercel alias to that READY release, verify signup → account
   → logout → login → session, and reject forged roles and cross-origin requests.
   A clearly identified synthetic traveler used for live QA is not a real
   acquisition or marketplace-supply claim. Do not create synthetic verified agents.

Rollback: disable both password rollout flags and deploy. Keep the additive
table/index and registered accounts; do not reset/delete user data or re-enable
legacy/admin login. Domain and sender provisioning remain deferred.

## Reacher evaluation

The owner supplied [check-if-email-exists](https://github.com/reacherhq/check-if-email-exists/).
Its README and license were reviewed on 2026-10-05. Syntax, MX and SMTP reachability
checks may improve email quality, but cannot establish the registrant's control
of a mailbox. Results can be unknown or catch-all. Self-hosting requires outbound
SMTP connectivity; its documented licensing is AGPL-compatible open source or a
commercial license. No service, dependency, subscription or user-email export is
introduced. Registration remains independent; email ownership needs a future
verified challenge/sender, and reachability never sets `emailVerified`.
