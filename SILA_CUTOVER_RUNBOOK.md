# SILA / صلة — Production Cutover Runbook

This runbook separates **public brand migration** from **technical identifier migration** so the product can rebrand without destabilizing production.

Scope: a later final identity/domain cutover. The current public pilot uses
`https://the-journey-version-1-0.vercel.app`; no custom domain is owned or required,
and purchases are deferred by the owner. Domain/DNS/email steps below are not
gates for that pilot. Follow `docs/public-pilot.md` for the current phase and
`AUTH_CUTOVER_RUNBOOK.md` for independent provider activation.

## T-14 to T-7 days — ownership and legal

- Clear the **صلة / SILA** name in target markets and relevant trademark classes.
- Confirm the production domain and social handles.
- Decide whether the existing mobile app identity is preserved or replaced.
- Verify the new sending domain in Resend before changing public email addresses.
- Approve the final logo master, favicon/app icon, social preview, and product tokens.

## T-7 to T-2 days — staging

- Deploy this branch to Preview/Staging only.
- Set staging values for:
  - `NEXT_PUBLIC_SITE_URL`
  - `NEXT_PUBLIC_SUPPORT_EMAIL`
  - `NEXT_PUBLIC_AGENTS_EMAIL`
- Verify metadata, manifest, robots, sitemap, OpenRouter referer, and email sender name.
- Complete desktop RTL and mobile screenshot review.
- Run:
  - `npm run verify`
  - `npm run mobile:verify`
- Confirm no public UI still exposes the old brand.
- Test login, signup, offer browse/detail, agent profile, inquiry/contact, review/admin boundary, and verification flows without changing their business logic.

## T-1 day — domain and communications readiness

- Lower DNS TTL on the legacy domain if a domain switch is planned.
- Prepare permanent redirect rules from the old domain to the new domain.
- Preserve path and query string on redirects.
- Prepare email forwarding from legacy public addresses.
- Update customer support macros, agency onboarding templates, internal signatures, social bios, and partner-facing documents.
- Prepare Google/Search Console ownership for the new domain.
- Prepare analytics property/domain configuration.

## Cutover window

1. Merge the approved brand PR after CI is green.
2. Deploy to production.
3. Set the final production `NEXT_PUBLIC_SITE_URL`.
4. Set public support/onboarding email variables only after the new sending/receiving domain is verified.
5. Bind the new domain and validate TLS.
6. Enable old-domain redirects.
7. Smoke-test:
   - home
   - offers
   - offer detail
   - agents
   - trust/legal
   - signup/login
   - contact/inquiry
   - admin/review boundary
   - mobile API connectivity
8. Verify:
   - title/description
   - favicon
   - manifest
   - sitemap
   - robots
   - social preview
   - transactional sender display
   - OpenRouter HTTP referer

## T+1 to T+7 days — post-cutover

- Monitor 404s and redirect misses.
- Monitor email deliverability and DMARC/SPF/DKIM status.
- Watch conversion funnels for unexpected drop-offs after copy/identity changes.
- Check search indexing and canonicalization.
- Keep legacy public emails forwarding.
- Do not delete old assets or historical deployment records until the rollback window closes.

## Rollback

If the public rebrand causes a production issue:
- revert the brand PR, not backend/security commits;
- keep the database untouched;
- keep new-domain DNS records documented;
- retain both email identities until delivery is stable;
- preserve all migrated assets for a second cutover attempt.

## Separate release required for technical identifier migration

The following must **not** be silently renamed in this brand PR:
- repository name
- npm package names
- Expo slug / URI scheme
- iOS bundle identifier
- Android package identifier
- Neon project/database name
- storage buckets
- database tables
- secrets and integration identifiers

Each of those requires its own dependency audit and rollback plan.
