# Readiness Advisor V2

Status: incremental implementation. This document describes the product/runtime contract; it is not a claim that every provider is enabled in Production.

## Product boundary

Readiness has two deliberately separate layers:

1. **Decision checklist** — only structured, scope-matching evidence can produce a verified travel requirement.
2. **Advisor layer** — purpose-specific preparation, live source research when configured, and matching public SILA offers.

Live web content and AI synthesis never upgrade the verified checklist by themselves.

## Travel purposes

The public contract distinguishes tourism, study, employed work, business visits, freelance/remote work, Umrah, family/personal visits, medical travel, transit and other. These categories stay separate because the required documents and legal permission can differ materially.

## Source order

1. Current structured SILA travel evidence.
2. Official government, embassy, immigration, airport, airline or supplier pages.
3. Connected supplier data.
4. Current SILA public offers from agents with scoped trust.
5. Community/traveler experience, explicitly labeled as experience.
6. General web sources as source-reported evidence.
7. AI as synthesis only, never a source.

## Failure behavior

- No web provider: show NOT_CONFIGURED, never fabricate research.
- Web without AI: show sources only.
- Provider failure: show UNAVAILABLE while keeping verified checklist truth separate.
- No matching marketplace supply: show NO_MATCH; never create demo offers.
- Different offer/budget currencies: no cheaper/within-budget claim without a trusted timestamped conversion.
- Request cancellation and the outer Readiness deadline propagate into provider calls.

## Production provider truth

At implementation time the Vercel project exposes DATABASE_URL but no configured project environment entries for Tavily, OpenRouter/OpenAI, or Amadeus credentials. The UI must therefore degrade explicitly until those capabilities are configured and their probes are READY.

## Release gates

Unit/contracts, real PostgreSQL tests, provider failure/cancellation tests, desktop/mobile browser QA, private-data exclusion, production build, exact-head Preview proof and post-merge Production smoke remain mandatory.
