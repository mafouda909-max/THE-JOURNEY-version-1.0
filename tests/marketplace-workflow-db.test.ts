import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Client } from "pg";
import { pool } from "../src/db";
import { POST as authPost } from "../src/app/api/auth/[action]/route";
import {
  GET as listContacts,
  POST as createContact,
} from "../src/app/api/contact-requests/route";
import { PATCH as updateContact } from "../src/app/api/contact-requests/[id]/route";

const databaseUrl = process.env.MARKETPLACE_WORKFLOW_TEST_DATABASE_URL;

function cookie(token: string) {
  return { cookie: `tj_sess=${token}` };
}

function jsonRequest(url: string, body: Record<string, unknown>, token?: string) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? cookie(token) : {}),
    },
    body: JSON.stringify(body),
  });
}

async function responseJson(response: Response): Promise<Record<string, any>> {
  return await response.json() as Record<string, any>;
}

async function insertAccount(
  client: Client,
  input: { label: string; role: "traveler" | "agent"; agentId?: number | null },
) {
  const email = `${input.label.toLowerCase()}@example.invalid`;
  const inserted = await client.query<{ id: number }>(
    `INSERT INTO accounts (email, password_hash, role, display_name, agent_id)
     VALUES ($1, 'test:test', $2, $3, $4) RETURNING id`,
    [email, input.role, input.label, input.agentId ?? null],
  );
  const token = `workflow-${input.label.toLowerCase()}`;
  await client.query(
    `INSERT INTO sessions (token, account_id, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
    [token, inserted.rows[0]!.id],
  );
  return { id: inserted.rows[0]!.id, email, token };
}

test("Marketplace workflow integrity and ownership", { skip: !databaseUrl }, async (t) => {
  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();

  try {
    await client.query(readFileSync("db/production_schema.sql", "utf8"));
    await client.query(readFileSync("db/contact_request_ownership.sql", "utf8"));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await t.test("concurrent agent signup is atomic and leaves no orphan agent", async () => {
      const email = `atomic-${suffix}@example.invalid`;
      const name = `Atomic Agent ${suffix}`;
      const payload = {
        email,
        password: "strong-pass-123",
        name,
        role: "agent",
        city: "Cairo",
      };

      const [a, b] = await Promise.all([
        authPost(jsonRequest("http://local.test/api/auth/signup", payload), {
          params: Promise.resolve({ action: "signup" }),
        }),
        authPost(jsonRequest("http://local.test/api/auth/signup", payload), {
          params: Promise.resolve({ action: "signup" }),
        }),
      ]);

      assert.deepEqual([a.status, b.status].sort((x, y) => x - y), [201, 409]);

      const accountRows = await client.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM accounts WHERE email = $1",
        [email],
      );
      assert.equal(accountRows.rows[0]!.count, "1");

      const agentRows = await client.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM agents WHERE display_name = $1",
        [name],
      );
      assert.equal(agentRows.rows[0]!.count, "1");
    });

    const agentRow = await client.query<{ id: number }>(
      `INSERT INTO agents
        (display_name, latin_name, bio, photo_url, city, country, license_type,
         license_number, verification_status, specialty_tags, languages,
         response_rate, avg_response_hours, total_trips)
       VALUES ($1, $1, 'Workflow agent', 'https://example.invalid/photo', 'Cairo', 'Egypt',
         'agency', $2, 'verified', '{}', '{Arabic}', 100, 1, 0)
       RETURNING id`,
      [`Workflow Agent ${suffix}`, `LIC-${suffix}`],
    );
    const agentId = agentRow.rows[0]!.id;
    const owner = await insertAccount(client, {
      label: `Owner-${suffix}`,
      role: "agent",
      agentId,
    });
    const traveler = await insertAccount(client, {
      label: `Traveler-${suffix}`,
      role: "traveler",
    });
    const otherTraveler = await insertAccount(client, {
      label: `Other-Traveler-${suffix}`,
      role: "traveler",
    });
    const outsiderAgentRow = await client.query<{ id: number }>(
      `INSERT INTO agents
        (display_name, latin_name, bio, photo_url, city, country, license_type,
         verification_status, specialty_tags, languages, response_rate, avg_response_hours, total_trips)
       VALUES ($1, $1, 'Outsider', 'https://example.invalid/photo', 'Cairo', 'Egypt',
         'individual', 'verified', '{}', '{Arabic}', 0, 0, 0)
       RETURNING id`,
      [`Outsider Agent ${suffix}`],
    );
    const outsider = await insertAccount(client, {
      label: `Outsider-${suffix}`,
      role: "agent",
      agentId: outsiderAgentRow.rows[0]!.id,
    });

    const offerRow = await client.query<{ id: number }>(
      `INSERT INTO offers
        (agent_id, title, title_en, description, trip_type, origin_city, destination_city,
         destination_country, destination_country_en, duration_days, price_amount, currency,
         price_type, includes, excludes, min_travelers, max_travelers, status, hero_image,
         published_at, expires_at)
       VALUES ($1, $2, 'Workflow Offer', 'A real test offer', 'package', 'Cairo', 'Istanbul',
         'تركيا', 'Turkey', 5, 10000, 'EGP', 'per_person', '{}', '{}', 1, 6,
         'published', 'https://example.invalid/hero', NOW(), NOW() + INTERVAL '30 days')
       RETURNING id`,
      [agentId, `Workflow Offer ${suffix}`],
    );
    const offerId = offerRow.rows[0]!.id;

    await t.test("signed-in traveler ownership is session-derived and lead counter is atomic", async () => {
      const response = await createContact(
        jsonRequest(
          "http://local.test/api/contact-requests",
          {
            offerId,
            travelerName: "Signed Traveler",
            travelerEmail: "forged@example.invalid",
            travelerAccountId: owner.id,
            travelerCount: 2,
            message: "I want to know whether this package is available.",
          },
          traveler.token,
        ),
      );
      assert.equal(response.status, 201);
      const payload = await responseJson(response);

      const lead = await client.query<{
        traveler_account_id: number | null;
        traveler_email: string;
      }>(
        "SELECT traveler_account_id, traveler_email FROM contact_requests WHERE id = $1",
        [payload.id],
      );
      assert.equal(lead.rows[0]!.traveler_account_id, traveler.id);
      assert.equal(lead.rows[0]!.traveler_email, traveler.email);

      const offer = await client.query<{ contact_count: number }>(
        "SELECT contact_count FROM offers WHERE id = $1",
        [offerId],
      );
      assert.equal(offer.rows[0]!.contact_count, 1);
    });

    await t.test("anonymous leads remain anonymous-owned", async () => {
      const response = await createContact(
        jsonRequest("http://local.test/api/contact-requests", {
          offerId,
          travelerName: "Guest Traveler",
          travelerEmail: `guest-${suffix}@example.invalid`,
          travelerCount: 3,
          message: "Please send more details about this travel package.",
        }),
      );
      assert.equal(response.status, 201);
      const payload = await responseJson(response);
      const lead = await client.query<{ traveler_account_id: number | null }>(
        "SELECT traveler_account_id FROM contact_requests WHERE id = $1",
        [payload.id],
      );
      assert.equal(lead.rows[0]!.traveler_account_id, null);
    });

    await t.test("duplicate contact creation is serialized per offer and traveler", async () => {
      const email = `dupe-${suffix}@example.invalid`;
      const body = {
        offerId,
        travelerName: "Concurrent Guest",
        travelerEmail: email,
        travelerCount: 2,
        message: "I am sending this request at the same time from two tabs.",
      };
      const [a, b] = await Promise.all([
        createContact(jsonRequest("http://local.test/api/contact-requests", body)),
        createContact(jsonRequest("http://local.test/api/contact-requests", body)),
      ]);
      assert.deepEqual([a.status, b.status].sort((x, y) => x - y), [201, 429]);
      const count = await client.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM contact_requests WHERE offer_id = $1 AND traveler_email = $2",
        [offerId, email],
      );
      assert.equal(count.rows[0]!.count, "1");
    });

    await t.test("request feeds are fail-closed to authenticated ownership", async () => {
      const otherResponse = await createContact(
        jsonRequest(
          "http://local.test/api/contact-requests",
          {
            offerId,
            travelerName: "Other Traveler",
            travelerEmail: "ignored@example.invalid",
            travelerCount: 1,
            message: "This request belongs to a different authenticated traveler.",
          },
          otherTraveler.token,
        ),
      );
      assert.equal(otherResponse.status, 201);
      const otherPayload = await responseJson(otherResponse);

      const unauth = await listContacts(new Request("http://local.test/api/contact-requests"));
      assert.equal(unauth.status, 401);

      const travelerFeed = await listContacts(
        new Request("http://local.test/api/contact-requests", { headers: cookie(traveler.token) }),
      );
      assert.equal(travelerFeed.status, 200);
      const travelerBody = await responseJson(travelerFeed);
      assert.ok(travelerBody.contactRequests.length >= 1);
      assert.ok(
        travelerBody.contactRequests.every(
          (row: { travelerAccountId: number | null }) => row.travelerAccountId === traveler.id,
        ),
      );
      assert.ok(
        !travelerBody.contactRequests.some((row: { id: number }) => row.id === otherPayload.id),
      );

      const otherFeed = await listContacts(
        new Request("http://local.test/api/contact-requests", { headers: cookie(otherTraveler.token) }),
      );
      assert.equal(otherFeed.status, 200);
      const otherBody = await responseJson(otherFeed);
      assert.ok(
        otherBody.contactRequests.every(
          (row: { travelerAccountId: number | null }) => row.travelerAccountId === otherTraveler.id,
        ),
      );

      const ownerFeed = await listContacts(
        new Request("http://local.test/api/contact-requests", { headers: cookie(owner.token) }),
      );
      assert.equal(ownerFeed.status, 200);
      const ownerBody = await responseJson(ownerFeed);
      assert.ok(ownerBody.contactRequests.length >= 3);
      assert.ok(
        ownerBody.contactRequests.every(
          (row: { agentId: number }) => row.agentId === agentId,
        ),
      );

      const outsiderFeed = await listContacts(
        new Request("http://local.test/api/contact-requests", { headers: cookie(outsider.token) }),
      );
      assert.equal(outsiderFeed.status, 200);
      const outsiderBody = await responseJson(outsiderFeed);
      assert.equal(outsiderBody.contactRequests.length, 0);
    });

    await t.test("only the owning agent can transition a request and the transition is audited", async () => {
      const lead = await client.query<{ id: number }>(
        `SELECT id FROM contact_requests
         WHERE offer_id = $1 AND traveler_account_id = $2
         ORDER BY id DESC LIMIT 1`,
        [offerId, traveler.id],
      );
      const leadId = lead.rows[0]!.id;

      const denied = await updateContact(
        new Request(`http://local.test/api/contact-requests/${leadId}`, {
          method: "PATCH",
          headers: { ...cookie(outsider.token), "content-type": "application/json" },
          body: JSON.stringify({ to: "viewed" }),
        }),
        { params: Promise.resolve({ id: String(leadId) }) },
      );
      assert.equal(denied.status, 403);

      const viewed = await updateContact(
        new Request(`http://local.test/api/contact-requests/${leadId}`, {
          method: "PATCH",
          headers: { ...cookie(owner.token), "content-type": "application/json" },
          body: JSON.stringify({ to: "viewed" }),
        }),
        { params: Promise.resolve({ id: String(leadId) }) },
      );
      assert.equal(viewed.status, 200);

      const audit = await client.query<{ prev_state: string; new_state: string }>(
        `SELECT prev_state, new_state FROM audit_log
         WHERE target_type = 'contact_request' AND target_id = $1
         ORDER BY id DESC LIMIT 1`,
        [leadId],
      );
      assert.equal(audit.rows[0]!.prev_state, "new");
      assert.equal(audit.rows[0]!.new_state, "viewed");
    });
  } finally {
    await pool.end().catch(() => undefined);
    await client.end().catch(() => undefined);
  }
});
