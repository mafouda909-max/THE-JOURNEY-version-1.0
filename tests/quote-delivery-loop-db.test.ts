import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Client } from "pg";
import { pool } from "../src/db";
import { executeCommercialCommand, type CommercialActor } from "../src/lib/commercial-service";
import { activateQuoteDelivery, prepareQuoteDelivery } from "../src/lib/quote-delivery-agent";
import { getPublicQuoteDelivery, markQuoteDeliveryViewed, respondToQuoteDelivery } from "../src/lib/quote-delivery-public";

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

function quoteLines(label: string, sellUnitMinor: number, validUntil: string) {
  return [{
    kind: "hotel",
    label,
    quantity: 1,
    currency: "USD",
    costUnitMinor: 50000,
    sellUnitMinor,
    commissionExpectedMinor: 5000,
    supplierOptionId: null,
    provenance: {
      sourceType: "manual",
      sourceRef: "supplier-private-ref",
      observedAt: new Date().toISOString(),
      validUntil,
    },
  }];
}

test("secure quote delivery distinguishes preparation, communication, view and client response", { skip: !databaseUrl }, async () => {
  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();

  try {
    await client.query(readFileSync("db/production_schema.sql", "utf8"));
    await client.query(readFileSync("db/phase1_agency_foundation.sql", "utf8"));
    await client.query(readFileSync("db/phase2_agency_commercial_domain.sql", "utf8"));
    await client.query(readFileSync("db/phase3_supply_freshness_integrity.sql", "utf8"));
    await client.query(readFileSync("db/phase4_quote_delivery_integrity.sql", "utf8"));
    await client.query(readFileSync("db/phase5_quote_delivery_loop.sql", "utf8"));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const agent = await client.query<{ id: number }>(
      `INSERT INTO agents
        (display_name, latin_name, bio, photo_url, city, country, license_type, license_number,
         verification_status, specialty_tags, languages, response_rate, avg_response_hours, total_trips)
       VALUES ($1,$1,'Delivery loop agency','https://example.invalid/photo','Cairo','Egypt','agency',$2,
         'verified','{}','{Arabic}',0,0,0) RETURNING id`,
      [`DeliveryLoop-${suffix}`, `DL-${suffix}`],
    );
    const account = await client.query<{ id: number }>(
      `INSERT INTO accounts (email, password_hash, role, display_name, agent_id)
       VALUES ($1,'test:test','agent',$2,$3) RETURNING id`,
      [`delivery-loop-${suffix}@example.invalid`, `DeliveryLoop-${suffix}`, agent.rows[0]!.id],
    );
    const workspace = await client.query<{ id: number }>(
      `INSERT INTO agency_workspaces (agent_id, name, status) VALUES ($1,$2,'active') RETURNING id`,
      [agent.rows[0]!.id, `Delivery Loop ${suffix}`],
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
    const deliveryActor = { workspaceId: actor.workspaceId, accountId: actor.accountId };

    const created = await executeCommercialCommand(actor, {
      command: "create_opportunity",
      source: "manual",
      title: "Private traveler title must not leak",
      client: { displayName: "Private Traveler", email: `private-${suffix}@example.invalid` },
      intent,
    });
    assert.equal(created.status, 201);
    const opportunityId = Number((created.body.opportunity as Record<string, unknown>).id);

    const v1ValidUntil = futureIso(72);
    const v1 = await executeCommercialCommand(actor, {
      command: "create_quote_version",
      opportunityId,
      validUntil: v1ValidUntil,
      clientFacingTerms: "Client-visible cancellation terms only.",
      lines: quoteLines("Central hotel", 65000, v1ValidUntil),
    });
    assert.equal(v1.status, 201);
    const quoteId = Number(v1.body.quoteId);
    const version1Id = Number((v1.body.quoteVersion as Record<string, unknown>).id);

    const prepared = await prepareQuoteDelivery(deliveryActor, {
      quoteId,
      quoteVersionId: version1Id,
      channel: "whatsapp",
    });
    assert.equal(prepared.status, 201);
    const preparedBody = prepared.body as Record<string, unknown>;
    const token = String(preparedBody.activationToken);
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(preparedBody.state, "prepared");

    const beforeActivation = await client.query<{ status: string; sent_count: string; token_digest: string }>(
      `SELECT d.status,
              (SELECT COUNT(*)::text FROM agency_commercial_activities a
                WHERE a.opportunity_id = d.opportunity_id AND a.activity_type = 'quote_sent') AS sent_count,
              d.token_digest
         FROM agency_quote_deliveries d
        WHERE d.id = $1`,
      [preparedBody.deliveryId],
    );
    assert.equal(beforeActivation.rows[0]!.status, "prepared");
    assert.equal(beforeActivation.rows[0]!.sent_count, "0", "preparing a link must not fabricate a send event");
    assert.notEqual(beforeActivation.rows[0]!.token_digest, token, "plaintext bearer token must never be stored");
    assert.match(beforeActivation.rows[0]!.token_digest, /^[0-9a-f]{64}$/);

    const hiddenPrepared = await getPublicQuoteDelivery(token);
    assert.equal(hiddenPrepared.status, 404, "prepared links must not be client-readable before agent send confirmation");

    const activated = await activateQuoteDelivery(deliveryActor, { token });
    assert.equal(activated.status, 200);
    assert.equal((activated.body as Record<string, unknown>).state, "active");

    const afterActivation = await client.query<{ status: string; sent_count: string; opportunity_stage: string }>(
      `SELECT d.status,
              (SELECT COUNT(*)::text FROM agency_commercial_activities a
                WHERE a.opportunity_id = d.opportunity_id AND a.quote_version_id = d.quote_version_id AND a.activity_type = 'quote_sent') AS sent_count,
              o.stage AS opportunity_stage
         FROM agency_quote_deliveries d
         JOIN agency_opportunities o ON o.id = d.opportunity_id
        WHERE d.id = $1`,
      [preparedBody.deliveryId],
    );
    assert.deepEqual(afterActivation.rows[0], { status: "active", sent_count: "1", opportunity_stage: "quoted" });

    const publicView = await getPublicQuoteDelivery(token);
    assert.equal(publicView.status, 200);
    const publicJson = JSON.stringify(publicView.body);
    assert.match(publicJson, /Central hotel/);
    assert.match(publicJson, /Client-visible cancellation terms only/);
    assert.doesNotMatch(publicJson, /Private Traveler/);
    assert.doesNotMatch(publicJson, /private-.*@example\.invalid/);
    assert.doesNotMatch(publicJson, /supplier-private-ref/);
    assert.doesNotMatch(publicJson, /costUnitMinor/);
    assert.doesNotMatch(publicJson, /commissionExpectedMinor/);
    assert.doesNotMatch(publicJson, /grossProfitMinor/);
    assert.doesNotMatch(publicJson, /marginBps/);

    const firstView = await markQuoteDeliveryViewed(token);
    assert.equal(firstView.status, 200);
    assert.equal((firstView.body as Record<string, unknown>).firstView, true);
    const secondView = await markQuoteDeliveryViewed(token);
    assert.equal(secondView.status, 200);
    assert.equal((secondView.body as Record<string, unknown>).firstView, false);

    const viewCount = await client.query<{ count: string; stage: string }>(
      `SELECT
         (SELECT COUNT(*)::text FROM agency_commercial_activities
           WHERE workspace_id = $1 AND opportunity_id = $2 AND activity_type = 'quote_viewed') AS count,
         (SELECT stage FROM agency_opportunities WHERE id = $2) AS stage`,
      [actor.workspaceId, opportunityId],
    );
    assert.deepEqual(viewCount.rows[0], { count: "1", stage: "negotiating" });

    const response = await respondToQuoteDelivery(token, {
      response: "approved",
      message: "Please confirm final supplier availability.",
    });
    assert.equal(response.status, 200);

    const commercialState = await client.query<{
      delivery_status: string;
      delivery_response: string;
      opportunity_stage: string;
      won_quote_version_id: number | null;
      quote_status: string;
      client_response_count: string;
      signal_count: string;
    }>(
      `SELECT d.status AS delivery_status,
              d.response AS delivery_response,
              o.stage AS opportunity_stage,
              o.won_quote_version_id,
              q.status AS quote_status,
              (SELECT COUNT(*)::text FROM agency_commercial_activities a
                WHERE a.opportunity_id = o.id AND a.activity_type = 'client_response') AS client_response_count,
              (SELECT COUNT(*)::text FROM agency_intelligence_signals s
                WHERE s.opportunity_id = o.id AND s.signal_kind = 'client_approved') AS signal_count
         FROM agency_quote_deliveries d
         JOIN agency_opportunities o ON o.id = d.opportunity_id
         JOIN agency_quotes q ON q.id = d.quote_id
        WHERE d.id = $1`,
      [preparedBody.deliveryId],
    );
    assert.deepEqual(commercialState.rows[0], {
      delivery_status: "responded",
      delivery_response: "approved",
      opportunity_stage: "negotiating",
      won_quote_version_id: null,
      quote_status: "sent",
      client_response_count: "1",
      signal_count: "1",
    }, "client approval is a real signal but must not fabricate booking/payment or a won outcome");

    const duplicateResponse = await respondToQuoteDelivery(token, { response: "declined" });
    assert.equal(duplicateResponse.status, 409, "one delivery link must not accept conflicting client decisions");

    const v2ValidUntil = futureIso(72);
    const v2 = await executeCommercialCommand(actor, {
      command: "create_quote_version",
      opportunityId,
      quoteId,
      validUntil: v2ValidUntil,
      lines: quoteLines("Central hotel revised", 67000, v2ValidUntil),
    });
    assert.equal(v2.status, 201);
    const version2Id = Number((v2.body.quoteVersion as Record<string, unknown>).id);
    const preparedV2 = await prepareQuoteDelivery(deliveryActor, { quoteId, quoteVersionId: version2Id, channel: "link" });
    assert.equal(preparedV2.status, 201);
    const preparedV2Body = preparedV2.body as Record<string, unknown>;
    const tokenV2 = String(preparedV2Body.activationToken);
    const activatedV2 = await activateQuoteDelivery(deliveryActor, { token: tokenV2 });
    assert.equal(activatedV2.status, 200);

    const oldDeliveryState = await client.query<{ status: string }>(
      `SELECT status FROM agency_quote_deliveries WHERE id = $1`,
      [preparedBody.deliveryId],
    );
    assert.equal(oldDeliveryState.rows[0]!.status, "responded", "historical responded delivery stays immutable as response evidence");

    const oldLinkAfterNewSend = await getPublicQuoteDelivery(token);
    assert.equal(oldLinkAfterNewSend.status, 200, "responded delivery remains readable as the client's historical decision record until expiry");

    const won = await executeCommercialCommand(actor, {
      command: "record_outcome",
      opportunityId,
      outcome: "won",
      quoteVersionId: version2Id,
    });
    assert.equal(won.status, 200, "confirmed outcome must be able to settle an active client delivery");

    const settled = await client.query<{
      delivery_status: string;
      opportunity_stage: string;
      won_quote_version_id: number;
      quote_status: string;
    }>(
      `SELECT d.status AS delivery_status,
              o.stage AS opportunity_stage,
              o.won_quote_version_id,
              q.status AS quote_status
         FROM agency_quote_deliveries d
         JOIN agency_opportunities o ON o.id = d.opportunity_id
         JOIN agency_quotes q ON q.id = d.quote_id
        WHERE d.id = $1`,
      [preparedV2Body.deliveryId],
    );
    assert.deepEqual(settled.rows[0], {
      delivery_status: "revoked",
      opportunity_stage: "won",
      won_quote_version_id: version2Id,
      quote_status: "accepted",
    });

    const settledLink = await getPublicQuoteDelivery(tokenV2);
    assert.equal(settledLink.status, 410, "active client link must close after the quote becomes terminal");
  } finally {
    await client.end();
    await pool.end();
  }
});
