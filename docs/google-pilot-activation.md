# Google login for the SILA Vercel pilot

Status: deferred by the owner on 2026-10-05. The current pilot uses
`docs/password-pilot-registration.md`; these instructions are for a future rollout.

Future path: activate the existing Google OAuth bridge, using the current
Vercel HTTPS origin. It preserves SILA accounts, sessions and role rules. It
needs no new auth SDK, paid site domain, Resend sender or database replacement.

## One account setup step

Google OAuth credentials must be created inside the owner's Google account.
Google Cloud access is not connected to this execution environment. The two
credentials are not present in the current production environment; do not
invent them or ask the owner to paste the secret into chat.

1. Open https://console.cloud.google.com/auth/overview and choose or create a
   dedicated project named `SILA Pilot`. Do not enable unrelated APIs, paid
   services, billing, or a trial for this identity setup.
2. In Google Auth Platform, configure the application/support contact using a
   real monitored address. A personal Gmail address can be the contact; this is
   not a transactional sending-domain configuration. Use the **External**
   audience for users outside one Workspace organization.
3. Limit Data Access to basic identity: `openid`, `email`, `profile`. The existing
   start route requests exactly those scopes. Do not add Gmail, Drive or other
   data permissions. Google's current policy has a basic-identity exception to
   the test-user allowlist; a Testing application may show a testing notice.
   Validate the actual consent screen with a non-owner account before rollout.
4. Under Clients, create a **Web application** client called `SILA Vercel Pilot`.
   Register this exact Authorized redirect URI:

   ```text
   https://the-journey-version-1-0.vercel.app/api/auth/google/callback
   ```

   This implementation starts on the server; it does not require a browser
   JavaScript OAuth origin. Do not add changing deployment URLs or localhost to
   this pilot client.
5. Store the credentials directly in the `sila-platform` Vercel project's
   **Production** environment:

   | Variable | Value |
   | --- | --- |
   | `GOOGLE_CLIENT_ID` | Client ID from Google |
   | `GOOGLE_CLIENT_SECRET` | Client secret from Google; sensitive/server-only |

   Keep rollout flags off during this setup. Never use `NEXT_PUBLIC_` for a
   client secret or commit the downloaded credentials file.

## Engineering activation after credentials exist

1. Confirm the additive Phase 7 schema and unique provider/subject mapping in
   the production database; do not reset or seed it. Review the existing
   `AUTH_CUTOVER_RUNBOOK.md` checks before any necessary migration.
2. Confirm both site and auth origins equal the stable Vercel origin. Verify
   that alias points to the exact ready production deployment.
3. Enable server `GOOGLE_AUTH_ENABLED=true` while keeping
   `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false`. Redeploy and use the direct start
   endpoint for live validation. Magic-link and legacy password flags stay off.
4. Test a real non-admin traveler and agent, consent/return on the same host,
   protected session, sign-out, current-role preservation and admin refusal.
   New agents remain pending. No synthetic public supply is required.
5. Only after live evidence passes, enable `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`,
   redeploy, verify `/api/auth/config` and the browser Join flow, and recheck the
   stable public alias.

## Verification already covered by code tests

Route tests cover callback alignment, identity-only scopes, PKCE, HttpOnly and
Secure cookies, malformed state, provider timeouts/errors/invalid responses,
unverified profiles and failure cleanup. The isolated PostgreSQL test exercises
the complete start/callback/provision/session path, code replay refusal, pending
agent status, preserved traveler role and unknown-account login refusal. Google
responses are simulated there; these tests are not live Google login evidence.

## Official references

- Google client/callback requirements:
  https://developers.google.com/identity/protocols/oauth2/web-server
- Google audience and basic-identity testing rules:
  https://developers.google.com/identity/protocols/oauth2/production-readiness/overview
