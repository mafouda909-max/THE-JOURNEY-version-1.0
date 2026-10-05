# Password recovery implementation

Password registration is live on the Vercel pilot origin. Email confirmation and
recovery stay unavailable until the runtime verifies a real sending domain. The
account security and recovery screens use the same readiness as the API; they do
not offer a send action while mail is unavailable.

## Security and delivery

- Password changes check the current credential, use a conditional update, and
  rotate all sessions in the same transaction. A concurrent change cannot
  overwrite a newer credential or create a session after a competing reset.
- Recovery requests share HMAC-only IP, identity and global budgets in PostgreSQL.
  The public response acknowledges acceptance before account lookup or delivery,
  using Next.js `after`. Recipient-specific provider failures do not disclose
  whether an account exists. A fixed `dispatch_failed` operational code excludes
  identities, tokens and provider error text.
- Random 256-bit tokens are stored as SHA-256 hashes, expire, and are consumed
  once. Issuance, reset and confirmation use account-first locks. Concurrent
  requests cannot exceed the per-account mail quota or reuse competing tokens.
- New links carry their bearer in the URL fragment. The client captures it in
  component memory and scrubs the address bar while preserving Next history
  state. Legacy query links remain supported. The page requires an explicit
  confirmation; email scanners cannot consume a token through GET.
- Auth bodies are limited by streamed bytes, require JSON objects, and reject
  null, primitives, arrays and oversized bodies. Content-Length is not trusted.
- Analytics and performance middleware exclude private/auth paths and sensitive
  query keys. Public URLs lose their query and fragment. Referrers are disabled.
- Mail accepted by a provider is reported as accepted for sending, not delivered.
  Verification throttling returns 429 instead of claiming a message was sent.

## Design evidence

Primary authority: SILA's existing Arabic font, navy/blue/cream palette, 24px
window surfaces and green verified state. Refero MCP returned `NO_SUBSCRIPTION`;
no paid subscription was enabled. The public [Vercel style reference](https://styles.refero.design/style/f24daf3a-d43f-4dec-85a9-8ac1d5148a03)
informs only hierarchy and borders. Inspo `recommend` returned Flomo and
Cooper Hewitt signup examples, with an explicit thin sample; these inform compact
form sequencing only. No palette, typeface or generic hero layout was adopted.

## Verification

Hermetic tests cover streamed body limits, privacy filters, fragment/query
capture, uniform deferred recovery responses, unavailable mail and distributed
limits. Isolated PostgreSQL tests exercise concurrent token issuance, password
changes, competing resets, session revocation and pending-agent trust boundaries.
Browser QA covers both roles on desktop and mobile, successful form clearing,
cookie rotation, unavailable-mail screens and bearer scrubbing.

Live email delivery cannot be claimed until an operator supplies a sender/domain
they control and its DNS verification succeeds. The legacy `alrehlla.com` sender
is pending and is not evidence of ownership. Domain purchase is not a requirement
for running the public Vercel pilot.
