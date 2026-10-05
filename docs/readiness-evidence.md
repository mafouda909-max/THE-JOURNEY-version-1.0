# Readiness: evidence, scope, freshness and bounded failures

This increment uses existing travel_knowledge records and the current modular
monolith. It adds a read-only Evidence projection, not a polymorphic database or
a second requirements system. No migration or dependency is required.

## Decision contract

Every checklist item has evidence/source reference, recorded collection/check/
verification/expiry times where known, scope, limitations and a next action.
Unknown issuance, verification or reviewer fields remain null. A record's
checked_at is shown as the recorded check time; querying it does not update it.
A search URL is a review candidate, never a verified regulation. AI is not a source.

Stored yes/no visa decisions require structured_authoritative basis, a safe
HTTPS source, a permitted source type, actual fresh dates and explicit matching
travel-document/purpose/date scope. Country/destination must match the query.
Freshness requires the recorded check within 24 hours and a non-expired
valid_until when present. This 24-hour limit is SILA's conservative recheck
policy, not a guarantee about a law or future travel. Source expiry and rule
applicability dates are distinct. Reconfirm before booking and travel.

Legacy records without scope remain available as unconfirmed evidence; they
cannot yield a new boolean. A compatible scope inside existing data_payload is:

```json
{
  "decisionBasis": "structured_authoritative",
  "visaRequired": false,
  "scope": {
    "travelDocument": "passport",
    "purpose": "tourism",
    "travelDates": { "from": "2026-10-01", "until": "2026-11-30" }
  }
}
```

This is a format example only, not a real visa rule. An explicitly broad purpose
or date scope can use "any". Missing scope cannot silently become "any".
Conflicting matching facts or over 50 comparison candidates require review.

## Outcomes and backward compatibility

READY requires every assessed checklist item to be verified. A positive
traveler-reported passport value still needs official-rule/document confirmation,
so a visa waiver cannot make the whole journey READY. NEEDS_CONFIRMATION is
additive; existing NEEDS_ATTENTION means an action is needed, UNKNOWN means no
sufficient decision evidence, and BLOCKED identifies a blocker in submitted data.
The overallScore field remains for compatibility but represents verified
checklist coverage and is removed from the UI; it is not an entry probability.
Missing visa evidence remains an explicit checklist item, not just a warning.

## Runtime and UX gates

- The knowledge lookup uses an owned read-only transaction with a 4-second
  PostgreSQL statement timeout, 4.5-second driver timeout, bounded setup/rollback
  and client discard after failure. Existing 10-second pool acquisition remains.
  No global timeout changes apply to commercial transactions.
- The API has an 18-second outer deadline and passes cancellation into external
  searches. Actual DB/provider failure returns safe 503/504 with retry guidance,
  not a successful UNKNOWN. Internal exception objects/URLs are not logged.
- Input parsing rejects null/empty/boolean passport coercion, oversized context
  strings and invalid calendar dates. It never truncates or silently corrects.
- Operational telemetry runs via Next after; its bounded insert contains only
  hasTransit/status/checklistCount/warningCount, never travel context or PII.
- The client keeps its deadline through full response parsing, validates the
  decision shape, aborts on changes/unmount and clears stale results on edits.
  Failure is an alert with retry available. Labels are persistent and associated.
- Desktop/mobile proof covers actual evaluation, missing source/scope, malformed
  success, backend failure/retry, input invalidation and canceled stalled fetch.
  The real PostgreSQL lock test must prove server cancellation and pool recovery.

Production activation requires exact-head CI and canonical browser checks.
Isolated fixture visa data is never inserted into Production or treated as
real travel intelligence. Genuine agent/offer/inquiry activation remains separate.
