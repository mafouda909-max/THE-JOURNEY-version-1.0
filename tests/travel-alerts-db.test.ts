import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Client } from "pg";
import { pool } from "../src/db";
import { travelAlertEngine } from "../src/lib/travel-alerts";

const databaseUrl = process.env.COMMERCIAL_WORKFLOW_TEST_DATABASE_URL;

test("travel fact alerts reach only active account-scoped route participants without duplicates", { skip: !databaseUrl }, async () => {
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
    const country = `Alertland-${suffix}`;

    const agent = await client.query<{ id: number }>(
      `INSERT INTO agents
        (display_name,latin_name,bio,photo_url,city,country,license_type,verification_status,
         specialty_tags,languages,response_rate,avg_response_hours,total_trips)
       VALUES ($1,$1,'Alert agent','https://example.invalid/a','Cairo','Egypt','agency','verified',
         '{}','{Arabic}',100,1,0) RETURNING id`,
      [`Alert Agent ${suffix}`],
    );
    const agentAccount = await client.query<{ id: number }>(
      `INSERT INTO accounts (email,password_hash,role,display_name,agent_id)
       VALUES ($1,'test:test','agent',$2,$3) RETURNING id`,
      [`alert-agent-${suffix}@example.invalid`, `Alert Agent ${suffix}`, agent.rows[0]!.id],
    );

    const offer = await client.query<{ id: number }>(
      `INSERT INTO offers
        (agent_id,title,description,trip_type,origin_city,destination_city,destination_country,destination_country_en,
         price_amount,currency,price_type,includes,excludes,min_travelers,max_travelers,status,hero_image,published_at,expires_at)
       VALUES ($1,$2,'Alert test','package','Cairo','Target City',$3,$3,1000,'USD','per_person',
         '{}','{}',1,4,'published','https://example.invalid/o',NOW(),NOW()+INTERVAL '30 days') RETURNING id`,
      [agent.rows[0]!.id, `Alert Offer ${suffix}`, country],
    );

    const traveler = await client.query<{ id: number }>(
      `INSERT INTO accounts (email,password_hash,role,display_name)
       VALUES ($1,'test:test','traveler',$2) RETURNING id`,
      [`alert-traveler-${suffix}@example.invalid`, `Alert Traveler ${suffix}`],
    );
    const closedTraveler = await client.query<{ id: number }>(
      `INSERT INTO accounts (email,password_hash,role,display_name)
       VALUES ($1,'test:test','traveler',$2) RETURNING id`,
      [`alert-closed-${suffix}@example.invalid`, `Closed Traveler ${suffix}`],
    );

    const active1 = await client.query<{ id: number }>(
      `INSERT INTO contact_requests
        (offer_id,agent_id,traveler_account_id,traveler_name,traveler_email,message,traveler_count,status)
       VALUES ($1,$2,$3,'Alert Traveler',$4,'Active query one',2,'new') RETURNING id`,
      [offer.rows[0]!.id, agent.rows[0]!.id, traveler.rows[0]!.id, `alert-traveler-${suffix}@example.invalid`],
    );
    await client.query(
      `INSERT INTO contact_requests
        (offer_id,agent_id,traveler_account_id,traveler_name,traveler_email,message,traveler_count,status)
       VALUES ($1,$2,$3,'Alert Traveler',$4,'Active query two',2,'viewed')`,
      [offer.rows[0]!.id, agent.rows[0]!.id, traveler.rows[0]!.id, `alert-traveler-${suffix}@example.invalid`],
    );
    await client.query(
      `INSERT INTO contact_requests
        (offer_id,agent_id,traveler_account_id,traveler_name,traveler_email,message,traveler_count,status)
       VALUES ($1,$2,$3,'Closed Traveler',$4,'Closed query',2,'closed')`,
      [offer.rows[0]!.id, agent.rows[0]!.id, closedTraveler.rows[0]!.id, `alert-closed-${suffix}@example.invalid`],
    );
    await client.query(
      `INSERT INTO contact_requests
        (offer_id,agent_id,traveler_name,traveler_email,message,traveler_count,status)
       VALUES ($1,$2,'Guest Traveler',$3,'Guest query',2,'new')`,
      [offer.rows[0]!.id, agent.rows[0]!.id, `alert-guest-${suffix}@example.invalid`],
    );

    const first = await travelAlertEngine.dispatchTargetedAlerts({
      country,
      attribute: "visa_rule",
      previousValue: "old",
      newValue: "new",
    });
    assert.deepEqual(first, { alertsDispatched: 2, affectedAccounts: 2 });

    const recipients = await client.query<{ account_id: number; count: string }>(
      `SELECT account_id, COUNT(*)::text AS count
         FROM notifications
        WHERE type='travel_fact_update'
          AND account_id = ANY($1::integer[])
        GROUP BY account_id
        ORDER BY account_id`,
      [[traveler.rows[0]!.id, agentAccount.rows[0]!.id, closedTraveler.rows[0]!.id]],
    );
    assert.deepEqual(
      recipients.rows.map((row) => ({ account_id: row.account_id, count: row.count })),
      [
        { account_id: Math.min(traveler.rows[0]!.id, agentAccount.rows[0]!.id), count: "1" },
        { account_id: Math.max(traveler.rows[0]!.id, agentAccount.rows[0]!.id), count: "1" },
      ],
    );

    const closedCount = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM notifications
        WHERE type='travel_fact_update' AND account_id=$1`,
      [closedTraveler.rows[0]!.id],
    );
    assert.equal(closedCount.rows[0]!.count, "0");

    const audits = await client.query<{ count: string; pii_count: string }>(
      `SELECT COUNT(*)::text AS count,
              COUNT(*) FILTER (WHERE reason ILIKE '%@example.invalid%')::text AS pii_count
         FROM audit_log
        WHERE action='targeted_travel_alert_sent' AND target_id=$1`,
      [active1.rows[0]!.id],
    );
    assert.equal(audits.rows[0]!.pii_count, "0");
    assert.ok(Number(audits.rows[0]!.count) >= 1);

    const second = await travelAlertEngine.dispatchTargetedAlerts({
      country,
      attribute: "visa_rule",
      previousValue: "old",
      newValue: "new",
    });
    assert.deepEqual(second, { alertsDispatched: 0, affectedAccounts: 2 });
  } finally {
    await pool.end().catch(() => undefined);
    await client.end().catch(() => undefined);
  }
});
