# SILA Passwordless Auth Cutover Runbook

Status: integration candidate only. Do not enable in Production merely because code/CI passes.

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
5. Configure Preview secrets:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `RESEND_API_KEY` for magic links
   - `RESEND_FROM_EMAIL`: a bare sender address on the owned, verified domain
   - `RESEND_SENDING_DOMAIN_ID`: the exact domain ID shown by Resend
   - The runtime key must permit the configured domain read and transactional sends.
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

Do not enable Production until all are true:

- Phase 7 migration has a reviewed backup/rollback plan.
- Production `AUTH_ORIGIN` is the canonical HTTPS origin.
- Google redirect URI exactly matches Production `AUTH_ORIGIN`.
- Secrets are stored only in the hosting secret environment.
- CI build, typecheck/lint, unit/contract tests, DB security and passwordless role tests pass on the exact release SHA.
- Browser QA passes Desktop + Mobile + RTL for the exact release deployment.
- Google live login is tested with a non-admin test traveler and a pending-agent test account.
- Email magic link is tested end-to-end with a disposable non-admin mailbox.
- Resend confirms that the configured domain is verified, sending is enabled, and
  the configured sender address belongs to that exact domain. An unrelated
  verified domain or an API key alone does not clear this gate.
- The request host, `AUTH_ORIGIN`, and canonical site origin agree. Auth must not
  start on an alternate deployment alias and return to a different cookie host.
- Admin access is tested separately and no public admin signup path exists.

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

The next external input is the owned sending domain and its DNS provider. Add
the exact Resend DNS records there, verify the domain, securely configure the
sender/key, then run the live mailbox and role matrix before enabling public UI.
