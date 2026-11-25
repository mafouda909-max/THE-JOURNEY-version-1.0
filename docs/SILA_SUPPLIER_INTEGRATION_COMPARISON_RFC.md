# SILA — Supplier Integration & Unified Comparison RFC

**Status:** DRAFT — source-backed architecture proposal; not an approved integration or commercial commitment  
**Date:** 25 November 2026  
**Product scope:** one Arabic-first marketplace with one comparison experience across external supplier sources and SILA provider/agency offers  
**Repository baseline inspected:** \`main\` at \`fde60ef182e3fb4c24e2f1d6c36feb8f2e3e62aa\`

## Executive decision

SILA should **extend the existing comparison experience**, not build a second booking engine or a duplicate marketplace.

The intended experience is a unified decision surface:
- Search a travel service once.
- Query only the sources actually connected and authorized for that service and market.
- Normalize supplier results into a category-specific comparison model.
- Show source, observation time, price basis, conditions, exclusions and confirmation status beside every result.
- Compare live supplier results separately from SILA-listed agency/provider offers and manually returned quotes.
- Revalidate supplier price and availability before any commitment. A search result is not a hold, booking, ticket, voucher or payment.

The screen can be unified while the underlying contracts remain category-specific. A flight is not a hotel room, and a visa-service quote is not a government visa decision.

## 1. Current repository implementation — verified, not assumed

The inspected mainline already contains a first version of the flight comparison surface:

| Area | Current implementation | Boundary |
|---|---|---|
| Flight supplier | \`src/lib/travel-suppliers/amadeus.ts\` | OAuth client-credentials adapter for Amadeus Self-Service and Flight Offers Search |
| Normalization | \`src/lib/travel-suppliers/amadeus-normalize.ts\` | Maps returned flight offers to a canonical flight shape; preserves source and checked time |
| Supplier registry | \`src/lib/travel-suppliers/index.ts\` | The registry currently contains Amadeus only |
| Shared gateway | \`src/lib/provider-gateway.ts\` | Routes flight reads through the capability runtime and returns explicit unavailable states |
| Comparison logic | \`src/lib/travel-comparison.ts\` | Ranks current-query results by price only when currencies match, and shows duration/stops/source/freshness |
| Public page | \`src/app/compare/page.tsx\` | Existing comparison route, with an honest default-off state |
| Search API | \`src/app/api/travel/compare/route.ts\` | Flight search only; validates airport IATA codes, dates and 1–9 adults; no booking operation |
| User workbench | \`src/components/market/FlightCompareWorkbench.tsx\` | Flight-only inputs and comparison cards |
| Feature gate | \`.env.example\` | \`FLIGHT_COMPARE_ENABLED=false\` by default |

The Amadeus adapter calls the Flight Offers Search endpoint. The current route does **not** call Flight Offers Price to revalidate a selected result, does not create an order/PNR, and does not issue a ticket. The current supplier registry contains one adapter, so it is not yet a multi-source flight comparison.

The repository also defines separate capability IDs for flights, GDS, NDC and hotels. The capability catalog marks flights as implemented through Amadeus Self-Service, while GDS, NDC and hotel supplier connections are not implemented. A capability ID or admin-panel row is not proof that an external provider is connected.

Static repository inspection cannot establish whether secrets exist in a hosting environment or whether an account has been approved by a supplier. Do not infer a live connection from code, an environment template, a successful CI run or a successful OAuth probe alone.

## 2. Keep the provider concepts separate

These names represent different layers and must not become duplicate vendor adapters:

| Name | What it is | How SILA should treat it |
|---|---|---|
| Amadeus Self-Service | Developer API product; the current flight-search adapter uses it | Existing flight source. Keep and improve it rather than rewriting it |
| NDC | IATA airline offer/order data-exchange standard | A distribution standard, not a vendor account or one universal endpoint |
| Amadeus NDC[X] | Amadeus Travel Platform capability that aggregates airline NDC content through its travel-seller ecosystem | A separate commercial/technical access path; assess airline coverage, market eligibility, servicing and contract before building an adapter |
| Booking.com Demand API | Booking.com partner API for supported travel services | Separate supplier adapter, initially relevant to accommodation and supported non-flight services |

IATA describes NDC as an XML-based data-exchange standard based on Offer and Order processes. The standard may be implemented by airlines, technology providers or intermediaries; choosing “NDC” alone does not identify a source to connect.

Amadeus presents NDC for travel sellers through its Travel Platform and describes NDC[X] as standardizing content sourced from multiple airlines. That does not make NDC[X] the same API as the existing Amadeus Self-Service adapter.

## 3. Supplier capability and access matrix

| Source | Useful SILA category | What is documented | Access and implementation consequence |
|---|---|---|---|
| Amadeus Self-Service | Flights; selected hotel APIs may be evaluated separately | Existing SILA code searches flight offers. Amadeus documents separate search, pricing, order and management APIs | Search is a distinct capability from booking/issuance. Preserve the existing adapter; add price revalidation before any action and validate the exact production market/account permissions |
| Amadeus NDC[X] | Flights | Amadeus positions NDC content inside its travel-seller platform; the exact airline, market and servicing capability varies | Requires a separate Amadeus commercial/access review. Do not assume the current Self-Service credentials expose NDC[X] |
| Booking.com Demand API | Stays, car rental, attractions and transfers | Booking's current Demand API page lists these services and marks flights as “Coming soon”. It offers content-only, search/look/redirect and search/look/book patterns where available | Demand API prerequisites include Managed Affiliate Partner status, Partner Centre access under an agreed contract, an API key and an Affiliate ID. Start with permitted search/look/redirect, not internal booking |
| Direct airline NDC | Flights | An airline may expose NDC services directly or through approved aggregators | Each airline and market can have its own onboarding, schema version, content and servicing limitations. Do not create a generic “NDC connected” badge |
| SILA agencies and existing offers | Packages, Umrah, visa assistance, flights, hotels, cruises and other provider-led services | Existing public offers, contact requests, agency opportunities, supplier options and quote versions already exist | Include these as a clearly separate “SILA providers / agency offers” lane. A published or manually quoted price is not a live supplier result |

### Important market constraints

1. Booking.com lists flights as coming soon on its current Demand API landing page. Do not use Booking Demand as a flight source until the official product documentation and partner account confirm flight capability is available.
2. Booking Demand API testing requires Managed Affiliate Partner onboarding, Partner Centre access and credentials issued for that partner account. A public developer page does not grant API access.
3. Amadeus Self-Service documents selected published-rate coverage and limitations in its FAQ; it should not be described as every airline or every negotiated fare.
4. Amadeus's published Flight Create Orders production guide currently lists Egypt among markets where that Self-Service booking API is unavailable. It also requires a ticket-issuance agreement with a consolidator for non-certified businesses. The guide shown by Amadeus is last updated 23 October 2025, so confirm the current position with Amadeus before relying on it; for planning in Egypt, do not assume Self-Service flight ticketing is available.
5. Amadeus NDC[X] coverage is carrier- and market-specific. For example, JAL's 2026 announcement lists selected eligible countries/regions for its NDC connection; Egypt is not on that carrier-specific list. This is an example of why coverage must be verified per airline and market, not a blanket statement about all NDC content.

## 4. Unified comparison contract

Use a common envelope with typed category payloads. Do not force all services into one unvalidated JSON object.

### Shared offer envelope

Each returned option should carry:
- Stable source-qualified option ID; never use a provider's raw ID as a global SILA ID.
- Category and category-schema version.
- Source/provider identity and connection type (supplier API, airline NDC, SILA provider, agency quote, or redirect partner).
- Source reference and the query/session reference where the provider permits safe retention.
- Observed time, source-provided expiry/validity if present, and a derived freshness state.
- Price amount, ISO currency, price basis, included/excluded tax/fee state, and any conversion metadata.
- Availability state: live search result, provider-reported, request-required, stale, unknown or unavailable.
- Terms and restrictions, with explicit unknown values where the source omits details.
- Next action: inspect, revalidate, redirect, inquire, or book only when a separately approved booking capability is actually available.

### Category-specific comparison payloads

**Flights**
- Exact origin/destination airport codes, outbound and return dates.
- Ordered segments, local departure/arrival times, carrier/flight number, stops and total duration.
- Passenger mix (adults, children and infants) and cabin.
- Fare family, baggage by passenger/segment where returned, and change/refund rules only when confirmed.
- Total price and currency for the exact passenger mix; tax/fee inclusion disclosed.
- Supplier offer reference and revalidation requirement.

**Hotels**
- Stable property identity and location.
- Check-in/check-out, local time zone where available, room count and occupancy.
- Room type, board basis and rate plan.
- Total stay price, taxes/fees included/excluded/unknown, cancellation and prepayment policy.
- Property identity is not room availability; availability is date-, room- and occupancy-specific.

**Transfers and activities**
- Pickup/drop-off or activity location, date/time, party size, service scope and duration.
- Capacity, included items, exclusions, cancellation terms and total price.
- Service provider, source and confirmation mode.

**Visa assistance, packages, Umrah and cruises**
- Continue to use accountable SILA agencies/providers and evidence-backed offers until a real supplier or authoritative service source is approved for the relevant market.
- Keep government fees separate from provider service fees; never present an agent's estimate as a visa approval or official decision.
- Packages and Umrah offers must itemize included services rather than imply that a flight/hotel/visa connection covers the whole package.
- Cruise results require sailing-, cabin- and itinerary-specific sourcing; a generic cruise category is not inventory.

### Comparability rules

- Only label an option “lowest price” when the query scope, passenger/occupancy basis, currency and included price components are comparable.
- Never sort EGP, SAR, USD and EUR as if the raw amounts shared a currency. If FX conversion is later added, preserve the original amount and show the conversion source/time/rate separately.
- Do not compare a room-only rate with breakfast-included as if the offers were identical; show the board basis and cancellation policy.
- Do not compare a flight fare when baggage, passenger mix or itinerary coverage is unknown as if it were identical to a fully specified fare.
- Keep external live search results distinct from provider-declared listings and agency quotes. All may appear in one decision journey, but their evidence and next action labels must remain different.

## 5. Intended user experience

Keep the existing flight comparison URL and workbench compatible. Extend the marketplace navigation into service-specific comparison journeys rather than replacing the current page with a large universal form.

A comparison journey should have:
1. One service-specific search form, prefilled only from a traveler-owned Saved Intent where the existing ownership checks permit it.
2. Source status chips showing connected, not configured, gated, unavailable or partial results per supplier.
3. A comparison table/cards with category-specific facts and a prominent source/time label.
4. Filters and ranking that only use facts actually returned by providers.
5. A separate section for SILA agency/provider listings and quotes, carrying the responsible provider and response/validity state.
6. A clear next action: supplier redirect, provider inquiry, request-for-quote or a booking action only after a separate transaction workflow is approved.

Do not show unavailable integrations as empty fake cards. A failed source should not erase successful results from other sources.

## 6. Runtime architecture

1. **Search intent:** validate one category-specific request at the route boundary.
2. **Source registry:** select adapters whose category and environment gates are enabled.
3. **Parallel supplier search:** use bounded requests and isolate source failures; a single supplier timeout must not erase other suppliers' successful results.
4. **Normalization:** map each adapter response into the same category contract, preserving raw provider references only where needed for the next allowed operation.
5. **Comparison service:** apply category-specific comparability and ranking rules; no cross-category or cross-currency false ranking.
6. **Presentation:** render returned options, status and source disclosures; do not infer data missing from the supplier.
7. **Revalidation:** before a redirect or a transactional action, call the provider's price/availability recheck endpoint where available. If the value changes, show the new terms and request a fresh user decision.
8. **Existing SILA handoff:** route agency/provider offers into the existing listing/detail/contact-request/opportunity/quote lineage. Do not create a second CRM, inquiry or quote database.
9. **Persistence:** keep supplier search results short-lived unless a separately justified, privacy-reviewed saved-search/quote feature is approved. Keep traveler trip context in the existing Saved Intent/Traveler Workspace; do not store supplier tokens in client data.
10. **Operations:** credentials stay in server-side secret storage; redact provider tokens and raw personal data from logs; set per-source quotas, bounded deadlines, timeout behavior, circuit state and explicit no-results/fallback states.

## 7. Recommended delivery sequence

### Slice A — prove the existing Amadeus flight comparison
- Inspect the current adapter and workbench; do not replace them.
- Validate sandbox OAuth and Flight Offers Search against a small test matrix.
- Add/verify price revalidation through the Amadeus pricing endpoint before any external action.
- Record known coverage limits and passenger-data limitations in the UI.
- Keep the production feature gate off until account access, live supplier probe, search results and desktop/mobile behavior have been reviewed.
- Do not add flight create-order or ticket issuance to this slice.

### Slice B — add Booking.com stays through Demand API
- Confirm Managed Affiliate Partner status, contract, Partner Centre access, API key, Affiliate ID and sandbox permissions.
- Start with the documented search/look/redirect journey for accommodation.
- Normalize property, dates, room/occupancy, board, total price, taxes and cancellation terms.
- Use a Booking redirect/deep link only when the partner flow supplies an authorized destination and terms permit it.
- Treat booking and post-booking management as later separate capabilities.

### Slice C — evaluate Amadeus hotel content
- Confirm the specific hotel API product, data scope, commercial terms and market coverage.
- Compare against Booking results only after aligning the property identity, room, date, occupancy, meal plan, tax and cancellation basis.
- Deduplicate the same property/rate only where a grounded property/rate identity exists.

### Slice D — evaluate Amadeus NDC[X] or another approved NDC aggregator
- Request the actual travel-seller onboarding and commercial terms.
- Obtain written airline list, market/country eligibility, passenger type coverage, fare/ancillary coverage and supported shopping/price/order/servicing operations.
- Check whether Egypt-origin and Egypt-sold journeys are included for each target airline.
- Implement it as a distinct flight adapter behind the existing category-neutral source boundary, not as a second copy of the Amadeus Self-Service integration.
- Compare NDC and GDS/legacy results only after their fare and servicing differences are accurately represented.

### Slice E — unify SILA agency/provider offers
- Show approved public offers in the same traveler decision path but label them as SILA provider-published, quote-required or agency-confirmed.
- Preserve the current inquiry snapshot, Saved Intent link, agency opportunity and immutable quote version workflow.
- Keep price basis, validity and source visible.

### Slice F — transactional capabilities, separately gated
Only after commercial/legal and operational approval should SILA consider holds, booking/order creation, ticketing/vouchers, customer payment, refunds, cancellations and reconciliation. Each needs a responsible supplier/merchant, support process, authorization, contract, audit trail, tests and rollback. Search integration alone does not authorize these operations.

## 8. Decisions required before provider activation

- Is SILA initially a comparison/redirect marketplace, a request-for-quote marketplace, or a booking intermediary for each category?
- Which legal entity contracts with each supplier and receives commission/fees?
- Who is responsible for customer service, price changes, cancellations and refunds?
- Which provider credentials and access scopes are available for Egypt and target source markets?
- Which airline/NDC provider list is required for an MVP, and which carriers are explicitly out of scope?
- Which external source is allowed to store a traveler search reference, and for how long?
- What public disclosure is required for affiliate links, commercial ranking and provider-sponsored placements?

**Recommended pilot posture:** read-only search + comparison + authorized redirect for contracted external sources, with SILA provider inquiry/agency quote alongside it. Do not take customer funds or claim a completed booking in the first integration slice.

## 9. Official source references

- [Booking.com Demand API — product scope and integration flows](https://developers.booking.com/demand)
- [Booking.com Demand API — prerequisites](https://developers.booking.com/demand/docs/getting-started/prerequisites)
- [Booking.com Demand API — authentication](https://developers.booking.com/demand/docs/development-guide/authentication)
- [Amadeus for Developers — Self-Service API tutorials](https://admin.developers.amadeus.com/self-service/apis-docs/guides/developer-guides/resources/)
- [Amadeus for Developers — moving to Production and Flight Create Orders requirements](https://amadeus4dev.github.io/developer-guides/API-Keys/moving-to-production/)
- [Amadeus for Developers — API FAQ and data/booking limitations](https://admin.developers.amadeus.com/self-service/apis-docs/guides/developer-guides/faq/)
- [Amadeus — NDC for travel sellers](https://amadeus.com/en/travel-sellers/content/ndc-travel-agents)
- [IATA — Distribution with Offers & Orders (NDC)](https://www.iata.org/en/programs/airline-distribution/retailing/ndc/)
- [Japan Airlines — NDC connection and Amadeus NDC[X] market-specific announcement](https://www.ndc.jal.com/en/top.html)

The source references describe provider products and current public documentation; they do not establish that SILA has a partner agreement, credentials, airline coverage or access to production inventory.


## 10. Verify agent-submitted offers before comparison

The marketplace must also validate the offer a SILA agent has submitted; it is not enough to show the supplier's alternatives.

- Require exact category-specific match fields and a source/offer reference when the source provides one.
- Prefer the exact supplier offer lookup/revalidation path. When no source reference exists, an authorized search can find candidate matches but a similar result is not proof of the same fare, room or service.
- Preserve immutable, time-stamped verification observations tied to the submitted offer version.
- Public statuses distinguish exact matched and repriced, price changed, partial match, source-confirmed but not repriced, agent-declared only, not found/unsupported, mismatch/review and expired evidence.
- A failed or empty search does not prove fraud where the external source has incomplete or negotiated-rate coverage.
- The comparison board shows the agent's offer and supplier alternatives in the same decision journey, but keeps their source/evidence lanes separate.

Detailed submission schema, exact matching keys, verification lifecycle, pricing concepts, category/source restrictions, and Premium rules: [SILA Agent Offer Verification & Policy-Based Pricing RFC](./SILA_AGENT_OFFER_VERIFICATION_AND_PRICING_RFC.md).

This verification proposal is separate from booking/ticketing. No supplier search result becomes a confirmed booking, ticket, voucher or government decision.
