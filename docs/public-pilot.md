# SILA / صلة public pilot

Decision recorded 2026-10-05: run a public product experiment on the existing
Vercel URL before spending on a final identity. The owner has no custom domain;
the absence of one is intentional and does not block this phase. Do not purchase
or assume ownership of `alrehlla.com` or any other custom domain.

## Public origin

- Canonical site: `https://the-journey-version-1-0.vercel.app`.
- Production `NEXT_PUBLIC_SITE_URL` and server-only `AUTH_ORIGIN` use that exact
  HTTPS origin.
- Share the stable alias, not a per-deployment URL. After a release, confirm the
  alias points to the intended ready production deployment. The legacy alias
  does not automatically track deployments of the renamed `sila-platform` project.
- The pilot is publicly accessible by direct link. Keep search indexing disabled
  for now; `noindex` is not access control.

## Available experience and activation order

1. Test the public Travel Readiness flow at `/readiness` without an account.
   Observe starts, completions and result status through the existing privacy-safe
   funnel. Do not add passport details, prompts, destination inputs or email
   addresses to analytics.
2. Activate first-party email/password registration on the same Vercel origin
   after database/session/role checks pass. The owner deferred Google setup.
   See `docs/password-pilot-registration.md`. Registration opens the account
   immediately; email remains unverified and recovery by email is unavailable.
3. Onboard the first real agent, review verification, and publish a genuine offer.
   New agents can access their account before verification. Public appearance,
   trusted status and offer publication follow review. Do not fabricate supply.
4. Activate the flight supplier after actual credentials and search validation.

Resend magic links and transactional mail are optional, separately gated
capabilities. Their configured sender must be verified before enabling them.
That mail-provider requirement does not block guest testing or a verified OAuth
provider. Do not use a test-only email sender for real pilot users.

## Historical baseline before password activation — 2026-10-05

- `/readiness`: HTTP 200 with the readiness page.
- `/api/health`: HTTP 200, `HEALTHY`; canonical/auth origins aligned.
- `/api/auth/config`: Google, magic links and legacy password login all false.
- Live signup/login has not been activated. Public testing currently starts with
  the guest experience; it is not evidence of an authenticated onboarding test.

## Pilot release checks

- Relevant CI checks pass on the release commit.
- The stable Vercel alias serves that production release over HTTPS.
- Guest readiness works, empty inventory is truthful, and unavailable auth stays
  truthful without collecting registration details.
- Any activated identity provider passes its role/session checks. An email
  provider does not gate Google activation, and Google does not gate email-only
  activation.
- Existing production data is preserved. Preview schema work uses an isolated
  database; no production reset or synthetic verified accounts.

## Deferred identity cutover

Custom domain selection, purchase, DNS/TLS, branded sending addresses and
domain redirects belong to a later identity cutover. The schedules in
`SILA_CUTOVER_RUNBOOK.md` and `SILA_REBRAND_MIGRATION.md` describe that later stage,
not prerequisites for this Vercel pilot. Reassess that work after real usage
provides product evidence and the owner authorizes any cost.
