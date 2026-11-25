# SILA — Listing Category Contract v0.1

**Status:** implementation specification for review; not an approved database schema.
**Date:** 25 November 2026
**Scope:** the six existing listing categories in `TRIP_TYPES`: Umrah, travel packages, visas, flights, hotels and cruises.

## 1. The current boundary

The current `offers` table is a package-shaped record. It requires a route, traveler range, dates/duration, a single price amount/basis, and included/excluded arrays. The current `tripType` value selects one of six labels; it does not create a category-specific publishing workflow.

PR #108 adds a transitional read model over these records. It preserves legacy IDs and current routes, exposes actual published category facets, and distinguishes a provider-published price from confirmed availability. It is not the canonical typed-write model described here.

**Compatibility rule:** keep `offers` and existing `/offers/[id]` and inquiry paths working. Do not backfill category-specific data by guessing missing values.

## 2. Shared listing envelope

Every future category-specific listing should use a common envelope. The storage decision (typed tables vs constrained JSONB extension vs linked category detail tables) remains open until the field inventory and migration proof are reviewed.

| Field | Meaning | Rule |
|---|---|---|
| `id`, `providerId` | Stable listing and accountable provider | Provider is a reusable business/agent identity, not an uploaded document |
| `category`, `schemaVersion` | Category discriminator and attribute contract | Unknown future categories are not silently mapped to a known type |
| `title`, `summary`, `description`, `media` | Human-readable content | Media references must be authorized and public-safe |
| `attributes` | Category-specific typed values | Server validates with the exact schema version; no unvalidated arbitrary JSON |
| `publication.status` | draft, pending_review, published, suspended, expired, rejected, archived | Independent of supplier availability |
| `publication.publishedAt`, `publication.endsAt` | Public visibility window | End of publication is not price validity |
| `commercial.price` | Amount, currency, basis, components and inclusions | Currency and basis are mandatory; unknown components remain unknown |
| `commercial.source` | Provider declaration or sourced quote | Preserve source reference and author/scope |
| `commercial.observedAt`, `commercial.validUntil` | Price observation and expiry | A listing's publication time does not refresh a price |
| `availability.state` | unknown, request_required, provider_reported, live_search_result | State always includes observation time, scope and source |
| `availability.sourceRef`, `observedAt`, `validUntil` | Evidence of availability | Expired or missing evidence becomes unknown, never available by default |
| `providerTrust` | Scoped, current provider evidence | Trust in provider identity is not proof of price or stock |
| `inquiryPolicy` | direct provider inquiry, request quote, live supplier search | A search result is not a hold, booking or ticket |

## 3. Category-specific attributes

Required means necessary before publishing that category. Optional means allowed but must not be inferred. Where a value cannot be verified, the listing must either omit it or use an explicit unknown/request-required state.

### 3.1 Umrah

| Attribute | Requirement |
|---|---|
| departure city | Required |
| departure date or explicit date window | Required |
| duration / nights | Required |
| traveler capacity and price basis | Required |
| Makkah / Madinah accommodation details | Required when accommodation is represented as included |
| transport and meal inclusions | Explicit include/exclude for each claimed service |
| group leader / on-ground support | Optional; display only with named accountable provider and scope |
| visa / flight inclusion | Explicit; never inferred from the word “Umrah” |
| hotel distance / category | Optional; require named property or verifiable source and observation date |

### 3.2 Travel package

| Attribute | Requirement |
|---|---|
| origin and destination | Required |
| travel dates or date window | Required |
| duration | Required |
| traveler capacity / occupancy basis | Required |
| accommodation and transport | Each individually marked included, excluded or not specified |
| itinerary / activities | Optional structured day/stop list |
| cancellation / change terms | Required before any “flexible” or refundable claim |
| price basis | Per traveler, per room, per group or starting-from; never ambiguous |

### 3.3 Visa assistance

| Attribute | Requirement |
|---|---|
| destination country | Required |
| applicant nationality / residence scope | Required; support more than one value explicitly |
| visa type and travel purpose | Required |
| entry count, stay duration, validity | Optional unless backed by official or provider source |
| required documents | Optional checklist with source and last-reviewed date |
| government fees | Separate from provider service fees |
| processing estimate | Optional; sourced, date-stamped and expressly an estimate, not a promise |
| decision outcome | Never promised by SILA or inferred from agency verification |

### 3.4 Flight

| Attribute | Requirement |
|---|---|
| origin and destination airports | Required, using stable airport codes where known |
| one-way / return / multi-segment | Required |
| segments | Required for an itinerary: carrier, flight number if supplied, local departure/arrival times, airport and connection |
| departure date | Required |
| passengers and cabin | Required |
| baggage and fare family | Required when included in the displayed fare |
| change, refund and no-show rules | Required when the fare is presented as bookable/quotable |
| ticketing provider / fulfilment party | Required before claiming ticket issuance |
| price basis | Per passenger or total itinerary, with taxes/fees included or explicitly excluded |

### 3.5 Hotel

| Attribute | Requirement |
|---|---|
| property identity and location | Required; property name and city |
| check-in / check-out | Required |
| room count and occupancy | Required |
| room type and board basis | Required for the priced unit |
| taxes / resort fees | Included or explicitly excluded/unknown |
| cancellation / prepayment policy | Required before a refundable or flexible claim |
| price basis | Per room per night or total stay, with number of nights and occupants |
| availability | Must be date- and room-specific; a property profile alone is not availability |

### 3.6 Cruise

| Attribute | Requirement |
|---|---|
| cruise line and vessel | Required when known; unknown values are not fabricated |
| sailing date and embarkation port | Required |
| itinerary / ports of call | Required for a specific sailing |
| duration / nights | Required |
| cabin category and occupancy | Required for a priced option |
| inclusions / port charges / taxes | Explicitly separated |
| change / cancellation terms | Required for a quote that purports to be a specific sailing |
| price basis | Per traveler or cabin, with occupancy rules stated |

## 4. Price and availability are separate dimensions

A listing can remain publicly visible while a price observation has expired. A price can be provider-declared without availability confirmation. The data model must not collapse these cases.

### Price observation

Minimum fields:
- `amountMinor` and `currency` (ISO 4217)
- `basis` (per_person, per_room_night, per_stay, per_group, per_service, starting_from, total_itinerary)
- `sourceType` (provider_statement, supplier_quote, supplier_api)
- `sourceRef` and `observedAt`
- `validUntil` only when the source actually provides a validity window
- optional tax/fee components with included/excluded/unknown semantics

### Availability evidence

Minimum fields:
- `state` (unknown, request_required, provider_reported, live_search_result)
- `sourceType`, `sourceRef`, `observedAt`, `validUntil`
- scope keys required by category (dates, route, room/cabin/fare/occupancy)
- provider response or supplier response identifier where available

Rules:
1. Missing, stale, contradictory or out-of-scope evidence resolves to `unknown`.
2. `provider_reported` is a provider assertion, not an independent live supplier check.
3. `live_search_result` is a search observation, not a reservation or booking.
4. Held, booked, ticketed and fulfilled are separate transaction/order lifecycle states.
5. Price change requires a new observation/quote version; never rewrite an already delivered quote.

## 5. Provider and trust requirements

Initial directory eligibility uses the two provider kinds already supported by current evidence policy: travel agency and independent travel agent. Other categories of businesses must not be represented as verified suppliers until SILA has:
- a distinct provider identity/type and onboarding workflow,
- category-appropriate legal/operational evidence,
- a human review owner and expiry/revocation policy,
- a service scope and accountable fulfilment party,
- supplier terms and complaint/cancellation handling.

A verified travel agency profile does not automatically verify a hotel, airline, cruise line or visa authority.

## 6. Search and category facets

- Facets are derived from actually published, currently eligible listings.
- Category-specific filters are applied only when a value exists and has known semantics.
- Hotel date/occupancy, flight route/date/cabin, cruise sailing/cabin, visa nationality/type and package route/date are separate search dimensions.
- Empty supply is explicit; no synthetic inventory, placeholder prices or fabricated counts.
- Search returns source and freshness state alongside commercial fields.

## 7. Compatibility and migration sequence

1. Keep PR #108's read-only projection and existing offers UI/API compatible.
2. Record actual values and missingness per current `tripType` before choosing the canonical storage model.
3. Choose an additive category detail structure, with strict schema validation and migration-upgrade tests.
4. Build one category-specific publishing workflow using a real willing provider and evidence owner.
5. Prove provider ownership, review, expiry, inquiry/quote lineage, privacy and mobile contract.
6. Expand category by category only after the first workflow is operationally proven.

Do not add six empty category forms at once. Do not create a generic supplier directory by relabeling agents.

## 8. Definition of Done for a category

A category is market-ready only when all of the following exist:
- category schema and server-side validation,
- create/edit/submit/review/publish/suspend/expire lifecycle,
- authorized provider ownership and private evidence redaction,
- category-specific search and truthful zero-supply behavior,
- explicit price basis and availability-source/freshness display,
- inquiry/quote journey into the existing agency commercial workflow,
- owner/tenant isolation, audit and migration tests,
- browser and mobile contract QA,
- at least one real operational provider/supplier and a responsible support path.

A category label, a read API, or a static card alone does not meet this definition.
