# SILA / صلة — Preliminary Naming Collision Risk

> **Status: BLOCKING CHECK BEFORE PUBLIC LAUNCH OR MAIN-BRANCH MERGE**
>
> This is a preliminary public-web conflict scan, not a legal trademark opinion.

## Material conflicts discovered

### 1. Qatar Ministry of Transport — Sila / صلة
The Qatar Ministry of Transport publicly uses **Sila / صلة** as the brand for the country's integrated public-transport network, including an app and website with a journey planner and travel information.

- https://www.mot.gov.qa/en/news/ministry-transport-and-communications-unveils-sila
- https://www.mot.gov.qa/en/news/qatars-integrated-public-transport-network-unveils-first-brand-campaign

**Risk:** very high semantic/category proximity. Exact Latin name, Arabic meaning, travel/mobility use, app, journey planning, and regional market overlap.

### 2. SILA Travel
A travel business operates publicly as **SILA Travel**.

- https://www.sila.travel/

**Risk:** direct travel-category name collision even though market/geography may differ.

### 3. SILA B2B marketplace — Saudi Arabia / Gulf
A current Arabic platform uses **SILA** to connect buyers with verified suppliers/factories, support comparison, direct contact, and verification.

- https://sila.today/
- https://sila.today/about

**Risk:** strong product-mechanism and regional overlap: marketplace, verified counterparties, comparison, direct communication, Arabic-first regional positioning.

### 4. Other SILA digital brands in Saudi Arabia
Additional live digital services use SILA branding, including procurement and payments.

- https://sila-ai.app/
- https://silagate.com/en/
- https://sila.com.sa/

## Decision gate

Do **not** treat the SILA name as legally cleared based on this implementation branch.

Before public launch:
1. Run formal trademark clearance in target markets/classes.
2. Check Arabic and Latin marks: صلة / SILA / SILA TRAVEL and close variants.
3. Check app-store conflicts and domain/social-handle strategy.
4. Decide whether category/geographic coexistence is acceptable with qualified legal advice.
5. If the name changes, keep this branch as migration infrastructure and replace the centralized brand layer/assets before merge.

## Engineering consequence

The migration work has deliberately centralized brand values in `src/lib/brand.ts` and isolated approved assets under `public/brand/` so a naming pivot does **not** require reopening backend, database, security, or business logic.

## Current recommendation

Keep PR #14 in **Draft** until naming clearance is resolved.
