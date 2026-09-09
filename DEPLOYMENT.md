# THE JOURNEY V1 — Production Deployment

## Target

Next.js application deployed from the `main` branch, backed by the dedicated Neon project `THE JOURNEY Production V1`.

## Required production environment

Set these variables in the hosting provider's production environment:

- `DATABASE_URL` — Neon Production V1 connection string
- `NODE_ENV=production`
- `NEXT_PUBLIC_APP_URL` — deployed application URL

Configure optional integrations only when enabled by the corresponding feature (names exactly as read by the code):

- `RESEND_API_KEY` — transactional email
- `ADMIN_API_KEY` — admin trust-desk boundary (fail-closed when unset)
- `LINKING_TOKEN_SECRET` — identity-linking token signing (min 16 chars)
- `B2_ENDPOINT`, `B2_BUCKET_NAME`, `B2_KEY_ID`, `B2_APPLICATION_KEY` — private Backblaze B2 object storage using the S3-compatible API. Use a bucket-scoped application key; never use the Backblaze master key.
- `NEXT_PUBLIC_SITE_URL` — public site URL used by `/sitemap.xml` and `/robots.txt` (`NEXT_PUBLIC_APP_URL` is accepted as a legacy alias)
- `AI_MODEL_FAST`, `AI_MODEL_STRONG`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `TAVILY_API_KEY` — AI / travel-intelligence features (all optional; deterministic fallbacks apply when unset)

## Storage contract

Media uploads and private KYC/KYB documents use Backblaze B2 through the S3-compatible AWS SDK adapter. The production bucket remains private. Browser uploads and authorized document reads use short-lived presigned URLs; application code must never expose the B2 application key or a public document URL.

## Build contract

Install: `npm ci`

Validation: `npm run typecheck`

Lint: `npm run lint`

Build: `npm run build`

Database contract check: `npm run db:check`

If `db:check` reports missing columns/tables against Production V1, apply
`db/production_alignment.sql` (idempotent, additive-only, data-preserving) via
the Neon SQL editor — against **Production V1 only**, never the legacy project.

## Database safety

The legacy Neon project is not the production database for the current `main` schema. Do not point production at it. The dedicated Production V1 database must remain the database paired with this code line.

Never commit production credentials to Git. `.env` files are ignored by `.gitignore`.

## Post-deploy smoke test

1. Load the homepage.
2. Confirm registration and login.
3. Create an agent account/profile.
4. Create an offer.
5. Confirm offer persistence and retrieval.
6. Submit a contact request.
7. Confirm the agent inbox receives the lead.
8. Confirm response status transition.
9. Confirm review flow.
10. Verify `/api/health` reports storage provider `backblaze_b2` as `HEALTHY`.
11. Request a media upload URL from `/api/media` and verify a test object can be uploaded to the private B2 bucket.

Run the database contract check against the same production `DATABASE_URL` before enabling real traffic.
