import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Client } from "pg";
import { pool } from "../src/db";
import { executeCommercialCommand, type CommercialActor } from "../src/lib/commercial-service";

const databaseUrl = process.env.COMMERCIAL_WORKFLOW_TEST_DATABASE_URL;

const intent = {
  originCity: "Cairo",
  destinations: ["Istanbul"],
  departureDate: "2026-10-10",
  returnDate: "2026-10-15",
  flexibilityDays: 1,
  travelers: { adults: 2, children: 0, infants: 0 },
  budgetAmountMinor: 180000,
  budgetCurrency: "USD",
  budgetBasis: "total",
  tripType: "city_break",
  priorities: ["central hotel"],
  constraints: [],
  notes: null,
};

function futureIso(hours: number) {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

function quoteLines(label: string, sellUnitMinor: number) {
  return [{
    kind: "fee",
    label,
    quantity: 1,
    currency: "USD",
    costUnitMinor: 50000,
    sellUnitMinor,
    commissionExpectedMinor: 0,
    supplierOptionId: null,
    provenance: {
      sourceType: "manual",
      sourceRef: null,
      observedAt: new Date().toISOString(),
      validUntil: null,
    },
  }];
}

test("quote delivery integrity binds outcomes to the latest communicated version", { skip: !databaseUrl }, async () => {
  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();

  try {
    await client.query(readFileSync("db/production_schema.sql", "utf8"));
    await client.query(readFileSync("db/phase1_agency_foundation.sql", "utf8"));
    await client.query(readFileSync("db/phase2_agency_commercial_domain.sql", "utf8"));
    await client.query(readFileSync("db/phase3_supply_freshness_integrity.sql", "utf8"));
    await client.query(readFileSync("db/phase4_quote_delivery_integrity.sql", "utf8"));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const agent = await client.query<{ id: number }>(
      `INSERT INTO agents
        (display_name, latin_name, bio, photo_url, city, country, license_type, license_number,
         verification_status, specialty_tags, languages, response_rate, avg_response_hours, total_trips)
       VALUES ($1,$1,'Delivery integrity agency','https://example.invalid/photo','Cairo','Egypt','agency',$2,
         'verified','{}','{Arabic}',0,0,0) RETURNING id`,
      [`Delivery-${suffix}`, `DEL-${suffix}`],
    );
    const account = await client.query<{ id: number }>(
      `INSERT INTO accounts (email, password_hash, role, display_name, agent_id)
       VALUES ($1,'test:test','agent',$2,$3) RETURNING id`,
      [`delivery-${suffix}@example.invalid`, `Delivery-${suffix}`, agent.rows[0]!.id],
    );
    const workspace = await client.query<{ id: number }>(
      `INSERT INTO agency_workspaces (agent_id, name, status) VALUES ($1,$2,'active') RETURNING id`,
      [agent.rows[0]!.id, `Delivery-${suffix}`],
    );
    await client.query(
      `INSERT INTO agency_memberships (workspace_id, account_id, role, status)
       VALUES ($1,$2,'owner','active')`,
      [workspace.rows[0]!.id, account.rows[0]!.id],
    );

    const actor: CommercialActor = {
      workspaceId: workspace.rows[0]!.id,
      agentId: agent.rows[0]!.id,
      accountId: account.rows[0]!.id,
      membershipRole: "owner",
    };

    const created = await executeCommercialCommand(actor, {
      command: "create_opportunity",
      source: "manual",
      title: "Delivery integrity trip",
      client: { displayName: "Integrity Traveler", email: `traveler-${suffix}@example.invalid` },
      intent,
    });
    assert.equal(created.status, 201);
    const opportunityId = Number((created.body.opportunity as Record<string, unknown>).id);
    assert.ok(opportunityId > 0);

    const v1 = await executeCommercialCommand(actor, {
      command: "create_quote_version",
      opportunityId,
      validUntil: futureIso(72),
      lines: quoteLines("Version 1", 60000),
    });
    assert.equal(v1.status, 201);
    const quoteId = Number(v1.body.quoteId);
    const version1Id = Number((v1.body.quoteVersion as Record<string, unknown>).id);

    const v2 = await executeCommercialCommand(actor, {
      command: "create_quote_version",
      opportunityId,
      quoteId,
      validUntil: futureIso(72),
      lines: quoteLines("Version 2", 62000),
    });
    assert.equal(v2.status, 201);
    const version2Id = Number((v2.body.quoteVersion as Record<string, unknown>).id);

    const staleSend = await executeCommercialCommand(actor, {
      command: "send_quote",
      quoteId,
      quoteVersionId: version1Id,
      channel: "link",
    });
    assert.equal(staleSend.status, 422, "an older created version must not be sent once a newer version exists");

    const sentV2 = await executeCommercialCommand(actor, {
      command: "send_quote",
      quoteId,
      quoteVersionId: version2Id,
      channel: "link",
    });
    assert.equal(sentV2.status, 200);

    const v3 = await executeCommercialCommand(actor, {
      command: "create_quote_version",
      opportunityId,
      quoteId,
      validUntil: futureIso(72),
      lines: quoteLines("Version 3", 64000),
    });
    assert.equal(v3.status, 201);
    const version3Id = Number((v3.body.quoteVersion as Record<string, unknown>).id);

    const winUnsent = await executeCommercialCommand(actor, {
      command: "record_outcome",
      opportunityId,
      outcome: "won",
      quoteVersionId: version3Id,
    });
    assert.equal(winUnsent.status, 422, "an unsent draft version must not become the winning commercial truth");

    const sentV3 = await executeCommercialCommand(actor, {
      command: "send_quote",
      quoteId,
      quoteVersionId: version3Id,
      channel: "email",
    });
    assert.equal(sentV3.status, 200);

    const winSupersededSent = await executeCommercialCommand(actor, {
      command: "record_outcome",
      opportunityId,
      outcome: "won",
      quoteVersionId: version2Id,
    });
    assert.equal(winSupersededSent.status, 422, "a newer sent revision must supersede an older sent revision of the same quote");

    const alternative = await executeCommercialCommand(actor, {
      command: "create_quote_version",
      opportunityId,
      validUntil: futureIso(72),
      lines: quoteLines("Alternative quote", 66000),
    });
    assert.equal(alternative.status, 201);
    const alternativeQuoteId = Number(alternative.body.quoteId);
    const alternativeVersionId = Number((alternative.body.quoteVersion as Record<string, unknown>).id);
    const sentAlternative = await executeCommercialCommand(actor, {
      command: "send_quote",
      quoteId: alternativeQuoteId,
      quoteVersionId: alternativeVersionId,
      channel: "link",
    });
    assert.equal(sentAlternative.status, 200);

    const won = await executeCommercialCommand(actor, {
      command: "record_outcome",
      opportunityId,
      outcome: "won",
      quoteVersionId: version3Id,
    });
    assert.equal(won.status, 200);

    const state = await client.query<{
      stage: string;
      won_quote_version_id: number;
      winning_quote_status: string;
      alternative_quote_status: string;
    }>(
      `SELECT o.stage,
              o.won_quote_version_id,
              winner.status AS winning_quote_status,
              alternative.status AS alternative_quote_status
         FROM agency_opportunities o
         JOIN agency_quotes winner ON winner.id = $2
         JOIN agency_quotes alternative ON alternative.id = $3
        WHERE o.id = $1`,
      [opportunityId, quoteId, alternativeQuoteId],
    );
    assert.deepEqual(state.rows[0], {
      stage: "won",
      won_quote_version_id: version3Id,
      winning_quote_status: "accepted",
      alternative_quote_status: "superseded",
    });
  } finally {
    await client.end();
    await pool.end();
  }
});
