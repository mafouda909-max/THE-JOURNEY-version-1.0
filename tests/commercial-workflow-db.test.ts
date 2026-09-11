import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Client } from "pg";
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

test("Canonical commercial workflow preserves tenant boundaries, versions, economics and outcomes", { skip: !databaseUrl }, async (t) => {
  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();

  try {
    await client.query(readFileSync("db/production_schema.sql", "utf8"));
    await client.query(readFileSync("db/phase1_agency_foundation.sql", "utf8"));
    await client.query(readFileSync("db/phase2_agency_commercial_domain.sql", "utf8"));

    async function createAgency(label: string) {
      const agent = await client.query<{ id: number }>(
        `INSERT INTO agents
          (display_name, latin_name, bio, photo_url, city, country, license_type, license_number,
           verification_status, specialty_tags, languages, response_rate, avg_response_hours, total_trips)
         VALUES ($1, $1, 'Commercial workflow agency', 'https://example.invalid/photo', 'Cairo', 'Egypt',
           'agency', $2, 'verified', '{}', '{Arabic}', 0, 0, 0)
         RETURNING id`,
        [label, `LIC-${label}`],
      );
      const account = await client.query<{ id: number }>(
        `INSERT INTO accounts (email, password_hash, role, display_name, agent_id)
         VALUES ($1, 'test:test', 'agent', $2, $3) RETURNING id`,
        [`${label.toLowerCase()}@example.invalid`, label, agent.rows[0]!.id],
      );
      const workspace = await client.query<{ id: number }>(
        `INSERT INTO agency_workspaces (agent_id, name, status) VALUES ($1, $2, 'active') RETURNING id`,
        [agent.rows[0]!.id, label],
      );
      await client.query(
        `INSERT INTO agency_memberships (workspace_id, account_id, role, status)
         VALUES ($1, $2, 'owner', 'active')`,
        [workspace.rows[0]!.id, account.rows[0]!.id],
      );
      const actor: CommercialActor = {
        workspaceId: workspace.rows[0]!.id,
        agentId: agent.rows[0]!.id,
        accountId: account.rows[0]!.id,
        membershipRole: "owner",
      };
      return actor;
    }

    const agencyA = await createAgency("AgencyA");
    const agencyB = await createAgency("AgencyB");

    let opportunityA = 0;
    let quoteA = 0;
    let quoteVersionA = 0;
    let supplierA = 0;

    await t.test("manual inquiry creates canonical opportunity plus immutable intent v1", async () => {
      const result = await executeCommercialCommand(agencyA, {
        command: "create_opportunity",
        source: "manual",
        title: "Istanbul October",
        client: { displayName: "Traveler One", email: "traveler1@example.invalid" },
        intent,
      });
      assert.equal(result.status, 201);
      opportunityA = Number((result.body.opportunity as Record<string, unknown>).id);
      assert.ok(opportunityA > 0);

      const stored = await client.query<{ revision: number; stage: string }>(
        `SELECT iv.revision, o.stage
           FROM agency_opportunities o
           JOIN agency_intent_versions iv ON iv.opportunity_id = o.id
          WHERE o.id = $1 AND o.workspace_id = $2`,
        [opportunityA, agencyA.workspaceId],
      );
      assert.deepEqual(stored.rows, [{ revision: 1, stage: "new" }]);
    });

    await t.test("supplier provenance is captured and cross-tenant supplier references are rejected", async () => {
      const own = await executeCommercialCommand(agencyA, {
        command: "record_supplier_option",
        opportunityId: opportunityA,
        category: "hotel",
        supplierName: "Hotel Supplier",
        description: "Central hotel for five nights",
        currency: "USD",
        costAmountMinor: 60000,
        commissionExpectedMinor: 7000,
        sourceType: "supplier_quote",
        sourceRef: "email:hotel-42",
        observedAt: new Date().toISOString(),
        validUntil: futureIso(72),
      });
      assert.equal(own.status, 201);
      supplierA = Number((own.body.supplierOption as Record<string, unknown>).id);
      assert.ok(supplierA > 0);

      const foreignOpportunity = await executeCommercialCommand(agencyB, {
        command: "create_opportunity",
        source: "manual",
        client: { displayName: "Traveler Two", email: "traveler2@example.invalid" },
        intent,
      });
      const foreignOpportunityId = Number((foreignOpportunity.body.opportunity as Record<string, unknown>).id);
      const crossTenantQuote = await executeCommercialCommand(agencyB, {
        command: "create_quote_version",
        opportunityId: foreignOpportunityId,
        validUntil: futureIso(24),
        lines: [{
          kind: "hotel",
          label: "Stolen supplier option",
          quantity: 1,
          currency: "USD",
          costUnitMinor: 60000,
          sellUnitMinor: 75000,
          commissionExpectedMinor: 7000,
          supplierOptionId: supplierA,
          provenance: {
            sourceType: "supplier_quote",
            sourceRef: "email:hotel-42",
            observedAt: new Date().toISOString(),
            validUntil: futureIso(24),
          },
        }],
      });
      assert.equal(crossTenantQuote.status, 422);
    });

    await t.test("quote versions snapshot economics, can be sent, and remain immutable", async () => {
      const quote = await executeCommercialCommand(agencyA, {
        command: "create_quote_version",
        opportunityId: opportunityA,
        validUntil: futureIso(48),
        clientFacingTerms: "Price subject to supplier validity.",
        lines: [
          {
            kind: "flight",
            label: "Round trip flights",
            quantity: 2,
            currency: "USD",
            costUnitMinor: 40000,
            sellUnitMinor: 46000,
            commissionExpectedMinor: 0,
            supplierOptionId: null,
            provenance: {
              sourceType: "booking_engine",
              sourceRef: "flight-search-1",
              observedAt: new Date().toISOString(),
              validUntil: futureIso(24),
            },
          },
          {
            kind: "hotel",
            label: "Central hotel",
            quantity: 1,
            currency: "USD",
            costUnitMinor: 60000,
            sellUnitMinor: 75000,
            commissionExpectedMinor: 7000,
            supplierOptionId: supplierA,
            provenance: {
              sourceType: "supplier_quote",
              sourceRef: "email:hotel-42",
              observedAt: new Date().toISOString(),
              validUntil: futureIso(48),
            },
          },
        ],
      });
      assert.equal(quote.status, 201);
      quoteA = Number(quote.body.quoteId);
      const version = quote.body.quoteVersion as Record<string, unknown>;
      quoteVersionA = Number(version.id);
      assert.ok(quoteA > 0 && quoteVersionA > 0);
      const economics = quote.body.economics as Record<string, unknown>;
      assert.equal(economics.costTotalMinor, 140000);
      assert.equal(economics.sellTotalMinor, 167000);
      assert.equal(economics.grossProfitMinor, 34000);

      const sent = await executeCommercialCommand(agencyA, {
        command: "send_quote",
        quoteId: quoteA,
        quoteVersionId: quoteVersionA,
        channel: "link",
      });
      assert.equal(sent.status, 200);

      await assert.rejects(
        client.query(`UPDATE agency_quote_versions SET sell_total_minor = sell_total_minor + 1 WHERE id = $1`, [quoteVersionA]),
        /immutable/i,
      );
      await assert.rejects(
        client.query(`DELETE FROM agency_intent_versions WHERE opportunity_id = $1`, [opportunityA]),
        /immutable/i,
      );
    });

    await t.test("follow-up cannot forge a quote from another opportunity or tenant", async () => {
      const forged = await executeCommercialCommand(agencyB, {
        command: "record_follow_up",
        opportunityId: opportunityA,
        quoteId: quoteA,
        quoteVersionId: quoteVersionA,
        channel: "email",
        note: "Cross-tenant attempt",
      });
      assert.equal(forged.status, 404);

      const valid = await executeCommercialCommand(agencyA, {
        command: "record_follow_up",
        opportunityId: opportunityA,
        quoteId: quoteA,
        quoteVersionId: quoteVersionA,
        channel: "email",
        note: "Traveler asked about hotel breakfast.",
      });
      assert.equal(valid.status, 200);
      const stage = await client.query<{ stage: string }>(`SELECT stage FROM agency_opportunities WHERE id = $1`, [opportunityA]);
      assert.equal(stage.rows[0]!.stage, "negotiating");
    });

    await t.test("won outcome binds the accepted quote version and feeds intelligence", async () => {
      const outcome = await executeCommercialCommand(agencyA, {
        command: "record_outcome",
        opportunityId: opportunityA,
        outcome: "won",
        quoteVersionId: quoteVersionA,
      });
      assert.equal(outcome.status, 200);

      const stored = await client.query<{ stage: string; won_quote_version_id: number; closed_at: Date }>(
        `SELECT stage, won_quote_version_id, closed_at FROM agency_opportunities WHERE id = $1`,
        [opportunityA],
      );
      assert.equal(stored.rows[0]!.stage, "won");
      assert.equal(stored.rows[0]!.won_quote_version_id, quoteVersionA);
      assert.ok(stored.rows[0]!.closed_at);

      const signals = await client.query<{ signal_kind: string }>(
        `SELECT signal_kind FROM agency_intelligence_signals WHERE opportunity_id = $1`,
        [opportunityA],
      );
      assert.ok(signals.rows.some((row) => row.signal_kind === "won_learning"));

      const afterTerminal = await executeCommercialCommand(agencyA, {
        command: "add_intent_version",
        opportunityId: opportunityA,
        intent: { ...intent, priorities: ["late checkout"] },
      });
      assert.equal(afterTerminal.status, 409);
    });

    await t.test("marketplace projection requires owner confirmation and remains a draft projection", async () => {
      const memberAccount = await client.query<{ id: number }>(
        `INSERT INTO accounts (email, password_hash, role, display_name)
         VALUES ('member@example.invalid', 'test:test', 'traveler', 'Member') RETURNING id`,
      );
      await client.query(
        `INSERT INTO agency_memberships (workspace_id, account_id, role, status) VALUES ($1,$2,'member','active')`,
        [agencyA.workspaceId, memberAccount.rows[0]!.id],
      );
      const memberActor: CommercialActor = { ...agencyA, accountId: memberAccount.rows[0]!.id, membershipRole: "member" };

      const denied = await executeCommercialCommand(memberActor, {
        command: "project_marketplace",
        quoteVersionId: quoteVersionA,
        confirmPublicProjection: true,
        title: "Istanbul city break",
        description: "Five nights in Istanbul with flights and central accommodation.",
        destinationCountry: "Türkiye",
        heroImage: "https://example.invalid/istanbul.jpg",
      });
      assert.equal(denied.status, 403);

      const projected = await executeCommercialCommand(agencyA, {
        command: "project_marketplace",
        quoteVersionId: quoteVersionA,
        confirmPublicProjection: true,
        title: "Istanbul city break",
        description: "Five nights in Istanbul with flights and central accommodation.",
        destinationCountry: "Türkiye",
        heroImage: "https://example.invalid/istanbul.jpg",
      });
      assert.equal(projected.status, 201);
      const projection = projected.body.projection as Record<string, unknown>;
      assert.equal(projection.status, "draft");
      assert.equal(JSON.stringify(projection).includes("traveler1@example.invalid"), false);

      const offers = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM offers`);
      assert.equal(offers.rows[0]!.count, "0");
    });
  } finally {
    await client.end();
  }
});
