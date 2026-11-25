# SILA — Marketplace & Direct-Confirmation Demo Playbook

**Status:** Draft for internal network and agency review  
**Approved operating model:** traveler request → one or more agency/provider offers → traveler decision → direct confirmation between traveler and provider outside SILA.  
**Not in scope:** SILA booking, checkout, payment collection, ticket/voucher issuance or settlement.

## 1. What the current marketplace slice demonstrates

SILA has two request entry paths that share the existing agency opportunity and quote system:

1. **Offer-specific inquiry:** traveler starts from a published offer; the request is routed to the offer's owning agency.
2. **Open multi-provider request:** traveler describes a service need once; SILA routes the request to up to five eligible agency workspaces; every agency receives its own scoped copy and can independently adopt it, prepare quote versions and respond.

For open requests, recipients are selected from active agency workspaces whose owner membership is active, whose agent is verified, whose current public trust evidence passes eligibility, and whose declared specialty explicitly matches the requested category. The current implementation routes to agency workspaces; it is not yet a direct airline/hotel/carrier account network.

The public request categories currently include flights, hotels, Umrah, packages, visas, cruises, transfers, activities and travel insurance. The request composer currently captures a shared core of travel details, dates, traveler counts, optional budget, priorities, constraints and notes. Category-specific fields (for example hotel room/board details or flight cabin/baggage requirements) are a follow-on contract, not yet a complete specialized form for every category.

## 2. The multi-provider demo path

Use the following path to demonstrate the central marketplace value to agencies and network partners.

### A. Traveler creates one request

1. Sign in using a synthetic traveler test account.
2. Open `/account/travel`.
3. Choose the service category, origin, destination(s), dates, flexibility, traveler counts, optional budget and preferences.
4. Review the explicit sharing consent. The interface says which request details are shared and confirms that contact details and private readiness data are not sent to competing agencies.
5. Submit the request.
6. Show the stable request reference and the exact number and identity of agency workspaces that received it. “Received” does not mean “accepted” or “submitted a quote”.

### B. Each agency works independently

1. Sign in using a separate synthetic agency account for each receiving agency.
2. Open the agency account and its inquiry inbox.
3. Show that each workspace sees only its own recipient row and scoped request details. The traveler is represented by a pseudonymous client record for this open-request path.
4. Adopt the request into the existing agency opportunity system. Adoption is idempotent and preserves the canonical request reference; it must not create a duplicate CRM.
5. Record supplier options and evidence using the existing supplier-option workflow. A manually supplied source remains labelled as manual; an agency claim is not independent supplier verification.
6. Create a versioned quote, add client-facing scope and terms, then activate secure delivery only when ready.
7. Repeat with a second agency to show independent proposals under the same traveler request.

### C. Traveler compares and decides

1. Return to the traveler account and open the request detail page from `/account/travel`.
2. Show the provider response states, quote versions, totals, line items, validity and client-facing terms.
3. Explain that currencies are displayed separately; the interface does not invent FX conversion or a single “best” result when currencies differ.
4. Explain that same currency does not automatically mean comparable scope. The traveler should inspect inclusions, dates, occupancy/passenger counts, cancellation terms and other conditions.
5. The traveler can approve, decline or request changes on a specific active quote delivery. The response is recorded against that exact version and the agency is notified.

### D. Direct confirmation outside SILA

1. After the traveler approves an exact quote version, the agency may record an attributed report of direct contact with the named provider.
2. The agency report is linked to the exact quote delivery/version and contains only a provider name, contact channel and short non-sensitive summary.
3. The traveler can acknowledge or dispute the agency report once.
4. The interface must continue to say that an approval is a decision, not a booking. The direct-confirmation report is not proof of a reservation, ticket, voucher, payment or independent supplier verification.

## 3. Roles and demonstration accounts

| Role | What to demonstrate |
|---|---|
| Traveler | Request creation, consent, recipient list, request history, quote comparison, approve/change/decline and direct-contact acknowledgement |
| Agency A | Scoped inbox, request adoption, supplier option/evidence, quote version and delivery |
| Agency B | Independent receipt and separate quote version for the same request |
| Admin/moderator | Agency and offer review, community moderation, audit and release controls |

Prepare synthetic demo accounts for all roles. Use at least two agency workspaces to demonstrate competing offers. Do not use real traveler identity documents, passport numbers, passwords, payment details, ticket/PNR references or supplier credentials in fixtures or partner presentations.

## 4. Truthful status language

- **Request sent:** the request was routed to an eligible agency workspace.
- **Request viewed:** that workspace viewed the request.
- **Agency accepted/adopted:** that agency chose to work on the request; this is not a quote.
- **Quote shared:** a specific immutable quote version was activated for the traveler.
- **Traveler approved:** the traveler approved that exact quote version; no booking occurred.
- **Agency reported direct contact:** the agency submitted an attributed report about its communication with a named provider.
- **Traveler confirmed / not confirmed:** the traveler acknowledged or disputed that report.
- **Supplier confirmed directly:** only the traveler and supplier can confirm this outside SILA; SILA stores the attributed report and acknowledgement, not a supplier-certified booking status.

Never use “Booked by SILA”, “Ticket issued”, “Paid”, “Guaranteed availability” or equivalent wording in this operating model.

## 5. Preview setup and release gates

The relevant feature flags are:

- `TRAVELER_WORKSPACE_ENABLED=false`
- `MULTI_PROVIDER_REQUESTS_ENABLED=false`
- `DIRECT_CONFIRMATION_ENABLED=false`

All remain false by default. The multi-provider slice adds `db/phase10_multi_provider_requests.sql`; direct confirmation is introduced by `db/phase9_direct_confirmation.sql`. The release manifest is at schema version 11 and records the required migration order.

Before a Preview/demo run:
1. Confirm the target is an isolated Preview/demo database, not Production.
2. Apply the required additive migration chain in the order recorded in `db/release_manifest.json`, starting from the correct schema baseline.
3. Verify the resulting schema version and all migration integrity checks.
4. Only then enable the three flags in the Preview/demo environment.
5. Test role isolation, request consent, the five-recipient database limit, agency-specific inbox visibility, adoption idempotency, quote-version access, one-time traveler response, expired links and direct-confirmation ownership.
6. Revert or disable Preview flags after the demonstration unless the environment is intentionally retained for continued testing.

No Production migration, flag change, secret update or deployment is part of PR #114. Do not treat the existence of code or passing CI as permission to enable the feature in Production.

## 6. Current product boundaries and next work

The multi-provider request path is implemented in the PR #114 review branch, but it is not merged or live. Its recipient model currently targets eligible agency workspaces (agent-linked), rather than direct supplier accounts such as an airline, hotel or transport operator holding its own SILA workspace.

The shared request form is a useful pilot foundation, but category-specific request contracts and quote comparison fields still need to be completed before presenting SILA as a deeply specialized marketplace for every service type. For example:
- Flight: airport/route identifiers where needed, cabin, baggage and stop preferences.
- Hotel: check-in/out, room count, occupancy, room type, board and cancellation needs.
- Visa: destination, purpose and application constraints; never collect passport numbers or document scans in the RFQ.
- Transfer: pickup/drop-off, passenger/luggage counts and vehicle class.
- Activity/cruise/Umrah/package/insurance: category-appropriate dates, service scope, inclusions and constraints.

The category-specific contract is tracked separately so it can be designed and tested without destabilizing the multi-provider request and quote workflow.

Community and provider-directory improvements remain separate review workstreams. They must retain their own moderation, privacy, schema and release gates; they are not represented as merged or live by this PR.

## 7. Partner-demo acceptance checklist

- [ ] Two agency test accounts can receive the same traveler request under separate workspace scopes.
- [ ] One traveler request has one stable reference and no more than five recipients.
- [ ] Recipient selection requires an active workspace, active owner membership, verified agent, current public trust evidence and an explicit specialty match.
- [ ] The traveler consents before request details are shared.
- [ ] Competing agencies do not see traveler email, phone, passport or private readiness data.
- [ ] One agency cannot read or adopt another agency's recipient row.
- [ ] Adoption creates one workspace-scoped opportunity and keeps the canonical request lineage.
- [ ] Each agency can create and deliver its own versioned quote.
- [ ] The traveler sees only activated, client-facing quote details.
- [ ] Currencies and materially different scopes are not falsely ranked as directly comparable.
- [ ] The traveler can respond to the exact quote delivery once.
- [ ] Direct-confirmation is available only after approval of the exact quote version.
- [ ] The agency report and traveler acknowledgement remain separately attributed.
- [ ] Every screen has tested loading, empty, error, disabled, expiry and keyboard-focus states on desktop and mobile.
- [ ] Production remains unchanged; Preview migration and flags have separate approval.

## 8. External product patterns worth studying

These are references for product patterns, not code dependencies and not instructions to copy a competitor's full commercial model.

- **EgTravelMarket (Egypt):** a close local reference for a traveler describing a custom trip/service need and receiving tailored proposals from travel professionals. Study the request form, provider eligibility, categories and competing proposal presentation. SILA keeps its own consent, evidence and direct-confirmation model. References: https://www.egtravelmarket.com/ and https://www.egtravelmarket.com/travel-request.html
- **TourRadar — operator general requests:** useful reference for a request not tied to an existing tour, operator responses in an inquiry context, and converting an inquiry into a versioned quote. Reference: https://help.tourradar.com/en/operators/how-do-i-respond-to-a-general-question-or-convert-the-question-into-a-quote
- **TourRadar — Booking Conversation Page:** useful reference for conversation context, question history and follow-up entry points. SILA borrows contextual communication patterns without moving booking/payment into the platform. Reference: https://support.tourradar.com/faq/what-is-the-booking-conversation-page-and-how-do-i-find-it
