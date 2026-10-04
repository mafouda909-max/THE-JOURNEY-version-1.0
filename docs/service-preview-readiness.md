# SILA service preview readiness

Observed: 2026-10-04 UTC, following CI #856 on commit 246689133922c6fe5739a9fbf365f331b8aa1798.

| Item | Evidence | State |
| --- | --- | --- |
| Project | Vercel sila-platform, linked to THE-JOURNEY-version-1.0 | FACT |
| New fulfillment branch deployment | Deployment listing filtered by codex/sila-service-fulfillment-20261004 returned none | NOT DEPLOYED |
| Inherited DATABASE_URL | One sensitive variable is scoped to production and preview | SHARED BINDING |
| Isolated older preview binding | DATABASE_URL is overridden only for codex/full-project-completion | DOES NOT COVER NEW BRANCH |
| Secret values | Sensitive variable inspection does not return recoverable values | UNAVAILABLE |
| Real preview SQL migration / accounts | No migration or provisioning executed | NOT ACTIVATED |
| Latest observed production | READY deployment dpl_EMwJ8Ac2K1oFEVTeQpcy2yssCKXW at 4fd73a5c0a5402030a4727197f33b7439b5ba3d0 | UNCHANGED |
| Production/source relation | Source main 66469e3 is four commits ahead of that deployed ancestor | FACT |

A READY production deployment is not evidence that the fulfillment branch is deployed. Green CI uses isolated synthetic PostgreSQL databases and separate actor contexts.

The new application guard refuses Vercel preview database access until SILA_PREVIEW_DATABASE_URL is configured and differs from the inherited database identity. Ordinary production and local database resolution is unchanged.

## Concrete activation sequence

1. In the connected provider/project, confirm an isolated preview branch/database. Confirm it is separate from production, including the database branch behind pooled/unpooled endpoints.
2. Securely bind its connection URL as SILA_PREVIEW_DATABASE_URL, target Preview, branch codex/sila-service-fulfillment-20261004. Keep the inherited DATABASE_URL as the production identity reference. Do not print, export or commit connection strings.
3. Keep SERVICE_FULFILLMENT_PILOT_WORKSPACE_IDS empty. Deploy the exact reviewed commit as Preview. The current callable hosting tools can inspect/configure variables but do not expose a deployment creation operation; deployment requires an authorized CLI/dashboard route.
4. Use the isolated database connection explicitly for schema preparation. Review existing phase prerequisites and apply only additive service_fulfillment_pilot.sql. Never run an initial schema/reset against an existing database. Preserve prior preview records.
5. Prepare consenting test accounts and active workspace memberships in that preview. Supplier qualification references are attestations, not verified licenses. Do not use the CI seeder against this remote database: it intentionally refuses remote/non-QA hosts.
6. Allowlist only the approved preview workspace IDs. Configure the actual preview AUTH_ORIGIN or NEXT_PUBLIC_SITE_URL where proxy normalization requires it.
7. Verify the office, partner and customer workflow, report access, cancellations/refunds and link expiry/revocation against that deployment. Record the deployment URL, exact commit, database isolation evidence and observed results.
8. Clear the preview allowlist to stop pilot access while preserving history. Production activation remains a separate owner-approved release.

No invitation, email, payment initiation, production migration or real supplier transaction was performed.
