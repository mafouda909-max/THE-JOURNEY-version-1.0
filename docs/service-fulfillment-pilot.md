# SILA: controlled service fulfillment pilot

Status: implementation under review; commercial validation and production activation are separate decisions.
Source baseline: `main` at `66469e358a41cbaf2b3b981d253fa4bcda0ce3b3`.

## Concrete behavior

An office owner selects one supplier-backed line from an accepted, won quote. The service order copies that immutable line's name, currency, quantity-adjusted supplier cost and selling price. The owner identifies an existing external partner account and records the scope, acceptance criteria, deadline, partner qualification/agreement reference and SILA fee.

The assigned partner can accept or decline, start work and submit a delivery reference. The office can request rework, accept the delivery or cancel a nonterminal order with a reason. Declined and cancelled assignments remain in history and permit a new assignment for the same quote line. An accepted delivery is not a payment receipt.

Model B is explicit: the office contracts with and pays the supplier directly. SILA's recorded income is its coordination fee. Supplier cost and office selling price are commercial context, not SILA revenue. No supplier balance, escrow, payment initiation or automated refund is implemented.

## Reuse decisions

| Subsystem | Decision | Reason |
| --- | --- | --- |
| Account/session authentication | REUSE | Actors come from the existing server session. |
| Active workspace membership | REUSE / EXTEND | Rechecked on every command; owner required for commitments and money. |
| Opportunities, supplier evidence, versioned quotes, customer approval | REUSE | Existing canonical commercial source of truth. |
| Quote delivery | EXTEND | Safe progress in the existing quote page; independent service status link handles longer execution. |
| Service execution and money records | ADD | Quote sharing and `won` were not fulfillment or settlement. |
| Brand, marketplace, comparison and community | REUSE | No broad replacement or speculative new acquisition engine in this pilot. |
| Native mobile application | REUSE | No native fulfillment screen added; new web flow is tested at mobile widths. |
| Production state and real participant/price data | UNKNOWN | Code and CI do not establish these facts. |

## Security and integrity boundaries

- `SERVICE_FULFILLMENT_PILOT_WORKSPACE_IDS` is a strict workspace allowlist. Empty or malformed configuration disables the pilot. Active office membership is required; members can read but only owners can commit or record money.
- Partner access is assignment-specific. The partner receives scope, acceptance criteria, deadline, supplier amount and work history. Customer identity, quote selling price, SILA fee, office margin, qualification notes and accounting notes are omitted from the DTO.
- Financial operations require a positive safe integer in minor units, reference and note. Order locks, expected revisions and a durable actor/request-ID receipt protect retries and competing writes. Reusing an ID with different data returns a conflict. A duplicate accounting reference also conflicts.
- Database guards bind an order to its own accepted quote line, protect frozen terms, enforce transitions and preserve append-only delivery, work, money and command history. Fee collection and refunds cannot exceed their permitted balances.
- Financial corrections are explicit new entries, not edits to prior receipts. A cancellation does not silently cancel the fee or issue a refund. The commercial agreement must determine any waiver/refund; the pilot cannot amend an agreed fee in place.
- Client status links are random 256-bit tokens; only their SHA-256 digests are stored. They expire after seven days. Only the owner can issue/revoke them; reissuing revokes the previous link. Lost responses are handled by issuing a fresh link, not recovering raw tokens from the database.
- `/s/[token]` reveals only office name, service name, work status, agreed deadline, completion time and link expiry. It does not expose delivery references, documents, scope, customer identity or finances. Links are bearer credentials; copy deliberately to the intended client.
- Private link pages use no-referrer, no-store and noindex. The raw status token is not written to command receipts or application event payloads. Hosting/proxy access-log policies must also be reviewed before a real pilot because URLs contain bearer tokens.
- JSON writes check the request origin or an explicitly configured application origin when an Origin header is present and streamed with a 32 KiB limit. Actor/role/state spoofing fields are rejected.

## Activation and rollback

1. Select one service with the evidence framework in `service-commercial-validation.md`. Confirm the operator, participating offices, partner qualification, service boundaries, fee and cancellation/refund terms. These are not supplied by software fixtures.
2. Use a dedicated staging database. Apply the existing canonical upgrade chain appropriate to that database, then `db/service_fulfillment_pilot.sql`. The pilot SQL is intentionally absent from the automatic release manifest. Do not initialize an existing production database with `production_schema.sql`.
3. Run the native PostgreSQL service test and authenticated browser flow. Verify schema prerequisites, active memberships, accepted quote lineage, partner account access and token revocation in that environment.
4. Set the allowlist to the approved staging workspace IDs. Keep all other workspaces excluded. Existing environment flags and product branding stay independently controlled.
5. Production migration and activation require a concrete owner-approved release, backup and staged verification. Neither was executed by this change.
6. Rollback access by clearing the allowlist and restarting the deployment if necessary. Preserve order and money history. Do not drop tables or reverse financial records as an application rollback.

The local SQL verification adapter is QA-only and is not committed or deployed. Native PostgreSQL CI remains the authority for connection-level concurrency. Browser fixtures refuse remote/non-QA database names, create only synthetic data, and never reset an existing workspace database.

## Operator obligations and limits

The qualification reference records the office's attestation, not a platform-verified supplier license. Deliveries currently contain references/descriptions; secure document upload and independent verification of the referenced output are not added. A human office owner reviews evidence before accepting. No AI decision commits a price, delivery, payment or refund.

The displayed cash contribution equals recorded net SILA fees minus recorded direct costs. It is not net profit. Record support, operator/founder time at an agreed rate, rework, failed/cancelled request costs, transaction costs and acquisition allocation. Keep cohort acquisition/fixed costs in the pilot journal until an accounting export is justified. Do not combine currencies without an explicit conversion basis.

An accepted legacy quote can be the execution source after price validity has elapsed; acceptance is historical commercial evidence, not a fresh supplier capacity guarantee. The owner must reconfirm partner capacity/terms before assignment. The partner's acceptance is a separate commitment. Legacy non-volatile supplier lines with a non-null expiry currently need investigation of the freshness guard before using that pricing pattern; the pilot fixtures do not bypass that guard.

The list is bounded to the latest 100 matching orders. Full accounting reconciliation, fee amendment/waiver, operator roles beyond owner, supplier reassignment within an accepted order and native mobile fulfillment remain future work driven by the paid pilot. Cancellation with a replacement order preserves old history and associated costs.

## Evidence

| Claim | Evidence | Classification |
| --- | --- | --- |
| Work and money are independent | `tests/service-fulfillment-db.test.ts`: completed/unpaid, refunds preserve completion | FACT when test passes |
| Retry, race, tenant and immutable history protection | Same DB suite, executed on PostgreSQL 17 in CI | EVIDENCE; use actual run result |
| Arabic office/partner/client workflow at desktop/mobile widths | `tests/browser/service-fulfillment.spec.ts` | EVIDENCE; use actual run result |
| Real offices will pay and repeat | No paid records supplied | HYPOTHESIS |
| Actual contribution margin, CAC and scalable support load | No measured pilot cohort supplied | UNKNOWN |
| Production migration / live paid launch | Not performed | NOT ACTIVATED |

Verification commands:

```bash
npm run typecheck
npm run lint
npm test
npm run build
node --import tsx --test tests/service-fulfillment-db.test.ts
node --import tsx scripts/seed-service-browser.ts
npm run browser:test
```

The DB test requires `SERVICE_FULFILLMENT_TEST_DATABASE_URL` and the matching runtime `DATABASE_URL` on an isolated test database. Browser QA additionally requires `SILA_SERVICE_BROWSER_QA=true`, pilot IDs `1,2`, and a fresh local database named `journey_browser` or `sila_service_browser`. Those fixture settings do not belong in production.
