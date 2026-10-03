import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Client } from "pg";

const databaseUrl = process.env.COMMERCIAL_WORKFLOW_TEST_DATABASE_URL;

test("traveler workspace tables preserve ownership, uniqueness and cascade boundaries", { skip: !databaseUrl }, async () => {
  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let agentId = 0;
  let offerId = 0;
  let contactId = 0;
  let travelerBId = 0;

  try {
    await client.query(readFileSync("db/production_schema.sql", "utf8"));
    await client.query(readFileSync("db/phase6_traveler_workspace.sql", "utf8"));

    const agent = await client.query<{ id: number }>(
      `INSERT INTO agents
        (display_name, latin_name, bio, photo_url, city, country, license_type, verification_status,
         specialty_tags, languages, response_rate, avg_response_hours, total_trips)
       VALUES ($1,$1,'workspace test','https://example.invalid/a','Cairo','Egypt','individual','verified',
         '{}','{Arabic}',0,0,0) RETURNING id`,
      [`Intent Agent ${suffix}`],
    );
    agentId = agent.rows[0]!.id;

    const offer = await client.query<{ id: number }>(
      `INSERT INTO offers
        (agent_id,title,description,trip_type,origin_city,destination_city,destination_country,destination_country_en,
         price_amount,currency,price_type,includes,excludes,min_travelers,max_travelers,status,hero_image)
       VALUES ($1,$2,'workspace offer','package','Cairo','Istanbul','Turkey','Turkey',1000,'USD','per_person',
         '{}','{}',1,4,'published','https://example.invalid/o') RETURNING id`,
      [agentId, `Intent Offer ${suffix}`],
    );
    offerId = offer.rows[0]!.id;

    const travelerA = await client.query<{ id: number }>(
      `INSERT INTO accounts (email,password_hash,role,display_name)
       VALUES ($1,'test:test','traveler','Traveler A') RETURNING id`,
      [`intent-a-${suffix}@example.invalid`],
    );
    const travelerB = await client.query<{ id: number }>(
      `INSERT INTO accounts (email,password_hash,role,display_name)
       VALUES ($1,'test:test','traveler','Traveler B') RETURNING id`,
      [`intent-b-${suffix}@example.invalid`],
    );
    travelerBId = travelerB.rows[0]!.id;

    const intent = await client.query<{ id: number }>(
      `INSERT INTO traveler_saved_intents (account_id,label,intent_snapshot)
       VALUES ($1,'Istanbul',$2::jsonb) RETURNING id`,
      [travelerA.rows[0]!.id, JSON.stringify({ destinations: ["Istanbul"], travelers: { adults: 2, children: 0, infants: 0 } })],
    );
    const intentId = intent.rows[0]!.id;

    await client.query(
      `INSERT INTO traveler_intent_offers (saved_intent_id,offer_id,position) VALUES ($1,$2,0)`,
      [intentId, offerId],
    );
    await assert.rejects(
      client.query(
        `INSERT INTO traveler_intent_offers (saved_intent_id,offer_id,position) VALUES ($1,$2,1)`,
        [intentId, offerId],
      ),
      (error: any) => error?.code === "23505",
    );

    const contact = await client.query<{ id: number }>(
      `INSERT INTO contact_requests
        (offer_id,agent_id,traveler_account_id,traveler_name,traveler_email,message,traveler_count,status)
       VALUES ($1,$2,$3,'Traveler A',$4,'Please send a grounded quote.',2,'new') RETURNING id`,
      [offerId, agentId, travelerA.rows[0]!.id, `intent-a-${suffix}@example.invalid`],
    );
    contactId = contact.rows[0]!.id;
    await client.query(
      `INSERT INTO traveler_intent_inquiries (saved_intent_id,contact_request_id) VALUES ($1,$2)`,
      [intentId, contactId],
    );
    await assert.rejects(
      client.query(
        `INSERT INTO traveler_intent_inquiries (saved_intent_id,contact_request_id) VALUES ($1,$2)`,
        [intentId, contactId],
      ),
      (error: any) => error?.code === "23505",
    );

    await client.query(`DELETE FROM accounts WHERE id=$1`, [travelerA.rows[0]!.id]);

    const after = await client.query<{
      intent_count: string;
      offer_link_count: string;
      inquiry_link_count: string;
      contact_count: string;
      contact_owner: number | null;
    }>(
      `SELECT
        (SELECT COUNT(*)::text FROM traveler_saved_intents WHERE id=$1) intent_count,
        (SELECT COUNT(*)::text FROM traveler_intent_offers WHERE saved_intent_id=$1) offer_link_count,
        (SELECT COUNT(*)::text FROM traveler_intent_inquiries WHERE contact_request_id=$2) inquiry_link_count,
        (SELECT COUNT(*)::text FROM contact_requests WHERE id=$2) contact_count,
        (SELECT traveler_account_id FROM contact_requests WHERE id=$2) contact_owner`,
      [intentId, contactId],
    );
    assert.deepEqual(after.rows[0], {
      intent_count: "0",
      offer_link_count: "0",
      inquiry_link_count: "0",
      contact_count: "1",
      contact_owner: null,
    });
  } finally {
    if (contactId) await client.query("DELETE FROM contact_requests WHERE id=$1", [contactId]).catch(() => undefined);
    if (offerId) await client.query("DELETE FROM offers WHERE id=$1", [offerId]).catch(() => undefined);
    if (travelerBId) await client.query("DELETE FROM accounts WHERE id=$1", [travelerBId]).catch(() => undefined);
    if (agentId) await client.query("DELETE FROM agents WHERE id=$1", [agentId]).catch(() => undefined);
    await client.end();
  }
});
