# SILA Passwordless Auth Cutover Runbook

Status: integration candidate only. Do not enable in Production merely because code/CI passes.

Current phase: a public pilot on `https://the-journey-version-1-0.vercel.app`.
The owner has no custom domain and has deferred purchases. A paid site domain is
not an authentication prerequisite. Activate providers independently: Google
does not depend on Resend verification; magic links do. See
`docs/public-pilot.md` for the phase decision.

The selected pilot path is the existing Google bridge. Exact account setup,
callback and credential locations are in `docs/google-pilot-activation.md`.
Live activation is still pending the real client credentials and live checks.

## Invariants

- Self-service roles are only `traveler` and `agent`.
- Existing accounts keep their stored role when Google/email is linked.
- New agent accounts start `pending`; OAuth does not imply agent verification.
- Admin accounts are never created by Google, email magic link, or public signup.
- Existing admin Google linking is allowed only when the exact pre-existing admin email is in `GOOGLE_ADMIN_EMAIL_ALLOWLIST`.
- Admin magic-link login is disabled.
- New password signup is disabled.
- Legacy password login is migration-only and disabled by default.
- `AUTH_ORIGIN` is server-only and must be explicit in deployed environments.

## Preview activation order

1. Apply the ordered release migrations through Phase 7 to the isolated Preview database only.
2. Confirm `auth_challenges` exists and `linked_identities_provider_subject_uidx` is unique.
3. Set Preview `AUTH_ORIGIN` to the exact stable Preview origin intended for callbacks.
4. In Google Cloud OAuth, add exactly:
   `${AUTH_ORIGIN}/api/auth/google/callback`
5. Configure Preview secrets only for the provider being activated:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `RESEND_API_KEY` for magic links
   - `RESEND_FROM_EMAIL`: a bare sender address on the owned, verified domain
   - `RESEND_SENDING_DOMAIN_ID`: the exact domain ID shown by Resend
   - The Resend runtime key must permit the configured domain read and transactional sends.
   - Skip Resend configuration when activating Google only; keep magic-link flags false.
6. Keep rollout flags false until configuration is verified:
   - `GOOGLE_AUTH_ENABLED=false`
   - `MAGIC_LINK_ENABLED=false`
   - `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false`
   - `NEXT_PUBLIC_MAGIC_LINK_ENABLED=false`
7. Enable a provider server-side first, redeploy, verify its endpoint, then enable its matching public UI flag and redeploy.
8. Keep:
   - `LEGACY_PASSWORD_LOGIN_ENABLED=false`
   - `LEGACY_ADMIN_PASSWORD_LOGIN_ENABLED=false`
   - `NEXT_PUBLIC_LEGACY_PASSWORD_LOGIN_ENABLED=false`
   unless a time-boxed migration explicitly requires legacy login.

## Required role matrix before Production

Run the cases for the provider being activated, together with common role and
session checks. A provider intentionally left disabled is not a release blocker
for the other provider.

- New traveler via Google -> traveler account; no password login.
- New traveler via magic link -> traveler account; one-time token cannot be reused.
- Existing traveler via verified Google email -> same account and same traveler role.
- New agent via Google -> agent account with pending verification.
- New agent via magic link -> agent account with pending verification.
- Existing agent via verified Google email -> same account, same agent ownership, same agent profile.
- Attempt to request agent while email belongs to traveler -> existing traveler remains traveler.
- Attempt to request traveler while email belongs to agent -> existing agent remains agent.
- Public/admin crafted role -> rejected.
- Existing admin via magic link -> rejected.
- Existing admin via Google without allowlist -> rejected.
- Existing admin via Google with explicit allowlist -> same pre-existing admin account only.
- Password signup -> 410.
- Legacy password login with flags off -> 410.
- Expired app session -> rejected.

## Production activation gates

Do not enable an authenticated provider in Production until the common checks
and that provider's checks are true. Guest public testing is already independent
of this cutover.

Common checks:

- Phase 7 migration has a reviewed backup/rollback plan.
- Production `AUTH_ORIGIN` is the canonical HTTPS origin.
- Secrets are stored only in the hosting secret environment.
- CI build, typecheck/lint, unit/contract tests, DB security and passwordless role tests pass on the exact release SHA.
- Browser QA passes Desktop + Mobile + RTL for the exact release deployment.
- The request host, `AUTH_ORIGIN`, and canonical site origin agree. Auth must not
  start on an alternate deployment alias and return to a different cookie host.
- Admin access is tested separately and no public admin signup path exists.

Google-only checks:

- Configure the OAuth client and audience/consent settings in Google Cloud for
  the intended pilot users.
- Register exactly:
  `https://the-journey-version-1-0.vercel.app/api/auth/google/callback`.
- Google live login is tested with a non-admin traveler and a pending-agent
  account; existing-role preservation and admin allowlist rejection also pass.
- Keep both magic-link flags false if verified sending is unavailable.

Magic-link-only checks:

- Email magic link is tested end-to-end with a disposable non-admin mailbox.
- Resend confirms that the configured domain is verified, sending is enabled, and
  the configured sender address belongs to that exact domain. An unrelated
  verified domain or an API key alone does not clear this gate.
- One-time consumption, failed-send invalidation and role preservation pass.
- Keep both Google flags false if Google is not configured.

Google's callback credential and redirect requirements are documented at
https://developers.google.com/identity/protocols/oauth2/web-server.

## Rollback

- First set both server rollout flags to false and redeploy.
- Then set both public UI flags to false and redeploy if needed.
- Existing linked identities may remain safely stored; disabling rollout does not require deleting them.
- Phase 7 destructive database rollback is `db/phase7_passwordless_auth_rollback.sql` and requires Owner approval.
- Never use the Phase 7 rollback as an automatic deployment rollback.

## Activation evidence — 2026-10-05

- Production canonical/auth origin: `https://the-journey-version-1-0.vercel.app`.
- Google OAuth client credentials are absent from the production environment.
- Connected Resend sending domains are not verified: `alrehlla.com` is failed;
  `alrehlla.aplatform.com` has not started verification.
- No authentication rollout flags were enabled based on these incomplete prerequisites.
- Unit tests exercise sender verification, sending capability, origin alignment,
  provider failures, coalesced probes and SDK idempotency.
- The PostgreSQL auth test exercises agent signup request, simulated mail,
  one-time token consumption, a pending agent/session, replay refusal and failed
  mail token invalidation. It creates no production agents and sends no live mail.

No domain ownership is assumed and no purchase is required for the current
public pilot. The existing Google path needs OAuth client credentials and
callback/audience configuration before live validation. Verified Resend sending
is a separate future activation; leave it disabled until its requirements are
actually met. Meanwhile, real users can test the guest readiness flow.
