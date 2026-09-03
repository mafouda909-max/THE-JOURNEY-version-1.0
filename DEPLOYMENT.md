# THE JOURNEY V1 — Production Deployment

## Target

Next.js application deployed from the `main` branch, backed by the dedicated Neon project `THE JOURNEY Production V1`.

## Required production environment

Set these variables in the hosting provider's production environment:

- `DATABASE_URL` — Neon Production V1 connection string
- `NODE_ENV=production`
- `NEXT_PUBLIC_APP_URL` — deployed application URL

Configure optional integrations only when enabled by the corresponding feature:

- `RESEND_API_KEY`
- `S3_ENDPOINT`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_BUCKET`

## Build contract

Install: `npm ci`

Validation: `npm run typecheck`

Lint: `npm run lint`

Build: `npm run build`

Database contract check: `npm run db:check`

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

Run the database contract check against the same production `DATABASE_URL` before enabling real traffic.
