import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Client } from "pg";
import { pool } from "../src/db";
import { POST as createIntent } from "../src/app/api/traveler/intents/route";
import { POST as saveIntentOffer } from "../src/app/api/traveler/intents/[id]/offers/route";
import { POST as createContact } from "../src/app/api/contact-requests/route";
import { POST as adoptInquiry } from "../src/app/api/agency/workspaces/[id]/inquiries/route";
import { executeCommercialCommand, type CommercialActor } from "../src/lib/commercial-service";
import { activateQuoteDelivery, prepareQuoteDelivery } from "../src/lib/quote-delivery-agent";

const databaseUrl = process.env.COMMERCIAL_WORKFLOW_TEST_DATABASE_URL;

function cookie(token: string) {
  return { cookie: `tj_sess=${token}` };
}

function futureIso(hours: number) {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

async function json(response: Response) {
  return await response.json() as Record<string, unknown>;
}

test("saved intent flows through marketplace inquiry into an active agency quote delivery", { skip: !databaseUrl }, async () => {
  process.env.TRAVELER_WORKSPACE_ENABLED = "true";
  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();

  try {
    const manifest = JSON.parse(readFileSync("db/release_manifest.json", "utf8")) as {
      baseSchema: string;
      existingDatabaseMigrations: string[];
    };
    await client.query(readFileSync(manifest.baseSchema, "utf8"));
    for (const migration of manifest.existingDatabaseMigrations) {
      await client.query(readFileSync(migration, "utf8"));
    }

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const agent = await client.query<{ id: number }>(
      `INSERT INTO agents
        (display_name, latin_name, bio, photo_url, city, country, license_type, license_number,
         verification_status, specialty_tags, languages, response_rate, avg_response_hours, total_trips)
       VALUES ($1,$1,'Intent E2E agency','https://example.invalid/intent-e2e','Cairo','Egypt','agency',$2,
         'verified','{}','{Arabic}',100,1,0) RETURNING id`,
      [`Intent E2E Agency ${suffix}`, `INT-${suffix}`],
    );

    const scopedTrustAgentId = agent.rows[0]!.id;
    for (const documentType of ["identity", "license", "commercial_register"]) {
      await client.query(
        `INSERT INTO agent_documents
          (agent_id,document_type,storage_key,original_name,status,verified_at,expires_at)
         VALUES($1,$2,$3,$4,'verified',NOW(),NOW()+INTERVAL '1 year')`,
        [scopedTrustAgentId, documentType, `kyc/agent_${scopedTrustAgentId}/${documentType}_intent-e2e.pdf`, `${documentType}-intent-e2e.pdf`],
      );
    }
    const agentAccount = await client.query<{ id: number }>(
      `INSERT INTO accounts (email,password_hash,role,display_name,agent_id)
       VALUES ($1,'test:test','agent',$2,$3) RETURNING id`,
      [`intent-agent-${suffix}@example.invalid`, `Intent Agent ${suffix}`, agent.rows[0]!.id],
    );
    const agentToken = `intent-agent-${suffix}`;
    await client.query(
      `INSERT INTO sessions (token,account_id,expires_at) VALUES ($1,$2,NOW()+INTERVAL '1 hour')`,
      [agentToken, agentAccount.rows[0]!.id],
    );

    const workspace = await client.query<{ id: number }>(
      `INSERT INTO agency_workspaces (agent_id,name,status) VALUES ($1,$2,'active') RETURNING id`,
      [agent.rows[0]!.id, `Intent E2E Workspace ${suffix}`],
    );
    await client.query(
      `INSERT INTO agency_memberships (workspace_id,account_id,role,status)
       VALUES ($1,$2,'owner','active')`,
      [workspace.rows[0]!.id, agentAccount.rows[0]!.id],
    );

    const offer = await client.query<{ id: number }>(
      `INSERT INTO offers
        (agent_id,title,title_en,description,trip_type,origin_city,destination_city,destination_country,
         destination_country_en,departure_date,duration_days,price_amount,currency,price_type,includes,excludes,
         min_travelers,max_travelers,status,hero_image,published_at,expires_at)
       VALUES ($1,$2,'Intent E2E Istanbul','Grounded marketplace offer','package','Cairo','Istanbul','Turkey','Türkiye',
         '2026-11-10T08:00:00Z',6,900,'USD','per_person','{}','{}',1,6,'published',
         'https://example.invalid/intent-offer',NOW(),NOW()+INTERVAL '30 days') RETURNING id`,
      [agent.rows[0]!.id, `Intent E2E Offer ${suffix}`],
    );

    const traveler = await client.query<{ id: number }>(
      `INSERT INTO accounts (email,password_hash,role,display_name)
       VALUES ($1,'test:test','traveler',$2) RETURNING id`,
      [`intent-traveler-${suffix}@example.invalid`, `Intent Traveler ${suffix}`],
    );
    const travelerToken = `intent-traveler-${suffix}`;
    await client.query(
      `INSERT INTO sessions (token,account_id,expires_at) VALUES ($1,$2,NOW()+INTERVAL '1 hour')`,
      [travelerToken, traveler.rows[0]!.id],
    );

    const travelerB = await client.query<{ id: number }>(
      `INSERT INTO accounts (email,password_hash,role,display_name)
       VALUES ($1,'test:test','traveler',$2) RETURNING id`,
      [`intent-other-${suffix}@example.invalid`, `Other Traveler ${suffix}`],
    );
    const travelerBToken = `intent-other-${suffix}`;
    await client.query(
      `INSERT INTO sessions (token,account_id,expires_at) VALUES ($1,$2,NOW()+INTERVAL '1 hour')`,
      [travelerBToken, travelerB.rows[0]!.id],
    );

    const intentResponse = await createIntent(new Request("http://local.test/api/traveler/intents", {
      method: "POST",
      headers: { ...cookie(travelerToken), "content-type": "application/json" },
      body: JSON.stringify({
        label: "Istanbul November",
        intent: {
          originCity: "Cairo",
          destinations: ["Istanbul"],
          departureDate: "2026-11-10",
          returnDate: "2026-11-15",
          flexibilityDays: 1,
          travelers: { adults: 2, children: 0, infants: 0 },
          budgetAmountMinor: 180000,
          budgetCurrency: "USD",
          budgetBasis: "total",
          tripType: "package",
          priorities: ["central hotel"],
          constraints: [],
          notes: "One checked bag preferred.",
        },
      }),
    }));
    assert.equal(intentResponse.status, 201);
    const intentPayload = await json(intentResponse);
    const intentId = Number((intentPayload.intent as Record<string, unknown>).id);
    assert.ok(intentId > 0);

    const saveOfferResponse = await saveIntentOffer(
      new Request(`http://local.test/api/traveler/intents/${intentId}/offers`, {
        method: "POST",
        headers: { ...cookie(travelerToken), "content-type": "application/json" },
        body: JSON.stringify({ offerId: offer.rows[0]!.id }),
      }),
      { params: Promise.resolve({ id: String(intentId) }) },
    );
    assert.equal(saveOfferResponse.status, 201);

    const foreignContact = await createContact(new Request("http://local.test/api/contact-requests", {
      method: "POST",
      headers: { ...cookie(travelerBToken), "content-type": "application/json" },
      body: JSON.stringify({
        offerId: offer.rows[0]!.id,
        savedIntentId: intentId,
        travelerName: "Other Traveler",
        travelerEmail: `intent-other-${suffix}@example.invalid`,
        travelerCount: 2,
        message: "This traveler must not be able to bind another account intent.",
      }),
    }));
    assert.equal(foreignContact.status, 404);

    const foreignRows = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM contact_requests WHERE traveler_account_id=$1`,
      [travelerB.rows[0]!.id],
    );
    assert.equal(foreignRows.rows[0]!.count, "0");

    const contactResponse = await createContact(new Request("http://local.test/api/contact-requests", {
      method: "POST",
      headers: { ...cookie(travelerToken), "content-type": "application/json" },
      body: JSON.stringify({
        offerId: offer.rows[0]!.id,
        savedIntentId: intentId,
        travelerName: "Intent Traveler",
        travelerEmail: `intent-traveler-${suffix}@example.invalid`,
        travelerCount: 2,
        travelDates: "One day flexibility",
        message: "Please prepare a grounded quote linked to this saved trip.",
      }),
    }));
    assert.equal(contactResponse.status, 201);
    const contactPayload = await json(contactResponse);
    const inquiryId = Number(contactPayload.id);
    assert.ok(inquiryId > 0);

    const linkage = await client.query<{
      offer_links: string;
      inquiry_links: string;
      contact_owner: number;
    }>(
      `SELECT
        (SELECT COUNT(*)::text FROM traveler_intent_offers WHERE saved_intent_id=$1 AND offer_id=$2) AS offer_links,
        (SELECT COUNT(*)::text FROM traveler_intent_inquiries WHERE saved_intent_id=$1 AND contact_request_id=$3) AS inquiry_links,
        (SELECT traveler_account_id FROM contact_requests WHERE id=$3) AS contact_owner`,
      [intentId, offer.rows[0]!.id, inquiryId],
    );
    assert.deepEqual(linkage.rows[0], {
      offer_links: "1",
      inquiry_links: "1",
      contact_owner: traveler.rows[0]!.id,
    });

    const adoption = await adoptInquiry(
      new Request(`http://local.test/api/agency/workspaces/${workspace.rows[0]!.id}/inquiries`, {
        method: "POST",
        headers: { ...cookie(agentToken), "content-type": "application/json" },
        body: JSON.stringify({ inquiryId }),
      }),
      { params: Promise.resolve({ id: String(workspace.rows[0]!.id) }) },
    );
    assert.equal(adoption.status, 201);

    const opportunity = await client.query<{ id: number }>(
      `SELECT id FROM agency_opportunities
        WHERE workspace_id=$1 AND source_contact_request_id=$2 LIMIT 1`,
      [workspace.rows[0]!.id, inquiryId],
    );
    const opportunityId = opportunity.rows[0]!.id;
    assert.ok(opportunityId > 0);

    const actor: CommercialActor = {
      workspaceId: workspace.rows[0]!.id,
      agentId: agent.rows[0]!.id,
      accountId: agentAccount.rows[0]!.id,
      membershipRole: "owner",
    };

    const validUntil = futureIso(72);
    const quoted = await executeCommercialCommand(actor, {
      command: "create_quote_version",
      opportunityId,
      validUntil,
      clientFacingTerms: "Availability must be reconfirmed before payment.",
      lines: [{
        kind: "hotel",
        label: "Five nights — supplier availability pending final confirmation",
        quantity: 1,
        currency: "USD",
        costUnitMinor: 50000,
        sellUnitMinor: 65000,
        commissionExpectedMinor: 5000,
        supplierOptionId: null,
        provenance: {
          sourceType: "manual",
          sourceRef: `manual-e2e-evidence-${suffix}`,
          observedAt: new Date().toISOString(),
          validUntil,
        },
      }],
    });
    assert.equal(quoted.status, 201, JSON.stringify(quoted.body));
    const quoteId = Number(quoted.body.quoteId);
    const quoteVersionId = Number((quoted.body.quoteVersion as Record<string, unknown>).id);

    const prepared = await prepareQuoteDelivery(
      { workspaceId: actor.workspaceId, accountId: actor.accountId },
      { quoteId, quoteVersionId, channel: "link" },
    );
    assert.equal(prepared.status, 201);
    const activationToken = String((prepared.body as Record<string, unknown>).activationToken);

    const activated = await activateQuoteDelivery(
      { workspaceId: actor.workspaceId, accountId: actor.accountId },
      { token: activationToken },
    );
    assert.equal(activated.status, 200);

    const fullChain = await client.query<{
      intent_id: number;
      contact_id: number;
      opportunity_id: number;
      quote_id: number;
      quote_version_id: number;
      delivery_status: string;
    }>(
      `SELECT tsi.id AS intent_id,
              cr.id AS contact_id,
              ao.id AS opportunity_id,
              q.id AS quote_id,
              qd.quote_version_id,
              qd.status AS delivery_status
         FROM traveler_saved_intents tsi
         JOIN traveler_intent_inquiries ti ON ti.saved_intent_id=tsi.id
         JOIN contact_requests cr ON cr.id=ti.contact_request_id
         JOIN agency_opportunities ao ON ao.source_contact_request_id=cr.id
         JOIN agency_quotes q ON q.opportunity_id=ao.id
         JOIN agency_quote_deliveries qd ON qd.quote_id=q.id AND qd.opportunity_id=ao.id
        WHERE tsi.id=$1 AND tsi.account_id=$2
        ORDER BY qd.created_at DESC
        LIMIT 1`,
      [intentId, traveler.rows[0]!.id],
    );

    assert.deepEqual(fullChain.rows[0], {
      intent_id: intentId,
      contact_id: inquiryId,
      opportunity_id: opportunityId,
      quote_id: quoteId,
      quote_version_id: quoteVersionId,
      delivery_status: "active",
    });
  } finally {
    delete process.env.TRAVELER_WORKSPACE_ENABLED;
    await pool.end().catch(() => undefined);
    await client.end().catch(() => undefined);
  }
});
