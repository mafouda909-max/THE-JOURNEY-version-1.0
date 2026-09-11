import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Client } from "pg";
import { pool } from "../src/db";
import { POST as createContact } from "../src/app/api/contact-requests/route";
import { POST as adoptInquiry } from "../src/app/api/agency/workspaces/[id]/inquiries/route";
import { executeCommercialCommand, type CommercialActor } from "../src/lib/commercial-service";

const databaseUrl = process.env.COMMERCIAL_WORKFLOW_TEST_DATABASE_URL;

function cookie(token: string) {
  return { cookie: `tj_sess=${token}` };
}

function iso(hours: number) {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

async function body(response: Response) {
  return await response.json() as Record<string, unknown>;
}

test("Marketplace inquiry becomes a traceable supplier-backed won opportunity end-to-end", { skip: !databaseUrl }, async () => {
  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();

  try {
    await client.query(readFileSync("db/production_schema.sql", "utf8"));
    await client.query(readFileSync("db/contact_request_ownership.sql", "utf8"));
    await client.query(readFileSync("db/phase1_agency_foundation.sql", "utf8"));
    await client.query(readFileSync("db/phase2_agency_commercial_domain.sql", "utf8"));
    await client.query(readFileSync("db/phase3_supply_freshness_integrity.sql", "utf8"));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const agent = await client.query<{ id: number }>(
      `INSERT INTO agents
        (display_name, latin_name, bio, photo_url, city, country, license_type, license_number,
         verification_status, specialty_tags, languages, response_rate, avg_response_hours, total_trips)
       VALUES ($1,$1,'E2E agency','https://example.invalid/e2e','Cairo','Egypt','agency',$2,
         'verified','{}','{Arabic}',100,1,0) RETURNING id`,
      [`E2E Agency ${suffix}`, `E2E-${suffix}`],
    );
    const account = await client.query<{ id: number }>(
      `INSERT INTO accounts (email,password_hash,role,display_name,agent_id)
       VALUES ($1,'test:test','agent',$2,$3) RETURNING id`,
      [`e2e-owner-${suffix}@example.invalid`, `E2E Owner ${suffix}`, agent.rows[0]!.id],
    );
    const token = `e2e-owner-${suffix}`;
    await client.query(
      `INSERT INTO sessions (token,account_id,expires_at) VALUES ($1,$2,NOW()+INTERVAL '1 hour')`,
      [token, account.rows[0]!.id],
    );
    const workspace = await client.query<{ id: number }>(
      `INSERT INTO agency_workspaces (agent_id,name,status) VALUES ($1,$2,'active') RETURNING id`,
      [agent.rows[0]!.id, `E2E Workspace ${suffix}`],
    );
    await client.query(
      `INSERT INTO agency_memberships (workspace_id,account_id,role,status) VALUES ($1,$2,'owner','active')`,
      [workspace.rows[0]!.id, account.rows[0]!.id],
    );
    const actor: CommercialActor = {
      workspaceId: workspace.rows[0]!.id,
      agentId: agent.rows[0]!.id,
      accountId: account.rows[0]!.id,
      membershipRole: "owner",
    };

    const offer = await client.query<{ id: number }>(
      `INSERT INTO offers
        (agent_id,title,title_en,description,trip_type,origin_city,destination_city,destination_country,
         destination_country_en,departure_date,duration_days,price_amount,currency,price_type,includes,excludes,
         min_travelers,max_travelers,status,hero_image,published_at,expires_at)
       VALUES ($1,$2,'Istanbul E2E','Published lead source','package','Cairo','Istanbul','تركيا','Türkiye',
         '2026-11-10T08:00:00Z',6,900,'USD','per_person','{}','{}',1,6,'published',
         'https://example.invalid/istanbul',NOW(),NOW()+INTERVAL '30 days') RETURNING id`,
      [agent.rows[0]!.id, `Istanbul E2E ${suffix}`],
    );

    const contactResponse = await createContact(new Request("http://local.test/api/contact-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        offerId: offer.rows[0]!.id,
        travelerName: "E2E Traveler",
        travelerEmail: `e2e-traveler-${suffix}@example.invalid`,
        travelerCount: 2,
        travelDates: "Can move by one day",
        message: "I need a central hotel and a flight option with one checked bag.",
      }),
    }));
    assert.equal(contactResponse.status, 201);
    const contactPayload = await body(contactResponse);
    const inquiryId = Number(contactPayload.id);
    assert.ok(inquiryId > 0);

    const adoptRequest = () => adoptInquiry(
      new Request(`http://local.test/api/agency/workspaces/${workspace.rows[0]!.id}/inquiries`, {
        method: "POST",
        headers: { ...cookie(token), "content-type": "application/json" },
        body: JSON.stringify({ inquiryId, intent: { destinations: ["FORGED"] } }),
      }),
      { params: Promise.resolve({ id: String(workspace.rows[0]!.id) }) },
    );
    const [adoptA, adoptB] = await Promise.all([adoptRequest(), adoptRequest()]);
    assert.deepEqual([adoptA.status, adoptB.status].sort((a, b) => a - b), [201, 409]);

    const opportunityRow = await client.query<{ id: number; source: string }>(
      `SELECT id,source FROM agency_opportunities WHERE workspace_id=$1 AND source_contact_request_id=$2`,
      [workspace.rows[0]!.id, inquiryId],
    );
    assert.equal(opportunityRow.rows.length, 1);
    assert.equal(opportunityRow.rows[0]!.source, "marketplace");
    const opportunityId = opportunityRow.rows[0]!.id;

    const revision = await executeCommercialCommand(actor, {
      command: "add_intent_version",
      opportunityId,
      intent: {
        originCity: "Cairo",
        destinations: ["Istanbul"],
        departureDate: "2026-11-11",
        returnDate: "2026-11-16",
        flexibilityDays: 1,
        travelers: { adults: 2, children: 0, infants: 0 },
        budgetAmountMinor: 180000,
        budgetCurrency: "USD",
        budgetBasis: "total",
        tripType: "package",
        priorities: ["central hotel", "checked bag"],
        constraints: [],
        notes: "Traveler confirmed dates by follow-up.",
      },
    });
    assert.equal(revision.status, 201);
    assert.equal(revision.body.revision, 2);

    const supplier = await executeCommercialCommand(actor, {
      command: "record_supplier_option",
      opportunityId,
      category: "hotel",
      supplierName: "Contracted Hotel API",
      description: "Five nights, refundable room",
      currency: "USD",
      costAmountMinor: 60000,
      commissionExpectedMinor: 6000,
      sourceType: "booking_engine",
      sourceRef: `hotel-api-${suffix}`,
      observedAt: iso(-0.25),
      validUntil: iso(8),
    });
    assert.equal(supplier.status, 201);
    const option = supplier.body.supplierOption as Record<string, unknown>;
    const supplierOptionId = Number(option.id);
    const observedAt = new Date(String(option.observedAt)).toISOString();
    const validUntil = new Date(String(option.validUntil)).toISOString();

    const quoteCountBefore = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM agency_quotes WHERE opportunity_id=$1`,
      [opportunityId],
    );
    assert.equal(quoteCountBefore.rows[0]!.count, "0");

    const tampered = await executeCommercialCommand(actor, {
      command: "create_quote_version",
      opportunityId,
      validUntil: iso(4),
      lines: [{
        kind: "hotel",
        label: "Tampered cost",
        quantity: 1,
        currency: "USD",
        costUnitMinor: 1,
        sellUnitMinor: 78000,
        commissionExpectedMinor: 6000,
        supplierOptionId,
        provenance: {
          sourceType: "booking_engine",
          sourceRef: `hotel-api-${suffix}`,
          observedAt,
          validUntil,
        },
      }],
    });
    assert.equal(tampered.status, 422);
    const quoteCountAfterFailure = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM agency_quotes WHERE opportunity_id=$1`,
      [opportunityId],
    );
    assert.equal(quoteCountAfterFailure.rows[0]!.count, "0", "failed quote must roll back its parent quote record");

    const quoted = await executeCommercialCommand(actor, {
      command: "create_quote_version",
      opportunityId,
      validUntil: iso(4),
      lines: [{
        kind: "hotel",
        label: "Five nights, refundable room",
        quantity: 1,
        currency: "USD",
        costUnitMinor: 60000,
        sellUnitMinor: 78000,
        commissionExpectedMinor: 6000,
        supplierOptionId,
        provenance: {
          sourceType: "booking_engine",
          sourceRef: `hotel-api-${suffix}`,
          observedAt,
          validUntil,
        },
      }],
    });
    assert.equal(quoted.status, 201);
    const quoteId = Number(quoted.body.quoteId);
    const quoteVersionId = Number((quoted.body.quoteVersion as Record<string, unknown>).id);
    assert.equal((quoted.body.economics as Record<string, unknown>).grossProfitMinor, 24000);

    const sent = await executeCommercialCommand(actor, {
      command: "send_quote",
      quoteId,
      quoteVersionId,
      channel: "link",
    });
    assert.equal(sent.status, 200);

    const followed = await executeCommercialCommand(actor, {
      command: "record_follow_up",
      opportunityId,
      quoteId,
      quoteVersionId,
      channel: "whatsapp",
      note: "Traveler confirmed the hotel and final price.",
    });
    assert.equal(followed.status, 200);

    const won = await executeCommercialCommand(actor, {
      command: "record_outcome",
      opportunityId,
      outcome: "won",
      quoteVersionId,
    });
    assert.equal(won.status, 200);

    const aggregate = await client.query<{
      stage: string;
      won_quote_version_id: number;
      quote_status: string;
      activity_count: string;
      event_count: string;
      signal_count: string;
    }>(
      `SELECT
         o.stage,
         o.won_quote_version_id,
         q.status AS quote_status,
         (SELECT COUNT(*)::text FROM agency_commercial_activities a WHERE a.opportunity_id=o.id) AS activity_count,
         (SELECT COUNT(*)::text FROM agency_domain_events e WHERE e.workspace_id=o.workspace_id AND (e.reference_id=o.id OR e.payload->>'opportunityId'=o.id::text)) AS event_count,
         (SELECT COUNT(*)::text FROM agency_intelligence_signals s WHERE s.opportunity_id=o.id) AS signal_count
       FROM agency_opportunities o
       JOIN agency_quotes q ON q.id=$2 AND q.opportunity_id=o.id
       WHERE o.id=$1 AND o.workspace_id=$3`,
      [opportunityId, quoteId, workspace.rows[0]!.id],
    );
    assert.equal(aggregate.rows[0]!.stage, "won");
    assert.equal(aggregate.rows[0]!.won_quote_version_id, quoteVersionId);
    assert.equal(aggregate.rows[0]!.quote_status, "accepted");
    assert.ok(Number(aggregate.rows[0]!.activity_count) >= 3);
    assert.ok(Number(aggregate.rows[0]!.event_count) >= 5);
    assert.ok(Number(aggregate.rows[0]!.signal_count) >= 1);

    const afterWon = await executeCommercialCommand(actor, {
      command: "record_supplier_option",
      opportunityId,
      category: "hotel",
      supplierName: "Late mutation",
      description: "Should not be accepted after terminal outcome",
      currency: "USD",
      costAmountMinor: 1,
      commissionExpectedMinor: 0,
      sourceType: "manual",
      sourceRef: "late",
      observedAt: iso(0),
      validUntil: iso(1),
    });
    assert.equal(afterWon.status, 409);
  } finally {
    await pool.end().catch(() => undefined);
    await client.end().catch(() => undefined);
  }
});
