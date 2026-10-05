# SILA product and architecture map

Source-backed decision, 2026-10-05: develop the existing modular monolith. The
public pilot remains on the stable Vercel origin without a purchased domain.
The core promise is clearer travel preparation and contact with reviewed agents;
the product does not claim ticket issuance, visa approval or payment processing.

## Current core journeys

| Person | Entry and first useful result | Progression and boundary | Source |
|---|---|---|---|
| Guest traveler | `/readiness`: bounded checklist from submitted travel context. | Inspect published offers and verified agents; checklist is informational and evidence gaps remain unknown. | Readiness route/service, public marketplace DTOs and query predicates. |
| Registered traveler | `/join?role=traveler`: immediate email/password account. | `/account` shows only owned contact requests; security page changes password and rotates sessions. | Identity, password auth, account ownership queries. |
| New agent | `/join?role=agent`: name, email, password; city optional. | Account opens immediately with `pending` verification; edit profile and choose to submit evidence later. | Password auth, account UI, agent onboarding. |
| Agent seeking public trust | `/account/verification`: private evidence and review request. | Valid evidence and a recorded human decision are required for trusted status and public appearance; AI analysis is optional advice. | Agent verification/document evidence/AI review routes. |
| Approved agent | Own account and offers. | Submit a real offer; publication requires verified agent and review. Contact handling remains owner scoped. | Offer policies/routes, notification and contact-request services. |
| Trust administrator | `/review` behind a signed admin session. | Review agent evidence and offers; record reasons; inspect operating capabilities and funnel. | Admin auth, review desks, audit log and `/api/tools`. |

The first activation target is a real agent → reviewed identity → genuine offer
→ real traveler inquiry. Synthetic fixtures and successful CI do not count as
real acquisition or inventory. Until supply exists, readiness is the useful
public landing action and empty inventory is explicit.

## Modules and owned boundaries

| Module | Responsibility | Boundary / tests |
|---|---|---|
| Identity/account | Password/OAuth seams, roles, sessions, recovery and verification. | Same-origin bounded bodies, distributed HMAC-only auth budgets, transactional credential/session changes; password DB and browser suites. |
| Marketplace/trust | Public approved supply, private agent profile/evidence, human review, contact requests. | Owner/admin queries, public DTO redaction, size/MIME/namespace proof, transition/audit rules; marketplace/security/evidence suites. |
| Travel information | Readiness, dated sources, flight normalization/comparison, evidence confidence. | No unsupported visa assertion or invented price; currency and itinerary integrity; travel/domain tests. |
| Provider capabilities | Replaceable AI, Web, Email, Flights, Storage and optional services. | Typed metadata/status, real probes, bounded calls, safe fallback, fixed observability; capability tests and protected operations panel. |
| Agent execution | Policy → tool definition → provider → evidence → audit. | Read-only travel tools, fail-closed permissions and untrusted source handling; runtime/policy/contract suites. |
| Agency commercial workspace | Inquiry/opportunity → evidence-backed supplier option → versioned quote → delivery/response. | Membership and pilot gates; money in minor units, evidence freshness, immutable quote versions; native DB suites. |
| Service fulfillment pilot | Approved quote → service order → partner work → acceptance/rework → fee/refund records. | Explicit workspace allowlist, actor transitions and separate financial evidence; isolated DB/browser pilot suites. |
| Measurement/operations | Public funnel, internal status-duration events and reviewed actions. | No sensitive prompts/URLs/documents; private pages excluded from third-party analytics; internal events cannot be forged by clients. |

Agency workspaces, traveler intent workspaces and fulfillment are implemented
but separately gated pilots. Their source/test availability is not public
commercial activation. Financial evidence records are not live payment rails.
Keep these modules inside the existing Next.js/PostgreSQL app; extract a service
only when measured ownership/scaling needs justify it.

## UI, content and trust rules

- Preserve IBM Plex Sans Arabic, SILA's navy/blue/cream palette, existing brand
  marks, RTL layout and comfortable mobile controls. No imported template brand.
- Show one clear next action for each journey. Registration opens the account;
  verification explains later discovery/trust/publishing benefits.
- Keep visible field labels, inline errors, bounded pending states and recovery
  actions. Unsupported providers and planned capabilities remain explicit.
- Email starts unverified. A logged-in password user can change their password;
  email confirmation/recovery requires a controlled verified sender. Google is
  intentionally deferred and cannot silently take over a same-email account.
- Human review is distinct from automated evidence analysis. Do not invent
  response/review SLAs, provider readiness, confirmed flight/visa facts or users.

## Priority and release discipline

1. Preserve the working registration/account/security journey and its production
   origin. Email delivery is an optional sender prerequisite, not a domain-buying
   blocker for this pilot.
2. Observe actual capabilities and real funnel behavior, then onboard the first
   genuine agent and offer. Product evidence determines subsequent work.
3. Activate a real supplier only after credential/probe/search/evidence checks.
   Keep booking, payment and other integrations planned until implemented.
4. Expand public AI/agent features only where they improve a proved journey and
   retain permission, privacy, provider quota and audit boundaries.

Each release passes all seven CI jobs on the exact PR head before merge. Verify
the READY deployment's SHA and stable alias, then the live public/auth paths.
Database/browser fixtures run only in explicit disposable QA databases. No
production reset, guessed DNS ownership, fabricated verified agents or published
test offers. Deferred infrastructure claims in old reports are historical; this
map and the pilot/capability docs describe the current activation boundaries.
