# Private document upload: browser transport is a release gate

## Production finding, 2026-10-05

PR #48 passed all seven gates on `e584fd79914ca879c2592ec8c3c6593d489148a9`:
56 desktop/mobile browser tests; 231 unit/contract tests; separately executed
database/security suites. Canonical Production is merge
`44a9a7e6b435fa98b338f6d99ea194798df8b389`.

The live owned pending QA account passed 37 HTTP checks: account creation,
profile save/reopen, password login/logout, private pages, permission and
discovery gates, real private PDF PUT, forbidden unsigned access, committed
pending evidence and two readiness evaluations. No QA account was approved and
no QA offer was created or published. Production browser readiness returned an
explicit unknown visa decision. Runtime errors for readiness were absent in
the checked post-release window. These checks do **not** establish a genuine
commercial acquisition or agent-to-traveler transaction.

An additional browser-equivalent CORS check found `OPTIONS → 403 AccessDenied`
for PUT from the canonical pilot origin. Server-to-storage upload success did
not prove that the real browser upload could work. The release gate remains
open until this preflight, an origin-bearing PUT and database confirmation all
pass. The Backblaze console is currently blocked by Cloudflare verification in
the cloud browser; this is not a storage API outage.

## Compatible repair

- Storage health checks both the existing provider read and an actual PUT
  preflight. Successful listing alone cannot claim browser upload readiness.
- Reservation requires that preflight before inserting an `uploading` document.
  Failure returns a retryable 503; it never records completed evidence.
- Explicit one-time Production preparation uses existing S3 credentials. It
  first checks that the bucket is private, reads existing CORS rules, preserves
  them and adds only HTTPS canonical-origin PUT with `content-type`. It never
  changes ACLs, bucket type, keys, permissions or Preview configuration.
- Preparation is gated by `PRIVATE_STORAGE_CORS_PREPARE_ENABLED=true` and
  `VERCEL_ENV=production`; normal requests/probes never modify configuration.
  Disable the flag after the operation. A denied key cannot repair CORS and
  cannot silently gain permissions; the fixed safe log records operator action
  is required. Browser health/reservation continue to fail closed.
- No database migration or dependency is needed for this provider configuration.

## Manual operator fallback

If the existing application key cannot read/write bucket CORS, use the existing
Backblaze operator account to add this S3 CORS rule to the **Production private
bucket**, preserving existing rules. Keep the bucket private and keep runtime
keys narrowly scoped. Do not copy Production keys/buckets into Preview.

```json
{
  "AllowedOrigins": ["https://the-journey-version-1-0.vercel.app"],
  "AllowedMethods": ["PUT"],
  "AllowedHeaders": ["content-type"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 600
}
```

Provider references: [CORS rules](https://www.backblaze.com/docs/cloud-storage-cross-origin-resource-sharing-rules)
and [S3 key capabilities](https://www.backblaze.com/docs/cloud-storage-s3-compatible-app-keys).
CORS changes browser transport, not private-file authorization. Test both.

## Required proof after repair

Repeat canonical-origin OPTIONS, origin-bearing PUT, unsigned GET rejection,
provider HEAD/database confirmation, reopening, and browser UI progress. Preserve
the genuine-agent review/publish/inquiry production gate separately: isolated
approved fixtures are technical proof only, never real public inventory.

## Production preparation result and bounded gateway

PR #49 passed all seven gates (56 browser cases; the private SDK/Postgres suite
executed separately), merged at `157ad8f0ba9f78c9e1a6bf143197cc3bea752375`, and
built as `dpl_C1MifX48BJVh3ZCCaqUFMqFU6CN3`. The one-time provider preparation
returned the safe `CONFIGURATION_REQUIRED` result. The flag was disabled after
that attempt. That deployment was not promoted to the canonical origin while
the transport gate remained open.

The compatible alternative is an owned same-origin gateway for files up to
3 MiB, below [Vercel's 4.5 MB function payload limit](https://vercel.com/docs/functions/limitations).
It checks signed-in agent ownership, exact auth origin, reservation age/state,
namespace, file type/signature and actual streamed size. It locks the document
through transfer and audit, sends to the existing private provider with bounded
deadlines, consumes the provider response and checks HEAD size/type. The existing
confirmation command still commits pending evidence separately; receipt is
neither review nor identity approval. No new storage keys/privileges, public ACLs,
external service, migration or dependency is introduced. Runtime keys stay scoped.

The pilot UI states 3MB explicitly. Existing direct APIs can retain the 10 MiB
ceiling only when real provider CORS succeeds; larger files fail clearly before
reservation when direct transfer is unavailable. Storage connection probing now
checks provider read transport; it does not call CORS a readiness prerequisite
for the owned small-file gateway or claim that a read proves a successful write.
The release gate is an actual owned gateway PUT → private storage → HEAD →
database confirmation/reopen on Production, plus isolated ownership/failure tests.

Professional profile changes and upload reservation/audit are transactional.
An audit failure cannot leave a saved profile or reserved document without its
record. The gateway's transfer audit includes document id, actual size/type and
transport only, never file bytes or bearer URLs.
