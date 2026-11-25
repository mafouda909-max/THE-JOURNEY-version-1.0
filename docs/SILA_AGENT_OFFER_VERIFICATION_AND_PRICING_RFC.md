# SILA — Agent Offer Verification & Policy-Based Pricing RFC

**Status:** DRAFT — product and architecture proposal; not approved for schema or commercial activation  
**Date:** 25 November 2026  
**Applies to:** provider/agency listings, source-backed supplier offers, comparison, agent fees and traveler-facing price display

## 1. Product intent

SILA should not simply accept an agent's uploaded offer as an independently verified market fact.

An agent submits a service offer. SILA checks whether the exact flight, ticket, room, transfer, activity or other service can be found and revalidated through an authorized external supplier system. SILA then compares that verified service with genuinely comparable alternatives and calculates a permitted, disclosed selling price under the applicable supplier and SILA pricing policy.

This creates three connected but separate capabilities:

1. **Offer verification:** is the service the agent described actually represented by an authorized source, with the same critical attributes?
2. **Market comparison:** how does that exact service compare with valid alternatives on source, total cost, terms and service quality?
3. **Commercial pricing:** what may the agent charge above the supplier's payable price, after taxes/fees and contract restrictions?

The result is not a claim that SILA booked or issued the service. Search, verification, price revalidation, booking confirmation and ticket issuance are distinct events.

## 2. Agent submission contract

The agent must submit a typed service offer, not just a title, image and free-form price.

### Shared submission fields
- Service category and accountable provider/agency.
- Destination/route and service coverage.
- Exact date/window and local time where relevant.
- Passenger/guest/party mix, counts and occupancy.
- Supplier/source name and authorized source reference, if available.
- Provider's quote/offer/booking reference when the source provides one.
- Price, currency, price basis and whether taxes/mandatory charges are included.
- Inclusions, exclusions, restrictions, cancellation/change terms and validity.
- Evidence reference and observation time; upload evidence only through the existing private evidence controls.
- The agent's proposed customer-facing fee/markup, separated from the supplier price.

Do not request supplier account passwords. Where provider-specific access is needed, use an approved OAuth/partner credential flow or a secure, tenant-scoped integration credential. Never store partner secrets in offer descriptions, browser storage or public DTOs.

### Category match keys

**Flight / ticket**
- Origin and destination airports (IATA codes), date and local times.
- Ordered flight segments, operating/marketing carrier and flight numbers.
- Passenger mix/ages and passenger count.
- Cabin, booking class/fare family where available.
- Baggage entitlement, taxes, refund/change/no-show terms.
- Supplier offer ID/reference and validating carrier where returned.

**Hotel**
- Property identity/ID and location.
- Check-in/out, room count and exact occupancy.
- Room type, rate plan and board basis.
- Cancellation/prepayment terms.
- Mandatory taxes/fees and final stay-price basis.
- Supplier product/rate reference where returned.

**Transfer / activity / ground service**
- Accountable service provider, exact location/route, service date/time.
- Party size, vehicle/class or activity variant, duration and capacity.
- Included/excluded service components and cancellation terms.
- Supplier service/product reference and price basis.

**Package / Umrah / cruise**
- Itemize material components (flight, property, transfer, cruise sailing/cabin, visa assistance and other services).
- Link each externally sourced component to its source evidence.
- A package may be verified component-by-component; never infer that one confirmed hotel or flight validates the entire package.
- Unknown components stay unknown until evidence is supplied.

**Visa assistance**
- Verify only the agency's assistance service, stated scope, service fee and source-backed checklist/processing information.
- Never describe an agent or data-provider match as a visa approval, government decision or guaranteed entry outcome.

## 3. Verification lifecycle and public statuses

Every verification run should be an immutable, time-stamped observation linked to the exact submitted offer version.

| Status | Meaning | Public treatment |
|---|---|---|
| EXACT_MATCH_REVALIDATED | Authorized supplier returned the same material product attributes and successfully revalidated its price/availability for this query and observation time | "مطابق للمصدر عند آخر تحقق" plus source and time; explicitly not a booking |
| MATCH_FOUND_PRICE_CHANGED | Same product is found but the price or material terms differ from the agent submission | Hold publication/update or require the agent to accept revised terms; do not publish the old price as verified |
| PARTIAL_MATCH | Some identifying attributes match, but a material attribute such as fare family, baggage, room/board, cancellation or occupancy differs or is unknown | Show "مطابقة جزئية — راجع الاختلافات"; never mark as exact verification |
| SOURCE_CONFIRMED_NOT_REPRICED | Source confirms a product/reference but no current price/availability revalidation was completed | Show source confirmation only; no live price claim |
| AGENT_DECLARED_ONLY | Agent submitted a source statement/document but no approved API or authoritative current check could validate it | Label as provider-declared, not independently verified |
| NOT_FOUND_OR_UNSUPPORTED | No exact result was found or the source does not expose the relevant product/market | State that it could not be independently verified; this alone is not proof of fraud |
| MISMATCH_REQUIRES_REVIEW | Supplier data materially conflicts with the offer or the evidence appears inconsistent | Keep hidden or under human review until resolved |
| EXPIRED_RECHECK_REQUIRED | The prior source observation is past its allowed freshness/validity window | Remove live-verified wording and request a new check |

The UI must always expose source, checked time, relevant scope and unknown/mismatched fields. "Verified" must never be a timeless badge.

## 4. Verification engine: how it actually checks

1. Validate the submitted category schema and required match keys.
2. Identify the source system that is contractually allowed to provide that category and market.
3. If an exact supplier offer/quote reference is supplied, use the source's permitted lookup or revalidation operation.
4. Otherwise, run an authorized search using the exact submitted attributes. A broadly similar result is not proof of the submitted offer.
5. Compare category-specific fields deterministically. Use fuzzy/semantic matching only to propose candidates for human review, never as final proof.
6. Reprice/recheck availability through the supplier's final validation operation where the API provides one.
7. Record the source response reference, observed time, source scope, normalized attributes, price breakdown and any differences.
8. Apply the freshness policy; recheck when the offer is edited, a traveler proceeds, or the source validity expires.
9. Keep the original agent submission and every verification result immutable. A later successful check must not rewrite historical evidence.
10. If an integration is unavailable, preserve the agent's offer as provider-declared only when product policy allows; do not promote it to live-verified.

### What an external search can and cannot prove

Finding the same route, hotel or activity is not enough to verify the exact offer. A flight may differ by booking class, passenger mix, baggage, refundability or ticketing provider. A hotel may differ by room, occupancy, meal basis, taxes and cancellation. A supplier search result is therefore a candidate until the exact offer is revalidated.

No result from one API should be treated as universal market truth. Coverage gaps, negotiated inventory, private agency rates, carrier restrictions and market restrictions may cause a legitimate agent offer not to appear in another provider's API.

The Amadeus Self-Service FAQ states that its flight search data has limits: some airlines are not returned and other returned airlines expose published rates rather than negotiated/special rates. Therefore, absence from this one catalog is not proof that an agent's fare is false. Use the actual source of the agent's booking/quote when possible, and record unsupported coverage explicitly.

Do not scrape supplier websites or automate access against supplier terms as a fallback for missing APIs. Prefer official partner APIs, documented supplier lookups, authorized feeds and human evidence review.

## 5. Comparison behavior

The traveler should see one SILA comparison experience, but comparison rows remain category-specific and source-labeled.

- The agent's submitted offer appears with its own verification status.
- Alternatives are fetched from authorized external suppliers for the same service scope.
- Existing SILA agency/provider offers and manual quotes appear in a separate "مقدمو خدمات SILA" lane.
- Each row carries exact match basis, source, observed time, currency, price basis, taxes/fees, terms, restrictions and next action.
- Rank as "lowest comparable total" only when passenger/occupancy, dates, service scope, currency and mandatory cost components are equivalent.
- Otherwise show side-by-side facts without declaring a winner.
- A source outage must not erase successful results from other sources.
- Never compare source prices that refer to different inventory, cancellation conditions or fare families as equivalent.

## 6. Pricing and agent margin policy

### Separate the monetary concepts

Do not use one overloaded price or profit field.

- supplier_payable_total: supplier-confirmed amount payable for the exact service, including mandatory amounts that belong in that total.
- supplier_net_cost: only where a contract/API actually returns the agency's net acquisition cost; do not infer it from a public retail price.
- mandatory_taxes_and_charges: itemized and counted once.
- agent_service_fee: explicit fee charged by the agency for its service, where permitted.
- agent_markup: permitted addition over an evidenced eligible acquisition price, where the supplier's commercial terms allow it.
- supplier_commission: amount owed by the supplier/partner under a separate commission arrangement; it is not the same as customer markup.
- sila_platform_fee: SILA's separate platform fee, if one is later approved.
- traveler_display_total: amount and currency presented to the traveler, with a clear breakdown.
- agent_gross_revenue and estimated_agent_margin: analytics values, not labels that imply net accounting profit.

"Markup" is the amount added over the eligible acquisition cost. "Gross margin" is not the same percentage: gross margin is calculated against the sale price, while markup is calculated against the cost. Operating expenses, refunds, payment charges and tax obligations affect actual net profit.

### Policy-controlled calculation

An administrator-approved policy may specify, by category, source, jurisdiction, currency, provider type and commercial flow:
- Whether markup is permitted at all.
- Whether the permitted fee is a fixed amount, percentage, or a combination.
- Maximum fixed amount and/or maximum percentage.
- Minimum permitted fee where operationally justified.
- Whether the fee must be itemized separately to the traveler.
- Who receives the fee and who is responsible for refunds/cancellations.
- Whether the agent can choose a value within the cap or whether SILA sets a fixed fee.
- Whether the selected supplier channel permits any additional agency fee.

Illustrative calculation only:
- The source-confirmed eligible amount is 10,000 EGP.
- The policy allows a maximum fee of 2% and a maximum amount of 250 EGP.
- Maximum permitted addition is min(10,000 × 2%, 250) = 200 EGP.
- The customer-facing amount is 10,200 EGP before any separate, disclosed SILA charge or other properly itemized payable component.

The example is not a recommended rate or a current SILA policy. No numeric cap should be hard-coded before the supplier contracts, service costs, market and applicable rules are reviewed.

### Non-negotiable pricing rules

1. Calculate only from the exact source price and scope that were revalidated; stale prices cannot be used as the cost basis for a "verified" selling price.
2. Do not call a public retail reference price the agent's actual net cost.
3. Do not add mandatory taxes/fees twice or hide excluded/conditional charges.
4. Do not silently convert currency; preserve source currency and show FX source/time when a conversion is authorized.
5. A changed supplier price invalidates the earlier calculation and requires a new agent/traveler decision.
6. The agent may not bypass the applicable category/source cap by moving the amount into an undocumented inclusion.
7. Keep supplier commission, agent fee/markup and SILA platform fee separate in the commercial ledger.
8. A price rule is not permission to collect, hold or settle customer funds. Payment and booking are separate capabilities with separate approval and operational responsibility.

## 7. Supplier-specific commercial constraints that must shape the engine

- **Amadeus Self-Service flights:** its published FAQ says a markup can be applied to flight offers. It also describes Flight Offers Price as the operation that confirms the latest price and availability for the chosen flight. The current Self-Service product exposes published-rate coverage with documented airline/negotiated-rate limitations. Ticket issuance is a separate flow with market eligibility and consolidator requirements.
- **Amadeus current Hotel Search/Book:** its FAQ says the current post-paid hotel booking API does not allow room-price markups, because the guest pays the hotel directly. Do not reuse the flight markup rule for this hotel channel.
- **Booking.com Demand accommodations:** the partner docs require the appropriate partner access and require the correct book price for pre-booking display; total is the full payable amount at booking, with charge/tax details shown. Search/availability prices can differ from the order preview. Do not replace or disguise the required book display price with a custom agent amount. Any additional agency fee or markup must first be permitted by the relevant partner contract and applicable rules, clearly itemized, and consistent across the redirect/booking flow.
- **NDC/NDC[X] and any future consolidator:** markup, commission, permitted seller fee, servicing and settlement depend on the actual provider/airline contract and market. No generic rule should be assumed from the NDC label.

Official sources:
- [Amadeus Self-Service FAQ — flight markup, coverage and Flight Offers Price](https://amadeus4dev.github.io/developer-guides/faq/)
- [Booking.com Demand API — prerequisites](https://developers.booking.com/demand/docs/getting-started/prerequisites)
- [Booking.com Demand API — pricing fields and display requirements](https://developers.booking.com/demand/docs/accommodations/prices-best-practices)
- [Booking.com Demand API — displaying accommodation prices](https://developers.booking.com/demand/docs/accommodations/display-prices)

## 8. Premium plans without pay-to-trust

A free/basic agent account and a premium agent account must be held to the same minimum truth standard for public offers.

**Never sell a stronger verification badge or hide a failed check behind a paid tier.** Trust is about the evidence, not the subscription.

Possible Premium agent features:
- More supplier sources/markets where SILA has genuine access.
- Deeper exact-match and revalidation coverage.
- Bulk verification for many listings.
- More frequent permitted rechecks and expiry alerts.
- Price-position and margin simulations within the same caps.
- Historical comparison reports and offer-performance analytics.
- Structured supplier/agency integrations and operational exports.

Possible Premium traveler features:
- Expanded cross-source comparison where sources are available.
- Saved comparison sets, recheck alerts and price-change history.
- More detailed breakdowns and filters.

Every account still sees the source, observation time, unknown fields and verification status. Premium changes workflow depth and usage limits, not the truth of a claim.

## 9. Recommended implementation order

1. Extend the existing offer submission model with structured category-specific identifiers and source-reference fields for one pilot category; do not replace current offers or inquiry lineage.
2. Implement immutable verification observations and public status semantics behind a feature gate.
3. Pilot flights with one real authorized agent/consolidator/source that can expose the exact fare/quote reference, using Amadeus Self-Service as a comparison source where its coverage applies.
4. Add comparison and price-revalidation tests for exact match, changed price, partial match, unsupported market, missing baggage/rules, timeout and stale evidence.
5. Add a pricing policy engine in dry-run mode first. Show the agent proposed fee, cap and traveler total without applying the rule to a live sale.
6. Review supplier terms and market-specific rules separately for each source; only then enable an eligible fee/markup mode.
7. Add Booking.com accommodation search/look/redirect after the required partner agreement and credentials exist; respect its price-display fields and never assume a room-price markup is allowed.
8. Extend to NDC/NDC[X], hotel and other travel categories only when a named source can verify the exact product and support the relevant next action.
9. Add Premium advanced tools only after the baseline verification flow is available for all public offers.
10. Keep production database changes, supplier credentials, fee policy activation, bookings, ticketing and payments separately approved and audited.

## 10. Owner decisions still required

- Which category is the first real pilot: flight ticket, hotel, package or transfer?
- Will the agency connect its own supplier source, or will SILA verify against a source account it owns/contracts?
- Is the agent fee a fixed amount, percentage cap, both, or a standard platform-defined fee?
- Which party contracts with the traveler and is responsible for cancellation, refund and after-sales support?
- Do Premium features target agents, travelers or both?
- Which Egyptian legal entity and accountable operator owns supplier contracts, payment/collection and consumer support before commercial activation?

**No numeric margin, supplier connection, schema migration, paid tier, payment flow or Production activation is approved by this RFC.**
