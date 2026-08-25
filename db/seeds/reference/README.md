# Reference Seeds (Class 1 — REAL data, AD-12)

Production-grade structured travel reference data. Safe to run against production.

## Files
| File | Contents | Source |
|---|---|---|
| `0010_priority_countries.sql` | 5 priority countries (EG/SA/AE/JO/TR) — Q1 ratified | ISO 3166-1 alpha-2 |
| `0020_priority_airlines.sql` | 6 principal carriers of priority regions — Q1 ratified | Long-established public IATA codes |
| `0030_badge_catalog.sql` | VERIFIED / LICENSED trust-mark catalog | SPEC §4.3, §3.13 |

All scripts are **idempotent upserts** wrapped in transactions.

## Rules (AD-12)
1. **No invented codes.** Every IATA/ICAO/ISO value must come from a verifiable source.
   Suspected conflicts → flag in a data-review note; never guess silently.
2. Bulk global coverage (full airports/cities datasets) imports from
   **OurAirports.com** (public domain) as additional numbered seed files —
   imported rows default `is_active = false` until curated (Q1).
3. Extending coverage is a DATA operation — never a schema migration.

## Pending (not a blocker for Slice 0)
- [ ] OurAirports bulk import: cities + airports (Egypt/KSA/UAE/Jordan/Türkiye first)
- [ ] Airline logo assets (`logo_url`) — BRAND asset pipeline

## Runner (once Supabase is provisioned — currently BLOCKED)
```bash
supabase db execute --file db/seeds/reference/0010_priority_countries.sql
supabase db execute --file db/seeds/reference/0020_priority_airlines.sql
supabase db execute --file db/seeds/reference/0030_badge_catalog.sql
```
