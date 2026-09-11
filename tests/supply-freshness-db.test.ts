import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Client } from "pg";
import { pool } from "../src/db";
import { executeCommercialCommand, type CommercialActor } from "../src/lib/commercial-service";

const databaseUrl = process.env.COMMERCIAL_WORKFLOW_TEST_DATABASE_URL;

function iso(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 3_600_000).toISOString();
}

const intent = {
  originCity: "Cairo",
  destinations: ["Dubai"],
  departureDate: "2026-11-01",
  returnDate: "2026-11-05",
  flexibilityDays: 0,
  travelers: { adults: 2, children: 0, infants: 0 },
  budgetAmountMinor: null,
  budgetCurrency: null,
  budgetBasis: null,
  tripType: "city_break",
  priorities: [],
  constraints: [],
  notes: null,
};

test("volatile supply evidence controls supplier and quote validity", { skip: !databaseUrl }, async () => {
  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();

  try {
    await client.query(readFileSync("db/production_schema.sql", "utf8"));
    await client.query(readFileSync("db/phase1_agency_foundation.sql", "utf8"));
    await client.query(readFileSync("db/phase2_agency_commercial_domain.sql", "utf8"));
    await client.query(readFileSync("db/phase3_supply_freshness_integrity.sql", "utf8"));

    const agent = await client.query<{ id: number }>(
      `INSERT INTO agents
        (display_name, latin_name, bio, photo_url, city, country, license_type, license_number,
         verification_status, specialty_tags, languages, response_rate, avg_response_hours, total_trips)
       VALUES ('Fresh Agency','Fresh Agency','Test','https://example.invalid/a','Cairo','Egypt','agency','FRESH-1',
         'verified','{}','{Arabic}',0,0,0) RETURNING id`,
    );
    const account = await client.query<{ id: number }>(
      `INSERT INTO accounts (email, password_hash, role, display_name, agent_id)
       VALUES ('fresh@example.invalid','test:test','agent','Fresh Agency',$1) RETURNING id`,
      [agent.rows[0]!.id],
    );
    const workspace = await client.query<{ id: number }>(
      `INSERT INTO agency_workspaces (agent_id, name, status) VALUES ($1,'Fresh Agency','active') RETURNING id`,
      [agent.rows[0]!.id],
    );
    await client.query(
      `INSERT INTO agency_memberships (workspace_id, account_id, role, status) VALUES ($1,$2,'owner','active')`,
      [workspace.rows[0]!.id, account.rows[0]!.id],
    );
    const actor: CommercialActor = {
      workspaceId: workspace.rows[0]!.id,
      agentId: agent.rows[0]!.id,
      accountId: account.rows[0]!.id,
      membershipRole: "owner",
    };

    const opportunity = await executeCommercialCommand(actor, {
      command: "create_opportunity",
      source: "manual",
      client: { displayName: "Fresh Traveler", email: "fresh-traveler@example.invalid" },
      intent,
    });
    assert.equal(opportunity.status, 201);
    const opportunityId = Number((opportunity.body.opportunity as Record<string, unknown>).id);

    const missingSource = await executeCommercialCommand(actor, {
      command: "record_supplier_option",
      opportunityId,
      category: "flight",
      supplierName: "Airline",
      description: "Dynamic airfare",
      currency: "USD",
      costAmountMinor: 50000,
      commissionExpectedMinor: 0,
      sourceType: "booking_engine",
      sourceRef: null,
      observedAt: iso(-1),
      validUntil: iso(4),
    });
    assert.equal(missingSource.status, 422);

    const staleSupplier = await executeCommercialCommand(actor, {
      command: "record_supplier_option",
      opportunityId,
      category: "hotel",
      supplierName: "Hotel Supplier",
      description: "Expired hotel price",
      currency: "USD",
      costAmountMinor: 30000,
      commissionExpectedMinor: 0,
      sourceType: "supplier_quote",
      sourceRef: "supplier-email-1",
      observedAt: iso(-4),
      validUntil: iso(-1),
    });
    assert.equal(staleSupplier.status, 422);

    const quoteWithStaleLine = await executeCommercialCommand(actor, {
      command: "create_quote_version",
      opportunityId,
      validUntil: iso(2),
      lines: [{
        kind: "flight",
        label: "Already expired fare",
        quantity: 1,
        currency: "USD",
        costUnitMinor: 50000,
        sellUnitMinor: 56000,
        commissionExpectedMinor: 0,
        supplierOptionId: null,
        provenance: {
          sourceType: "booking_engine",
          sourceRef: "gds-search-123",
          observedAt: iso(-3),
          validUntil: iso(-1),
        },
      }],
    });
    assert.equal(quoteWithStaleLine.status, 422);

    const quoteOutlivingEvidence = await executeCommercialCommand(actor, {
      command: "create_quote_version",
      opportunityId,
      validUntil: iso(12),
      lines: [{
        kind: "hotel",
        label: "Hotel price",
        quantity: 1,
        currency: "USD",
        costUnitMinor: 40000,
        sellUnitMinor: 48000,
        commissionExpectedMinor: 2000,
        supplierOptionId: null,
        provenance: {
          sourceType: "supplier_quote",
          sourceRef: "hotel-quote-44",
          observedAt: iso(-1),
          validUntil: iso(6),
        },
      }],
    });
    assert.equal(quoteOutlivingEvidence.status, 422);

    const validQuote = await executeCommercialCommand(actor, {
      command: "create_quote_version",
      opportunityId,
      validUntil: iso(4),
      lines: [{
        kind: "flight",
        label: "Fresh fare",
        quantity: 2,
        currency: "USD",
        costUnitMinor: 50000,
        sellUnitMinor: 56000,
        commissionExpectedMinor: 0,
        supplierOptionId: null,
        provenance: {
          sourceType: "booking_engine",
          sourceRef: "gds-search-456",
          observedAt: iso(-0.5),
          validUntil: iso(5),
        },
      }],
    });
    assert.equal(validQuote.status, 201);

    const versionId = Number((validQuote.body.quoteVersion as Record<string, unknown>).id);
    const stored = await client.query<{ valid_until: Date; lines_snapshot: Array<{ provenance: { sourceRef: string; observedAt: string; validUntil: string } }> }>(
      `SELECT valid_until, lines_snapshot FROM agency_quote_versions WHERE id = $1`,
      [versionId],
    );
    assert.equal(stored.rows[0]!.lines_snapshot[0]!.provenance.sourceRef, "gds-search-456");
    assert.ok(stored.rows[0]!.lines_snapshot[0]!.provenance.observedAt);
    assert.ok(stored.rows[0]!.lines_snapshot[0]!.provenance.validUntil);
  } finally {
    await client.end();
    await pool.end();
  }
});
