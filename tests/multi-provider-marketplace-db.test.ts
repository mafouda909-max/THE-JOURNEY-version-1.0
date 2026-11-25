import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Client } from "pg";
import { pool } from "../src/db";
import { POST as createTravelerRequest } from "../src/app/api/traveler/requests/route";
import { GET as listAgencyInquiries, POST as adoptAgencyInquiry } from "../src/app/api/agency/workspaces/[id]/inquiries/route";
import { GET as getTravelerRequest } from "../src/app/api/traveler/requests/[id]/route";
import { POST as respondTravelerQuote } from "../src/app/api/traveler/requests/[id]/quotes/[deliveryId]/respond/route";
import { POST as reportDirectConfirmation } from "../src/app/api/agency/workspaces/[id]/opportunities/[opportunityId]/direct-confirmation/route";
import { POST as acknowledgeDirectConfirmation } from "../src/app/api/traveler/requests/[id]/quotes/[deliveryId]/acknowledge/route";
import { executeCommercialCommand, type CommercialActor } from "../src/lib/commercial-service";
import { prepareQuoteDelivery, activateQuoteDelivery } from "../src/lib/quote-delivery-agent";
import { respondToQuoteDelivery } from "../src/lib/quote-delivery-public";

const databaseUrl = process.env.COMMERCIAL_WORKFLOW_TEST_DATABASE_URL;

function cookie(token: string) {
  return { cookie: `tj_sess=${token}` };
}
async function json(response: Response) {
  return await response.json() as Record<string, unknown>;
}
function futureIso(hours: number) {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

test("one traveler request routes to five eligible agencies, creates isolated opportunities and collects independent quote decisions", { skip: !databaseUrl }, async () => {
  const previousMultiProvider = process.env.MULTI_PROVIDER_REQUESTS_ENABLED;
  const previousTravelerWorkspace = process.env.TRAVELER_WORKSPACE_ENABLED;
  const previousDirectConfirmation = process.env.DIRECT_CONFIRMATION_ENABLED;
  process.env.MULTI_PROVIDER_REQUESTS_ENABLED = "true";
  process.env.TRAVELER_WORKSPACE_ENABLED = "true";
  process.env.DIRECT_CONFIRMATION_ENABLED = "true";

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

    async function createAgency(index: number, specialty: string, trusted = true) {
      const agent = await client.query<{ id: number }>(
        `INSERT INTO agents
          (display_name,latin_name,bio,photo_url,city,country,license_type,license_number,
           verification_status,specialty_tags,languages,response_rate,avg_response_hours,total_trips)
         VALUES ($1,$1,'Marketplace test agency','https://example.invalid/provider','Cairo','Egypt','agency',$2,
           'verified',$3,'{Arabic}',$4,$5,$6)
         RETURNING id`,
        [
          `Multi Provider ${suffix} ${index}`,
          `MP-${suffix}-${index}`,
          [specialty],
          70 + index,
          10 - index,
          index * 20,
        ],
      );
      const owner = await client.query<{ id: number }>(
        `INSERT INTO accounts (email,password_hash,role,display_name,agent_id)
         VALUES ($1,'test:test','agent',$2,$3) RETURNING id`,
        [`mp-owner-${suffix}-${index}@example.invalid`, `Provider Owner ${index}`, agent.rows[0]!.id],
      );
      const workspace = await client.query<{ id: number }>(
        `INSERT INTO agency_workspaces (agent_id,name,status)
         VALUES ($1,$2,'active') RETURNING id`,
        [agent.rows[0]!.id, `Multi Provider Workspace ${index}`],
      );
      await client.query(
        `INSERT INTO agency_memberships (workspace_id,account_id,role,status)
         VALUES ($1,$2,'owner','active')`,
        [workspace.rows[0]!.id, owner.rows[0]!.id],
      );
      if (trusted) {
        for (const documentType of ["identity", "license", "commercial_register"]) {
          await client.query(
            `INSERT INTO agent_documents
              (agent_id,document_type,storage_key,original_name,status,verified_at,expires_at)
             VALUES ($1,$2,$3,$4,'verified',NOW(),NOW()+INTERVAL '1 year')`,
            [agent.rows[0]!.id, documentType, `kyc/mp_${agent.rows[0]!.id}/${documentType}.pdf`, `${documentType}.pdf`],
          );
        }
      }
      const token = `mp-owner-session-${suffix}-${index}`;
      await client.query(
        `INSERT INTO sessions (token,account_id,expires_at)
         VALUES ($1,$2,NOW()+INTERVAL '1 hour')`,
        [token, owner.rows[0]!.id],
      );
      return {
        agentId: agent.rows[0]!.id,
        accountId: owner.rows[0]!.id,
        workspaceId: workspace.rows[0]!.id,
        token,
        name: `Multi Provider ${suffix} ${index}`,
      };
    }

    const eligible = [];
    for (let index = 1; index <= 6; index += 1) {
      eligible.push(await createAgency(index, "hotel", true));
    }
    const wrongCategory = await createAgency(7, "flight", true);
    const untrusted = await createAgency(8, "hotel", false);

    const traveler = await client.query<{ id: number }>(
      `INSERT INTO accounts (email,password_hash,role,display_name)
       VALUES ($1,'test:test','traveler','Traveler Multi Provider') RETURNING id`,
      [`mp-traveler-${suffix}@example.invalid`],
    );
    const travelerToken = `mp-traveler-session-${suffix}`;
    await client.query(
      `INSERT INTO sessions (token,account_id,expires_at)
       VALUES ($1,$2,NOW()+INTERVAL '1 hour')`,
      [travelerToken, traveler.rows[0]!.id],
    );

    const createResponse = await createTravelerRequest(new Request("http://local.test/api/traveler/requests", {
      method: "POST",
      headers: { ...cookie(travelerToken), "content-type": "application/json", "x-forwarded-for": "198.51.100.44" },
      body: JSON.stringify({
        category: "hotel",
        shareWithProviders: true,
        intent: {
          originCity: "Cairo",
          destinations: ["Istanbul"],
          departureDate: "2027-04-10",
          returnDate: "2027-04-15",
          flexibilityDays: 1,
          travelers: { adults: 2, children: 1, infants: 0 },
          budgetAmountMinor: 200000,
          budgetCurrency: "EGP",
          budgetBasis: "total",
          tripType: "hotel",
          priorities: ["central location"],
          constraints: ["family room"],
          notes: "Breakfast preferred.",
        },
      }),
    }));
    assert.equal(createResponse.status, 201, JSON.stringify(await json(createResponse)));
    const createPayload = await json(createResponse);
    const requestInfo = createPayload.request as Record<string, unknown>;
    const requestId = Number(requestInfo.id);
    assert.ok(requestId > 0);
    assert.equal(requestInfo.providerCount, 5);
    const selectedProviders = requestInfo.providers as Array<Record<string, unknown>>;
    assert.equal(selectedProviders.length, 5);
    assert.equal(selectedProviders.some((provider) => provider.name === wrongCategory.name), false);
    assert.equal(selectedProviders.some((provider) => provider.name === untrusted.name), false);

    const requestRoot = await client.query<{
      request_kind: string;
      offer_id: number | null;
      agent_id: number | null;
      traveler_account_id: number;
      share_consent_at: Date | null;
      request_snapshot: Record<string, unknown>;
    }>(
      `SELECT request_kind,offer_id,agent_id,traveler_account_id,share_consent_at,request_snapshot
         FROM contact_requests WHERE id=$1`,
      [requestId],
    );
    assert.equal(requestRoot.rows[0]!.request_kind, "open_request");
    assert.equal(requestRoot.rows[0]!.offer_id, null);
    assert.equal(requestRoot.rows[0]!.agent_id, null);
    assert.equal(requestRoot.rows[0]!.traveler_account_id, traveler.rows[0]!.id);
    assert.ok(requestRoot.rows[0]!.share_consent_at);
    assert.deepEqual(requestRoot.rows[0]!.request_snapshot.intent, {
      originCity: "Cairo",
      destinations: ["Istanbul"],
      departureDate: "2027-04-10",
      returnDate: "2027-04-15",
      flexibilityDays: 1,
      travelers: { adults: 2, children: 1, infants: 0 },
      budgetAmountMinor: 200000,
      budgetCurrency: "EGP",
      budgetBasis: "total",
      tripType: "hotel",
      priorities: ["central location"],
      constraints: ["family room"],
      notes: "Breakfast preferred.",
    });

    const recipients = await client.query<{ workspace_id: number; agent_id: number; status: string }>(
      `SELECT workspace_id,agent_id,status FROM marketplace_request_recipients
        WHERE contact_request_id=$1 ORDER BY id`,
      [requestId],
    );
    assert.equal(recipients.rows.length, 5);
    assert.ok(recipients.rows.every((row) => row.status === "sent"));

    const outsiderList = await listAgencyInquiries(
      new Request(`http://local.test/api/agency/workspaces/${wrongCategory.workspaceId}/inquiries`, { headers: cookie(wrongCategory.token) }),
      { params: Promise.resolve({ id: String(wrongCategory.workspaceId) }) },
    );
    assert.equal(outsiderList.status, 200);
    const outsiderBody = await json(outsiderList);
    assert.equal((outsiderBody.inquiries as Array<Record<string, unknown>>).some((row) => row.id === requestId), false);

    const first = eligible.find((item) => item.workspaceId === recipients.rows[0]!.workspace_id)!;
    const second = eligible.find((item) => item.workspaceId === recipients.rows[1]!.workspace_id)!;

    for (const agency of [first, second]) {
      const inbox = await listAgencyInquiries(
        new Request(`http://local.test/api/agency/workspaces/${agency.workspaceId}/inquiries`, { headers: cookie(agency.token) }),
        { params: Promise.resolve({ id: String(agency.workspaceId) }) },
      );
      assert.equal(inbox.status, 200);
      const inboxRows = (await json(inbox)).inquiries as Array<Record<string, unknown>>;
      const visible = inboxRows.find((row) => row.id === requestId);
      assert.ok(visible);
      assert.equal(visible!.requestKind, "open_request");
      assert.equal(visible!.travelerName, `مسافر صلة · TRQ-${String(requestId).padStart(5, "0")}`);
      assert.equal(Object.hasOwn(visible!, "travelerEmail"), false);
      assert.equal(Object.hasOwn(visible!, "email"), false);

      const adopted = await adoptAgencyInquiry(
        new Request(`http://local.test/api/agency/workspaces/${agency.workspaceId}/inquiries`, {
          method: "POST",
          headers: { ...cookie(agency.token), "content-type": "application/json" },
          body: JSON.stringify({
            inquiryId: requestId,
            intent: { originCity: "FORGED", destinations: ["FORGED"], travelers: { adults: 99, children: 0, infants: 0 } },
          }),
        }),
        { params: Promise.resolve({ id: String(agency.workspaceId) }) },
      );
      assert.equal(adopted.status, 201, JSON.stringify(await json(adopted)));
    }

    const opportunityRows = await client.query<{
      workspace_id: number;
      client_display_name: string;
      client_email: string | null;
      platform_account_id: number | null;
    }>(
      `SELECT ao.workspace_id, ac.display_name AS client_display_name,
              ac.email AS client_email, ac.platform_account_id
         FROM agency_opportunities ao
         JOIN agency_clients ac ON ac.id=ao.client_id
        WHERE ao.source_contact_request_id=$1
        ORDER BY ao.workspace_id`,
      [requestId],
    );
    assert.equal(opportunityRows.rows.length, 2);
    assert.ok(opportunityRows.rows.every((row) => row.client_email === null));
    assert.ok(opportunityRows.rows.every((row) => row.platform_account_id === traveler.rows[0]!.id));
    assert.ok(opportunityRows.rows.every((row) => row.client_display_name.startsWith("مسافر صلة · TRQ-")));

    async function createQuote(agency: typeof first, currency: "USD" | "EUR", label: string) {
      const opportunity = await client.query<{ id: number }>(
        `SELECT id FROM agency_opportunities
          WHERE workspace_id=$1 AND source_contact_request_id=$2 LIMIT 1`,
        [agency.workspaceId, requestId],
      );
      const actor: CommercialActor = {
        workspaceId: agency.workspaceId,
        agentId: agency.agentId,
        accountId: agency.accountId,
        membershipRole: "owner",
      };
      const validUntil = futureIso(48);
      const result = await executeCommercialCommand(actor, {
        command: "create_quote_version",
        opportunityId: opportunity.rows[0]!.id,
        validUntil,
        clientFacingTerms: "تأكيد التوافر النهائي يتم مباشرة مع مقدم الخدمة.",
        lines: [{
          kind: "hotel",
          label,
          quantity: 1,
          currency,
          costUnitMinor: 80000,
          sellUnitMinor: 95000,
          commissionExpectedMinor: 0,
          supplierOptionId: null,
          provenance: {
            sourceType: "manual",
            sourceRef: `multi-provider-${suffix}-${agency.agentId}`,
            observedAt: new Date().toISOString(),
            validUntil,
          },
        }],
      });
      assert.equal(result.status, 201, JSON.stringify(result.body));
      const quoteId = Number(result.body.quoteId);
      const versionId = Number((result.body.quoteVersion as Record<string, unknown>).id);
      const prepared = await prepareQuoteDelivery(
        { workspaceId: actor.workspaceId, accountId: actor.accountId },
        { quoteId, quoteVersionId: versionId, channel: "link" },
      );
      assert.equal(prepared.status, 201);
      const token = String((prepared.body as Record<string, unknown>).activationToken);
      const activated = await activateQuoteDelivery(
        { workspaceId: actor.workspaceId, accountId: actor.accountId },
        { token },
      );
      assert.equal(activated.status, 200);
      const delivery = await client.query<{ id: number }>(
        `SELECT id FROM agency_quote_deliveries WHERE quote_id=$1 AND status='active' ORDER BY id DESC LIMIT 1`,
        [quoteId],
      );
      return { deliveryId: delivery.rows[0]!.id, token, quoteId };
    }

    const firstQuote = await createQuote(first, "USD", "خمس ليالٍ في فندق وسط المدينة");
    const secondQuote = await createQuote(second, "EUR", "غرفة عائلية مع إفطار");

    const travelerDetail = await getTravelerRequest(
      new Request(`http://local.test/api/traveler/requests/${requestId}`, { headers: cookie(travelerToken) }),
      { params: Promise.resolve({ id: String(requestId) }) },
    );
    assert.equal(travelerDetail.status, 200);
    const detailPayload = await json(travelerDetail);
    const detailProviders = detailPayload.providers as Array<Record<string, unknown>>;
    const quoteCards = detailProviders.flatMap((provider) => provider.quotes as Array<Record<string, unknown>>);
    assert.equal(quoteCards.length, 2);
    assert.deepEqual(new Set(quoteCards.map((quote) => quote.currency)), new Set(["USD", "EUR"]));
    assert.ok(quoteCards.every((quote) => !JSON.stringify(quote).includes("costUnitMinor")));
    assert.ok(quoteCards.every((quote) => !JSON.stringify(quote).includes("grossProfitMinor")));

    const foreignTraveler = await client.query<{ id: number }>(
      `INSERT INTO accounts (email,password_hash,role,display_name)
       VALUES ($1,'test:test','traveler','Foreign Traveler') RETURNING id`,
      [`mp-foreign-${suffix}@example.invalid`],
    );
    const foreignToken = `mp-foreign-session-${suffix}`;
    await client.query(
      `INSERT INTO sessions (token,account_id,expires_at)
       VALUES ($1,$2,NOW()+INTERVAL '1 hour')`,
      [foreignToken, foreignTraveler.rows[0]!.id],
    );
    const foreignRead = await getTravelerRequest(
      new Request(`http://local.test/api/traveler/requests/${requestId}`, { headers: cookie(foreignToken) }),
      { params: Promise.resolve({ id: String(requestId) }) },
    );
    assert.equal(foreignRead.status, 404);

    const decision = await respondTravelerQuote(
      new Request(`http://local.test/api/traveler/requests/${requestId}/quotes/${firstQuote.deliveryId}/respond`, {
        method: "POST",
        headers: { ...cookie(travelerToken), "content-type": "application/json" },
        body: JSON.stringify({ response: "approved", message: "أوافق على هذا العرض." }),
      }),
      { params: Promise.resolve({ id: String(requestId), deliveryId: String(firstQuote.deliveryId) }) },
    );
    assert.equal(decision.status, 200, JSON.stringify(await json(decision)));

    const duplicate = await respondTravelerQuote(
      new Request(`http://local.test/api/traveler/requests/${requestId}/quotes/${firstQuote.deliveryId}/respond`, {
        method: "POST",
        headers: { ...cookie(travelerToken), "content-type": "application/json" },
        body: JSON.stringify({ response: "declined" }),
      }),
      { params: Promise.resolve({ id: String(requestId), deliveryId: String(firstQuote.deliveryId) }) },
    );
    assert.equal(duplicate.status, 409);

    const bearerDuplicate = await respondToQuoteDelivery(firstQuote.token, { response: "declined" });
    assert.equal(bearerDuplicate.status, 409);

    const firstOpportunity = await client.query<{ id: number }>(
      `SELECT id FROM agency_opportunities
        WHERE workspace_id=$1 AND source_contact_request_id=$2 LIMIT 1`,
      [first.workspaceId, requestId],
    );
    const providerReport = await reportDirectConfirmation(
      new Request(`http://local.test/api/agency/workspaces/${first.workspaceId}/opportunities/${firstOpportunity.rows[0]!.id}/direct-confirmation`, {
        method: "POST",
        headers: { ...cookie(first.token), "content-type": "application/json" },
        body: JSON.stringify({
          deliveryId: firstQuote.deliveryId,
          providerName: "Hotel Partner Istanbul",
          channel: "whatsapp",
          note: "Agency reports direct contact with provider.",
        }),
      }),
      { params: Promise.resolve({ id: String(first.workspaceId), opportunityId: String(firstOpportunity.rows[0]!.id) }) },
    );
    assert.equal(providerReport.status, 201, JSON.stringify(await json(providerReport)));

    const authenticatedAcknowledgement = await acknowledgeDirectConfirmation(
      new Request(`http://local.test/api/traveler/requests/${requestId}/quotes/${firstQuote.deliveryId}/acknowledge`, {
        method: "POST",
        headers: { ...cookie(travelerToken), "content-type": "application/json" },
        body: JSON.stringify({ response: "confirmed", message: "Provider contacted me directly." }),
      }),
      { params: Promise.resolve({ id: String(requestId), deliveryId: String(firstQuote.deliveryId) }) },
    );
    assert.equal(authenticatedAcknowledgement.status, 200, JSON.stringify(await json(authenticatedAcknowledgement)));

    const foreignAcknowledgement = await acknowledgeDirectConfirmation(
      new Request(`http://local.test/api/traveler/requests/${requestId}/quotes/${firstQuote.deliveryId}/acknowledge`, {
        method: "POST",
        headers: { ...cookie(foreignToken), "content-type": "application/json" },
        body: JSON.stringify({ response: "not_confirmed" }),
      }),
      { params: Promise.resolve({ id: String(requestId), deliveryId: String(firstQuote.deliveryId) }) },
    );
    assert.equal(foreignAcknowledgement.status, 404);

    const duplicateAcknowledgement = await acknowledgeDirectConfirmation(
      new Request(`http://local.test/api/traveler/requests/${requestId}/quotes/${firstQuote.deliveryId}/acknowledge`, {
        method: "POST",
        headers: { ...cookie(travelerToken), "content-type": "application/json" },
        body: JSON.stringify({ response: "not_confirmed" }),
      }),
      { params: Promise.resolve({ id: String(requestId), deliveryId: String(firstQuote.deliveryId) }) },
    );
    assert.equal(duplicateAcknowledgement.status, 409);

    const confirmedDetail = await getTravelerRequest(
      new Request(`http://local.test/api/traveler/requests/${requestId}`, { headers: cookie(travelerToken) }),
      { params: Promise.resolve({ id: String(requestId) }) },
    );
    assert.equal(confirmedDetail.status, 200);
    const confirmedProviders = (await json(confirmedDetail)).providers as Array<Record<string, unknown>>;
    const confirmedQuotes = confirmedProviders.flatMap((provider) => provider.quotes as Array<Record<string, unknown>>);
    const confirmedQuote = confirmedQuotes.find((quote) => quote.deliveryId === firstQuote.deliveryId);
    assert.ok(confirmedQuote);
    assert.deepEqual(confirmedQuote!.directConfirmation, {
      providerName: "Hotel Partner Istanbul",
      channel: "whatsapp",
      note: "Agency reports direct contact with provider.",
      reportedAt: (confirmedQuote!.directConfirmation as Record<string, unknown>).reportedAt,
      travelerResponse: "confirmed",
      travelerResponseNote: "Provider contacted me directly.",
      travelerRespondedAt: (confirmedQuote!.directConfirmation as Record<string, unknown>).travelerRespondedAt,
    });

    const final = await client.query<{ status: string; response: string }>(
      `SELECT status,response FROM agency_quote_deliveries WHERE id=$1`,
      [firstQuote.deliveryId],
    );
    assert.deepEqual(final.rows[0], { status: "responded", response: "approved" });

  } finally {
    delete process.env.MULTI_PROVIDER_REQUESTS_ENABLED;
    if (previousTravelerWorkspace === undefined) delete process.env.TRAVELER_WORKSPACE_ENABLED;
    else process.env.TRAVELER_WORKSPACE_ENABLED = previousTravelerWorkspace;
    if (previousDirectConfirmation === undefined) delete process.env.DIRECT_CONFIRMATION_ENABLED;
    else process.env.DIRECT_CONFIRMATION_ENABLED = previousDirectConfirmation;
    await pool.end().catch(() => undefined);
    await client.end().catch(() => undefined);
  }
});
