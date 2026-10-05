# SILA / صلة — Brand Migration Plan

**Branch:** `design/sila-brand-migration-v2`

## Public brand
- Arabic: **صلة**
- English: **SILA**
- Core promise: **اعرف قبل أن تختار**
- Relationship: **بين المسافر والوكيل الموثوق**

## Objective

**صلة / SILA is now the canonical and only product identity.** Public surfaces, mobile identity, operational reports, tooling labels, and release documentation must use SILA. Legacy infrastructure IDs may remain temporarily only where renaming them would break an external resource; they must never be presented as product branding.

## Phase 1 — implemented on this branch

- Web metadata and public application naming
- Approved SILA SVG brand assets
- Web favicon / app-icon source
- Navigation and footer branding
- Homepage naming and brand copy
- Public trust, agents, review, and offer-detail references
- SILA color system mapped into existing Tailwind roles
- Mobile display name and visible labels
- Mobile SILA color system
- Transactional email sender display name
- OpenRouter public referer follows `NEXT_PUBLIC_SITE_URL`
- OpenRouter title and trust-auditor public brand name
- PWA manifest
- Environment hooks for public support and agency emails
- Brand contract test

## Compatibility identifiers intentionally preserved

Do **not** rename these casually:

- GitHub repository name
- root npm package name
- mobile npm package name
- Expo slug
- URI scheme
- iOS bundle identifier
- Android package identifier
- Neon project/database names
- database schema/table names
- archived readiness/recovery reports
- historical engineering comments and test names

Those identifiers can affect deployments, app updates, deep links, CI, databases, or external integrations.

## Deferred dependencies for final identity cutover

The current public pilot runs on `https://the-journey-version-1-0.vercel.app`.
No custom domain is owned; selection and purchase are intentionally deferred.
The domain and branded email work below does not block this pilot. See
`docs/public-pilot.md` and activate auth providers independently using
`AUTH_CUTOVER_RUNBOOK.md`.

### Domain
- choose and control the final SILA production domain
- set `NEXT_PUBLIC_SITE_URL`
- redirect the old domain only after verification
- update canonical URLs, Search Console, analytics, social profiles, and OpenRouter referer

### Email
- verify the new sending domain in Resend
- set `NEXT_PUBLIC_SUPPORT_EMAIL`
- set `NEXT_PUBLIC_AGENTS_EMAIL`
- keep legacy addresses forwarding during transition

### Mobile identity
- decide whether the existing app-store identity must be preserved
- if preserving, change display branding only
- if creating a new app identity, migrate slug, scheme, bundle ID, Android package, store listing, app links, and universal links together

### Legal
- clear **صلة / SILA** in target markets and relevant trademark classes
- confirm domain and social-handle availability
- update legal-entity wording only after legal review

### SEO / social
- produce final raster OG/social preview assets
- update organization structured data
- submit the new sitemap after domain cutover

## Rollout rule

**Brand migration is front-end first.** Infrastructure is renamed only when there is a concrete operational benefit and a safe migration path.

## Merge validation

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run mobile:verify`
- desktop RTL visual review
- mobile visual review
- metadata + manifest check
- verify no public-facing old-brand strings remain
