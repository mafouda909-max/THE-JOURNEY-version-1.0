# Owned capability registry

Implemented for the Vercel public pilot, 2026-10-05. The product owns the contract;
providers remain replaceable adapters. No new package, subscription, schema or
public tool-invocation API is introduced.

## Contract and permissions

`src/lib/capabilities/contracts.ts` defines the provider-neutral metadata and
closed status/failure types. `catalog.ts` is the single catalog;
`production.ts` binds real adapters. `tools.ts` projects it for the existing
admin API, including the legacy `CONNECTED` display status.

Each definition includes implementation state, permitted internal actors,
read/write policy, trust, data sensitivity, cost model, fallback, freshness,
license, prerequisites and probe/call deadlines. Unit price and vendor SLA are
`null`: no purchased terms, performance guarantee or cost estimate is invented.
`runtime_observation` describes connection freshness, not freshness of a visa
rule, supplier price or web page. Those facts retain their domain evidence.

The registry is an internal execution boundary, not a user authorization system.
Routes still verify sessions, ownership, roles and domain state. Agent Runtime
still applies Policy → Tool Registry → Provider → Evidence → Audit before using
the web/flight gateways. A successful probe never grants publication, approval,
payment, booking, document access or public-discovery rights.

| State | Evidence / behavior |
|---|---|
| `READY` | Successful adapter probe or validated operation in this runtime. |
| `NOT_CONFIGURED` | Required credentials/configuration are absent. |
| `CONFIGURATION_REQUIRED` | Provider authentication alone is insufficient, e.g. sender domain unverified. |
| `GATED` | Implemented adapter deliberately disabled by the phase flag. |
| `PLANNED` | No implemented adapter; credentials cannot promote it to ready. |
| `DEGRADED` | Fixed failure code; unavailable provider or expired deadline. |

## Current adapter coverage

| Capability | Actual implementation and gate |
|---|---|
| Database | PostgreSQL `SELECT 1`; no database/role/project identity in public health. |
| Storage | Private B2 configuration plus a bounded list probe. Business reads/presigned URLs use the owned storage gateway after ownership checks. |
| AI assistance | Existing OpenRouter/OpenAI adapter. Failed calls use explicit deterministic drafting/review or low-confidence source guidance. |
| AI document analysis | Separate OpenAI configuration and `AI_DOCUMENT_REVIEW_ENABLED`. A models probe proves authentication only; analysis validates the evidence contract and never approves the agent. |
| Web | Tavily authenticated `GET /usage` probe; search/extract use the owned gateway. No actual search is performed just to display health. |
| Transactional email | Resend authentication, configured sender and actual verified sending domain. Queue acceptance is distinct from delivery. |
| Flights | Amadeus credentials and `FLIGHT_COMPARE_ENABLED`; public comparison and Agent Runtime use the same gateway. Read-only search, no booking/issuance. |
| Documents | Zero-row documents-table query and private-storage probe. Existing MIME, size, namespace and actor rules remain mandatory. |
| In-app notifications | Zero-row notifications-table query; idempotent inserts. Expected duplicates are healthy operations, not provider failures. |

Email Risk, GDS, NDC, Hotels, Visa supplier data, Currency, Geo, Payments,
Social, WhatsApp and production MCP are explicitly planned. Manual hotel offers,
readiness checklists, financial records and development MCP tools are not proof
of these external integrations. Reacher is evaluated, not installed.

## Deadlines, retries and degradation

- Probes: 4 seconds. Calls: 12 seconds; AI assistance 20 seconds and document
  analysis 60 seconds. Provider HTTP/S3 requests receive abort signals. The runtime
  also bounds its response when a dependency cannot cancel (e.g. an SQL query).
- Every current adapter has zero automatic operation retries. Writes/sends never
  retry, even if metadata is mistakenly set otherwise. The runtime supports a
  maximum of one extra attempt only for a future explicitly safe read.
- Existing AI routing can fail over from OpenRouter to OpenAI when both are
  configured. That is a separate-provider attempt inside the same overall
  deadline, not a same-provider retry or a guaranteed cost-free fallback.
- Document-upload/analysis requests never retry. Cleanup of already-created
  temporary OpenAI files is independently bounded and may retry idempotent
  deletion; cleanup failure does not discard a validated analysis result.
- Three provider failures open a local circuit for 30 seconds. A subsequent
  probe/call can recover after cooldown. A corrected configuration can be
  explicitly re-probed; a cached `NOT_CONFIGURED` result is not a permanent lock.
- Concurrent probes coalesce; normal reads reuse observations for 30 seconds.
  Circuit/cache/last success belong to the current warm runtime, not a durable
  global health service. The API and UI expose that scope explicitly.
- Agent drafting/document analysis have actor/IP request budgets and same-origin
  JSON boundaries. These budgets are process-local. External provider quotas
  remain the hard cost ceiling across serverless instances.
- Optional email failure does not disable password registration. Enabled password
  schema/origin failure or an enabled unavailable supplier fails public health
  closed. Unavailable flights return no invented live offers.

## Observability and admin UX

`capability_observed` is an internal event type, excluded from client event
allowlists. Its metadata contains only capability, probe/call, success/failure/
fallback, a fixed failure code and duration. No prompt, email, IP, input argument,
document key, signed URL, provider result or raw exception is retained. Observer
failure never breaks the business action.
The HTTP Referrer-Policy now matches the root document's `no-referrer` metadata,
including the initial request/render of legacy bearer-link pages.

`/api/tools` requires admin authorization and private/no-store responses. Explicit
POST refresh checks origin, limits probes and records only counts/failed
capability IDs in the audit. If the audit cannot persist, refresh returns 503
rather than falsely reporting an audited operation. Provider health probes are
read-only; this audit insert is the deliberate first-party write.

The Arabic admin panel separates implemented, available, blocked and planned
capabilities. It has bounded loading, actionable failure/retry, preserved prior
observations on refresh failure, and expandable operational detail. It follows
the existing SILA design system. Refero's subscribed MCP research was unavailable;
the previously reviewed public style references informed hierarchy only.
The neighboring growth desk uses JSON timestamp types, renders populated audit
history safely, and has bounded loading/error/retry instead of crashing the
entire review page or waiting indefinitely.

## Validation and release evidence

Meaningful runtime tests cover concurrency, configuration/phase gates, timeouts,
circuit recovery, write non-retry, denied actors and sanitized observations.
Health tests cover optional mail, critical password readiness, identity redaction
and client event spoofing. Existing ownership, account, evidence and marketplace
contracts run alongside them. Isolated PostgreSQL CI and Playwright desktop/mobile
tests exercise actual notifications and admin refresh/error recovery. Test admin
keys and cookies exist only in the isolated browser job; never in Production.

References: [Tavily usage endpoint](https://docs.tavily.com/documentation/api-reference/endpoint/usage),
[public pilot policy](./public-pilot.md), [password account security](./password-recovery-implementation.md).
