# SILA domain audit: one core, incremental expansion

2026-10-05. Audit of `production_schema.sql`, `agency-schema.ts`, the release
manifest, commercial commands, fulfillment SQL, provider gateways, agent runtime
and readiness. This develops the existing modular monolith. It is not a new
schema or a claim that all gated modules are activated in Production.

## Existing concepts and the smallest next decision

| Target concept | Current implementation | Reuse / real limitation |
|---|---|---|
| Traveler | `accounts`, `traveler_saved_intents`, owned inquiry links | Keep account ownership independent of email matching. Saved intent is the shared travel context. |
| Agent | `agents`, `accounts.agent_id`, private professional workspace | Registration, profile preparation, review and public approval are separate states. Keep this entry useful before evidence. |
| Agency | `agency_workspaces`, `agency_memberships` | Existing tenant/membership boundary; do not create another agency system. One owner-agent workspace is currently constrained; reconsider only for measured multi-agency ownership. |
| Supplier | `agency_supplier_options`, fulfillment `partner_account_id` | A supplier option is a dated commercial claim, not a verified supplier business. Reuse assigned accounts for partner work; a reusable supplier identity/catalog waits for real demand. |
| Service | Supplier/quote line categories and `sila_service_orders` | The gated service pilot already connects a sold line to delivery. Avoid a parallel B2B catalog or a new service hierarchy now. |
| Offer | `offers`, agency marketplace projections | Public discovery is distinct from a private proposal and human review remains required. Reuse the existing explicit projection boundary. |
| Proposal | `agency_quotes`, immutable `agency_quote_versions`, delivery/client response loop | Existing versioned quote is the proposal aggregate. Sharing is tied to a specific version. PDF/WhatsApp presentation must retain that version and scope; don't invent another proposal table. |
| Inquiry | `contact_requests`, owned status transitions, marketplace adoption | Keep idempotent adoption into an agency opportunity; never duplicate the platform inquiry as a separate CRM record without the source reference. |
| Client / Lead | `agency_clients`, `agency_opportunities.source` | Manual/referral/repeat/partner sources already support outside-platform clients. WhatsApp/Facebook are acquisition channels within that workflow, not new products or mandatory platform accounts. |
| Requirement | Versioned intent snapshots, readiness checklist, fulfillment requirements | Requirement assessment is currently computed from context. Persist an assessment only when an owned journey needs history; no speculative requirements table. |
| Evidence | `agent_documents`, `travel_facts`, `travel_knowledge`, supplier provenance, quote snapshots, service evidence | Evidence is already stored in module-owned records. Generalize the read/decision contract first; keep private storage keys and owner/tenant enforcement local. |
| Verification | Agent/document states, review timestamps and `audit_log` | State is a recorded decision, not an unlimited truth claim. Identity, activity/license and offer review require separate scope. Individual reviewer identity is not recorded by the shared-key admin actor today; don't invent one. |
| Destination | Travel knowledge countries, intent destinations, offer/flight locations | Existing contextual values are adequate. A destination catalog needs actual reference data and identifier/language rules, not a table of unsourced names. |
| Travel Option | Canonical flight results, supplier options, immutable quote lines | Preserve provider/source, money in minor units and observed/valid-until timestamps. An option doesn't imply availability or ticket issuance. |
| Transaction / Order | Accepted quote outcome, service orders, financial evidence | Recorded orders and fee/refund evidence are not live payment rails or confirmed ticket issuance. Keep those boundaries explicit. |
| Conversation | Inquiry message/status, commercial activities, proposal response | A full chat conversation model is not implemented. Use the existing follow-up record until a real multi-message workflow needs persistence. |
| Notification | Owned `notifications`, idempotency keys | Existing mechanism covers account state and inquiry updates. Keep counts scoped and distinguish successful read state from a failed request. |
| Review / Reputation | `reviews`, visible aggregates | Display actual recorded reviews only. A contact interaction is not proof of a completed trip; don't promote the historical transaction flag into a travel guarantee. |
| Provider / External Source | Provider adapters/gateways, capability registry, agent evidence | Amadeus/GDS/Web/AI are replaceable capabilities. Provider connection, returned claim and verified travel rule are separate facts. AI synthesis is never the source. |

Source anchors: `src/db/schema.ts`, `src/db/agency-schema.ts`,
`db/service_fulfillment_pilot.sql`, `src/lib/commercial-service.ts`,
`src/lib/quote-delivery-public.ts`, `src/lib/public-agent.ts`,
`src/lib/agent-runtime/contracts.ts`, `src/lib/provider-gateway.ts` and
`src/lib/travel-intel.ts`.

## Evidence is a decision contract, not a giant polymorphic table

The current records can already preserve several important fields:

| Record | Existing information | Missing / must not infer |
|---|---|---|
| Agent document | Kind, agent FK, private key, created/verified/expiry timestamps, review status | Issuance/source authority, explicit review scope and individual reviewer. Upload receipt proves transfer only. |
| Travel knowledge/fact | Source/type/reference, retrieval/check/expiry timestamps, freshness/status | Exact applicable travel-document/purpose/date conditions; authority/freshness labels alone don't establish truth. |
| Supplier option / quote line | Workspace/opportunity, source type/reference, observed/expiry times; immutable snapshot | Supplier-reported price is not confirmed inventory, license, financial settlement or service outcome. |
| Agent runtime evidence | Source/type, observed time, freshness and supported claims | Retrieval time is not verification time. Add explicit scope/expiry only when the provider can supply it. |
| Service evidence | Order/account references and delivery evidence | A submitted file is not accepted fulfillment or a financial entitlement. Preserve the existing human transition rules. |

Use an additive module-neutral read contract with evidence kind, linked entity,
source/reference, issued/observed/verified/valid-until times, supported scope,
limitations, status and reviewer **when known**. Unknown fields stay null.
Adapter functions project existing records; they don't merge ownership models,
replace database foreign keys or expose KYC documents publicly. First consume
that contract in readiness, then trust summaries; migrate only where an actual
workflow cannot preserve needed information in its current record.

## Concrete gaps, ordered by the core loop

1. **Browser document transfer:** a live CORS preflight failed after server PUT
   succeeded. Repair provider transport and prove it; listing/health/READY alone
   is insufficient. See `private-storage-browser-release.md`.
2. **Readiness decision accuracy and bounded failures:** the current UI has
   placeholder-only fields and no client request deadline, shows a percentage
   without a decision scope, and omits visa source/timestamps. Stored freshness
   labels are accepted without checking actual expiry/check time or all query
   conditions. A non-required visa can yield READY while passport confirmation
   remains unresolved. Fix these core decisions before adding capabilities.
3. **Scoped agent trust:** PR #52 replaces the generic public badge with a
   projection derived from current reviewed identity/activity/entity evidence.
   It exposes scope, review time, recorded validity and limitations without
   license numbers, filenames or storage identifiers. Public discovery,
   offer/inquiry/comparison gates and ranking now fail closed when required
   evidence is missing or stale. This remains a release claim only after the
   exact-head database, browser, mobile and production-build gates pass.
4. **Audit consistency:** the audit found profile update and its audit ran separately.
   The bounded upload repair makes this pair transactional and adds a real
   database rollback test, alongside reservation/audit atomicity. This strengthens
   existing behavior rather than introducing a new feature.
5. **Commercial activation:** genuine identity/activity evidence, genuine offer
   review, a real traveler inquiry and the traveler-visible outcome remain a
   Production gate. Approved fixtures in isolated CI prove mechanics only.

## Release and architectural decisions

- No new table, dependency or migration is justified by this audit alone.
  Existing dated records can support the first evidence/scope corrections.
  Any later schema change gets a small compatible migration and an upgrade test.
- Maintain the existing module boundaries inside the same app/database.
  Commercial opportunities, quotes and service delivery already provide the
  basis for private agent work and eventual partner buying/selling.
- Keep agency/fulfillment pilots gated until their own live journey is proved;
  their presence in source and isolated tests doesn't authorize public rollout.
- Preserve the SILA design system. The eight owner screenshots show oversized
  empty-market surfaces and readiness answers without visible source/scope.
  The useful next change is clearer bounded decisions, not fictional supply or
  decorative dashboards. Flight comparison stays unavailable without a real
  configured supplier.
- A permanent READY/verified badge conflicts with changing evidence. Treat
  Trust as Evidence + Scope + Freshness, with explicit confirmation/unknown
  outcomes and a next action. This is how “اعرف قبل أن تختار” becomes behavior.

## Implemented compatible core increments

The owned private gateway repair closes the live small-file browser transport
gate with 20 canonical checks (see private-storage-browser-release.md).
Profile/reservation audit atomicity has real rollback coverage. The readiness
increment consumes the Evidence read projection from existing records, checks
actual freshness/scope/conflicts and provides explicit source/limits/next action.
It changes no schema, provider ownership boundary, public supply or design tokens.
See readiness-evidence.md for scope, runtime deadlines and compatibility rules.

Scoped agent identity/activity/license summaries and approval expiry remain a
next core correction; the current public verification boolean is not yet a full
Evidence + Scope + Freshness public trust projection. Genuine commercial
activation remains unproved and must not be replaced by synthetic approvals.
