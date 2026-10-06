import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Client } from "pg";
import { pool } from "../src/db";
import { GET as listInquiries, POST as adoptInquiry } from "../src/app/api/agency/workspaces/[id]/inquiries/route";
import { GET as getOpportunityDetail } from "../src/app/api/agency/workspaces/[id]/opportunities/[opportunityId]/route";

const databaseUrl = process.env.COMMERCIAL_WORKFLOW_TEST_DATABASE_URL;

function cookie(token: string) {
  return { cookie: `tj_sess=${token}` };
}

async function json(response: Response) {
  return await response.json() as Record<string, unknown>;
}

test("Marketplace inquiry adoption is server-derived, idempotent and tenant-isolated", { skip: !databaseUrl }, async () => {
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
         VALUES ($1, $1, 'Inquiry adoption agency', 'https://example.invalid/photo', 'Cairo', 'Egypt',
           'agency', $2, 'verified', '{}', '{Arabic}', 0, 0, 0)
         RETURNING id`,
        [label, `INQ-${label}`],
      );
      const account = await client.query<{ id: number }>(
        `INSERT INTO accounts (email, password_hash, role, display_name, agent_id)
         VALUES ($1, 'test:test', 'agent', $2, $3) RETURNING id`,
        [`${label.toLowerCase()}-inquiry@example.invalid`, label, agent.rows[0]!.id],
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
      const token = `inquiry-${label.toLowerCase()}-${Date.now()}`;
      await client.query(
        `INSERT INTO sessions (token, account_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
        [token, account.rows[0]!.id],
      );
      return { agentId: agent.rows[0]!.id, workspaceId: workspace.rows[0]!.id, token };
    }

    const owner = await createAgency("InquiryOwner");
    const outsider = await createAgency("InquiryOutsider");
    const traveler = await client.query<{ id: number }>(
      `INSERT INTO accounts (email, password_hash, role, display_name)
       VALUES ('linked-traveler@example.invalid', 'test:test', 'traveler', 'Linked Traveler')
       RETURNING id`,
    );

    const offer = await client.query<{ id: number }>(
      `INSERT INTO offers
        (agent_id, title, description, trip_type, origin_city, destination_city, destination_country,
         destination_country_en, departure_date, duration_days, price_amount, currency, price_type,
         includes, excludes, min_travelers, max_travelers, status, hero_image, expires_at)
       VALUES ($1, 'Istanbul October', 'Marketplace package', 'package', 'Cairo', 'Istanbul', 'تركيا',
         'Türkiye', '2026-10-10T09:00:00Z', 6, 900, 'USD', 'per_person', '{}', '{}', 1, 8,
         'published', 'https://example.invalid/istanbul.jpg', NOW() + INTERVAL '30 days')
       RETURNING id`,
      [owner.agentId],
    );

    const contact = await client.query<{ id: number }>(
      `INSERT INTO contact_requests
        (offer_id, agent_id, traveler_account_id, traveler_name, traveler_email, message, traveler_count, travel_dates, status)
       VALUES ($1, $2, $3, 'Traveler Market', 'market@example.invalid',
         'Need a central hotel and flexible flight options.', 3, 'Can move one day either side', 'new')
       RETURNING id`,
      [offer.rows[0]!.id, owner.agentId, traveler.rows[0]!.id],
    );
    const inquiryId = contact.rows[0]!.id;

    const savedIntent = await client.query<{ id: number }>(
      `INSERT INTO traveler_saved_intents (account_id, label, intent_snapshot, status)
       VALUES ($1, 'Istanbul linked trip', $2::jsonb, 'active')
       RETURNING id`,
      [
        traveler.rows[0]!.id,
        JSON.stringify({
          privateNotes: "DO NOT EXPOSE",
          __silaReadiness: {
            version: 1,
            checkedAt: "2026-10-06T00:00:00.000Z",
            input: {
              nationality: "مصري",
              passportValidityMonths: 12,
              destination: "تركيا",
              travelPurpose: "tourism",
              travelDate: "2026-10-10",
              budgetAmount: 777777,
              budgetCurrency: "EGP",
              advisorAnswers: {
                tourism_accommodation: "عنوان خاص لا يعرض للوكيل",
                tourism_onward: "نعم",
              },
            },
            decision: {
              status: "NEEDS_CONFIRMATION",
              routeComplexity: "UNKNOWN",
              groups: [
                { key: "entry_visa::tourism", topic: "entry_visa", resolution: "UNCONFIRMED" },
              ],
              checklist: [],
              researchStatus: "NOT_CONFIGURED",
              preparation: [
                { id: "passport", requirementState: "TO_VERIFY", readinessState: "REPORTED_READY" },
                { id: "entry_visa", requirementState: "TO_VERIFY", readinessState: "UNKNOWN" },
                { id: "tourism_accommodation", requirementState: "TO_VERIFY", readinessState: "NEEDS_ACTION" },
              ],
              offerIds: [offer.rows[0]!.id],
            },
            fingerprint: "b".repeat(64),
            freshness: {
              status: "UNKNOWN",
              nearestValidUntil: null,
              reasons: ["أعد التأكيد قبل الالتزام."],
            },
            change: {
              state: "CHANGED",
              previousCheckedAt: "2026-10-05T00:00:00.000Z",
              changedKeys: ["preparation:tourism_accommodation"],
            },
          },
        }),
      ],
    );
    await client.query(
      `INSERT INTO traveler_intent_inquiries (saved_intent_id, contact_request_id)
       VALUES ($1, $2)`,
      [savedIntent.rows[0]!.id, inquiryId],
    );

    const ownerList = await listInquiries(
      new Request(`http://local.test/api/agency/workspaces/${owner.workspaceId}/inquiries`, { headers: cookie(owner.token) }),
      { params: Promise.resolve({ id: String(owner.workspaceId) }) },
    );
    assert.equal(ownerList.status, 200);
    const ownerBody = await json(ownerList);
    assert.ok((ownerBody.inquiries as Array<{ id: number }>).some((inquiry) => inquiry.id === inquiryId));

    const crossTenant = await adoptInquiry(
      new Request(`http://local.test/api/agency/workspaces/${outsider.workspaceId}/inquiries`, {
        method: "POST",
        headers: { ...cookie(outsider.token), "content-type": "application/json" },
        body: JSON.stringify({ inquiryId }),
      }),
      { params: Promise.resolve({ id: String(outsider.workspaceId) }) },
    );
    assert.equal(crossTenant.status, 404);

    const adopted = await adoptInquiry(
      new Request(`http://local.test/api/agency/workspaces/${owner.workspaceId}/inquiries`, {
        method: "POST",
        headers: { ...cookie(owner.token), "content-type": "application/json" },
        body: JSON.stringify({
          inquiryId,
          intent: {
            originCity: "FORGED",
            destinations: ["FORGED"],
            travelers: { adults: 99, children: 0, infants: 0 },
          },
        }),
      }),
      { params: Promise.resolve({ id: String(owner.workspaceId) }) },
    );
    assert.equal(adopted.status, 201);
    const adoptedBody = await json(adopted);
    const opportunityId = Number((adoptedBody.opportunity as { id?: unknown } | undefined)?.id);
    assert.ok(Number.isInteger(opportunityId) && opportunityId > 0);

    const ownerDetail = await getOpportunityDetail(
      new Request(
        `http://local.test/api/agency/workspaces/${owner.workspaceId}/opportunities/${opportunityId}`,
        { headers: cookie(owner.token) },
      ),
      { params: Promise.resolve({ id: String(owner.workspaceId), opportunityId: String(opportunityId) }) },
    );
    assert.equal(ownerDetail.status, 200);
    const ownerDetailBody = await json(ownerDetail);
    const brief = ownerDetailBody.clientTravelBrief as Record<string, unknown> | null;
    assert.ok(brief);
    const briefJson = JSON.stringify(brief);
    assert.match(briefJson, /tourism_accommodation/);
    assert.match(briefJson, /الإقامة وإثبات مكان السكن/);
    assert.doesNotMatch(briefJson, /عنوان خاص/);
    assert.doesNotMatch(briefJson, /777777/);
    assert.doesNotMatch(briefJson, /EGP/);
    assert.doesNotMatch(briefJson, /advisorAnswers/);
    assert.doesNotMatch(briefJson, /privateNotes/);
    assert.doesNotMatch(briefJson, /offerIds/);

    const outsiderDetail = await getOpportunityDetail(
      new Request(
        `http://local.test/api/agency/workspaces/${outsider.workspaceId}/opportunities/${opportunityId}`,
        { headers: cookie(outsider.token) },
      ),
      { params: Promise.resolve({ id: String(outsider.workspaceId), opportunityId: String(opportunityId) }) },
    );
    assert.equal(outsiderDetail.status, 404);

    const stored = await client.query<{
      source: string;
      source_contact_request_id: number;
      intent_snapshot: {
        originCity: string;
        destinations: string[];
        departureDate: string;
        returnDate: string;
        travelers: { adults: number };
        tripType: string;
        notes: string;
      };
    }>(
      `SELECT o.source, o.source_contact_request_id, iv.intent_snapshot
         FROM agency_opportunities o
         JOIN agency_intent_versions iv
           ON iv.opportunity_id = o.id AND iv.revision = 1
        WHERE o.workspace_id = $1 AND o.source_contact_request_id = $2`,
      [owner.workspaceId, inquiryId],
    );
    assert.equal(stored.rows.length, 1);
    assert.equal(stored.rows[0]!.source, "marketplace");
    assert.equal(stored.rows[0]!.source_contact_request_id, inquiryId);
    assert.equal(stored.rows[0]!.intent_snapshot.originCity, "Cairo");
    assert.deepEqual(stored.rows[0]!.intent_snapshot.destinations, ["Istanbul"]);
    assert.equal(stored.rows[0]!.intent_snapshot.travelers.adults, 3);
    assert.equal(stored.rows[0]!.intent_snapshot.departureDate, "2026-10-10");
    assert.equal(stored.rows[0]!.intent_snapshot.returnDate, "2026-10-15");
    assert.equal(stored.rows[0]!.intent_snapshot.tripType, "package");
    assert.equal(stored.rows[0]!.intent_snapshot.notes, "Can move one day either side");
    assert.notEqual(stored.rows[0]!.intent_snapshot.originCity, "FORGED");

    const duplicate = await adoptInquiry(
      new Request(`http://local.test/api/agency/workspaces/${owner.workspaceId}/inquiries`, {
        method: "POST",
        headers: { ...cookie(owner.token), "content-type": "application/json" },
        body: JSON.stringify({ inquiryId }),
      }),
      { params: Promise.resolve({ id: String(owner.workspaceId) }) },
    );
    assert.equal(duplicate.status, 409);

    const ownerListAfter = await listInquiries(
      new Request(`http://local.test/api/agency/workspaces/${owner.workspaceId}/inquiries`, { headers: cookie(owner.token) }),
      { params: Promise.resolve({ id: String(owner.workspaceId) }) },
    );
    const afterBody = await json(ownerListAfter);
    const adoptedRow = (afterBody.inquiries as Array<{ id: number; opportunityId: number | null }>).find((row) => row.id === inquiryId);
    assert.ok(adoptedRow?.opportunityId);
  } finally {
    await client.end();
    await pool.end();
  }
});
