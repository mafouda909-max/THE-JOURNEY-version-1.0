# SILA — Listing Data Coverage Audit

**Date:** 25 November 2026  
**Status:** code-derived baseline; no Production data queried  
**Related specification:** [Listing Category Contract](SILA_LISTING_CATEGORY_CONTRACT.md)  
**Compatibility:** current `offers` table and `/offers` routes remain authoritative

## 1. Finding

SILA currently has six category keys, but its agent form and `POST /api/offers` write one shared package-shaped record for all six. The category key controls the label and default hero image; it does not select a specialized attribute schema or publishing workflow.

This is a source-code coverage audit. It does not report how many real offers exist in each category, whether data in Production is complete, or whether any supplier has live inventory. A read-only Preview query is required to measure actual record-level missingness.

## 2. Fields currently available

The existing `offers` table stores:

| Area | Current fields | Important limitation |
|---|---|---|
| Identity | `id`, `agent_id` | Agent is the existing provider identity; not every supplier category has an identity type |
| Content | `title`, `title_en`, `description`, `hero_image` | No category-specific content or media slots |
| Category | `trip_type` | One of six string keys; no linked schema version/detail record |
| Route | `origin_city`, `destination_city`, `destination_country`, `destination_country_en` | City/country text only; no airport/port/property identifiers |
| Dates | `departure_date`, `duration_days` | Departure date column exists, but the current create API hardcodes it to `NULL`; there is no check-in/check-out or sailing window |
| Price | `price_amount`, `currency`, `price_type` | One amount and one of per-person/per-group/starting-from; no tax/fee breakdown or separate price observation/validity |
| Inclusions | `includes[]`, `excludes[]` | Free-text arrays; not typed service components or policy terms |
| Travelers | `min_travelers`, `max_travelers` | Generic count only; no cabin, room occupancy, passenger type or cabin class |
| Publication | `status`, `published_at`, `expires_at`, `is_featured` | Publication expiry is not price validity or inventory freshness |
| Analytics | `view_count`, `contact_count` | Engagement counts, not evidence of supplier response or fulfillment |

The current agent form submits: title, English title, description, `tripType`, origin city, destination city/country (Arabic and English), one price, currency, price basis, duration, max travelers, includes and excludes. It has no departure-date input and no category-specific fields.

The current API validates the six keys, common price/currency/range fields and at least one inclusion. It then writes `departureDate: null` for each newly submitted offer. It does not persist a typed `attributes` object or separate price/availability evidence.

## 3. Category coverage matrix

The following matrix distinguishes shared fields that exist from category facts the current write model cannot represent as typed, queryable values.

| Category | Shared fields available today | Category-specific gaps in the current form/schema |
|---|---|---|
| Umrah | Route, country, duration, traveler range, price basis, includes/excludes | Departure window is not captured by the form; Makkah/Madinah stays, named properties, nights per city, transport, meals, group leader, visa/flight inclusion are not structured |
| Travel package | Route, country, duration, traveler range, price basis, free-text inclusions/exclusions | Departure date/window, itinerary stops/days, occupancy, cancellation/change policy and individually typed services are not captured |
| Visa assistance | Destination country, one shared price, includes/excludes | Applicant nationality/residence scope, visa type, travel purpose, entry count, stay/validity, government fee vs service fee, required-document sources and processing estimate are not structured |
| Flight | Origin/destination city text, optional shared departure date column, traveler range, one price | Airport codes, one-way/return/multi-segment journey, segment schedule, carrier/flight number, cabin, baggage/fare family, taxes, change/refund rules and ticketing party are not structured |
| Hotel | Destination city/country, one price and traveler range | Property identity, check-in/check-out, nights, room count/type, occupancy, board basis, taxes/fees, cancellation/prepayment terms and per-room/per-night basis are not structured |
| Cruise | Origin/destination city text, duration, one price and traveler range | Cruise line/vessel, sailing date, embarkation port, port itinerary, cabin category/occupancy, port charges/taxes and sailing-specific cancellation terms are not structured |

These gaps are not instructions to invent the missing values. Existing descriptions or free-text inclusions must not be backfilled into typed fields without review and reliable evidence.

## 4. Search and public presentation today

- `/offers` is backed by `getPublishedOffers()` and the `OffersBrowser` component.
- Category selection uses the six `TRIP_TYPES` chips.
- The current browser supports a generic text query, origin, traveler count, category chips and response-rate filter; it does not yet expose category-specific filters such as airport/ cabin, hotel dates/occupancy, visa nationality/type or cruise sailing/cabin.
- The empty-inventory state is truthful; the UI does not fabricate sample offers.
- PR #108 adds `/api/listings` as a read-only compatibility adapter. It preserves legacy offer IDs and exposes category facets only where a real public-safe listing exists.
- PR #108 also separates provider-published price from live availability, labels availability as not live-verified, and removes unsupported Schema.org `InStock`/price-validity claims derived from publication expiry.
- A public offer still leads through the existing `/offers/[id]` and `ContactForm` path. It does not reserve inventory or make a booking.

## 5. How to measure current record coverage in Preview

A parameter-free aggregate query is provided at `db/queries/listing_category_coverage.sql`. It:
- runs inside `BEGIN TRANSACTION READ ONLY`,
- groups common-field missingness by `trip_type`,
- reports status, agent-profile counts, departure/duration coverage, inclusions/exclusions and publication-expiry coverage,
- reports price-basis/currency mix without comparing prices across currencies,
- returns aggregate counts only, not traveler names, contact details or request contents.

Run it only against an isolated Preview or test database with a read-only database role. It has not been run as part of this audit. Do not point it at Production without separate explicit approval.

## 6. What this audit does not measure

No live or Production database query was run for this report. Therefore the following remain unknown:
- number of records in each category,
- percentage of records with empty or low-quality optional fields,
- duplicate/invalid category keys in existing data,
- completeness and provenance of actual provider prices,
- real departure-date completeness,
- whether any particular offer has supplier-confirmed availability.

Before choosing a physical category-detail schema, run a read-only report against an isolated Preview database (or an explicitly approved read-only connection), grouped by `trip_type`, counting null/empty values in current fields. Never use the report to auto-fill unknown values.

## 7. Safe next implementation sequence

1. Keep the current `offers` model, URLs, DTOs and inquiry path compatible.
2. Run the read-only field-coverage query in Preview and record actual values/missingness by category.
3. Select one category with a willing, accountable provider and real operational evidence.
4. Finalize only that category's schema, validation, source/freshness, ownership and moderation contract.
5. Add an additive detail structure and upgrade/backfill tests; existing offers must remain readable with no inferred detail.
6. Build one category-specific authoring/search surface and prove the full inquiry → agency opportunity → quote path.
7. Expand only after browser/mobile, tenant/privacy, moderation and supplier-support gates pass.

**Decision guardrail:** do not add six empty forms at once. Do not create a generic supplier directory by relabelling travel agents. Do not describe a category as live/bookable just because its category field or read adapter exists.
