import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Client } from "pg";

const databaseUrl = process.env.COMMERCIAL_WORKFLOW_TEST_DATABASE_URL;

type Manifest = {
  schemaVersion: number;
  baseSchema: string;
  existingDatabaseMigrations: string[];
};

test("release migration chain is ordered, idempotent and preserves existing data", { skip: !databaseUrl }, async () => {
  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();

  try {
    const manifest = JSON.parse(readFileSync("db/release_manifest.json", "utf8")) as Manifest;
    assert.equal(manifest.schemaVersion, 3);
    assert.equal(manifest.baseSchema, "db/production_schema.sql");
    assert.deepEqual(manifest.existingDatabaseMigrations.slice(-3), [
      "db/phase1_agency_foundation.sql",
      "db/phase2_agency_commercial_domain.sql",
      "db/phase3_supply_freshness_integrity.sql",
    ]);

    await client.query(readFileSync(manifest.baseSchema, "utf8"));

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const agent = await client.query<{ id: number }>(
      `INSERT INTO agents
        (display_name, latin_name, bio, photo_url, city, country, license_type, license_number,
         verification_status, specialty_tags, languages, response_rate, avg_response_hours, total_trips)
       VALUES ($1,$1,'Migration survivor','https://example.invalid/migration','Cairo','Egypt','agency',$2,
         'verified','{}','{Arabic}',0,0,0) RETURNING id`,
      [`Migration-${suffix}`, `MIG-${suffix}`],
    );
    const account = await client.query<{ id: number }>(
      `INSERT INTO accounts (email, password_hash, role, display_name, agent_id)
       VALUES ($1,'test:test','agent',$2,$3) RETURNING id`,
      [`migration-${suffix}@example.invalid`, `Migration-${suffix}`, agent.rows[0]!.id],
    );
    const offer = await client.query<{ id: number }>(
      `INSERT INTO offers
        (agent_id,title,description,trip_type,origin_city,destination_city,destination_country,destination_country_en,
         price_amount,currency,price_type,includes,excludes,min_travelers,max_travelers,status,hero_image)
       VALUES ($1,'Existing offer','Must survive migration','package','Cairo','Istanbul','Turkey','Turkey',
         1000,'USD','per_person','{}','{}',1,4,'published','https://example.invalid/offer') RETURNING id`,
      [agent.rows[0]!.id],
    );
    const contact = await client.query<{ id: number }>(
      `INSERT INTO contact_requests
        (offer_id,agent_id,traveler_account_id,traveler_name,traveler_email,message,traveler_count,status)
       VALUES ($1,$2,$3,'Existing traveler',$4,'Existing inquiry must survive.',2,'new') RETURNING id`,
      [offer.rows[0]!.id, agent.rows[0]!.id, account.rows[0]!.id, `traveler-${suffix}@example.invalid`],
    );

    for (let pass = 0; pass < 2; pass += 1) {
      for (const migration of manifest.existingDatabaseMigrations) {
        await client.query(readFileSync(migration, "utf8"));
      }
    }

    const survivor = await client.query<{
      agent_count: string;
      account_count: string;
      offer_count: string;
      contact_count: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::text FROM agents WHERE id = $1) AS agent_count,
         (SELECT COUNT(*)::text FROM accounts WHERE id = $2) AS account_count,
         (SELECT COUNT(*)::text FROM offers WHERE id = $3) AS offer_count,
         (SELECT COUNT(*)::text FROM contact_requests WHERE id = $4) AS contact_count`,
      [agent.rows[0]!.id, account.rows[0]!.id, offer.rows[0]!.id, contact.rows[0]!.id],
    );
    assert.deepEqual(survivor.rows[0], {
      agent_count: "1",
      account_count: "1",
      offer_count: "1",
      contact_count: "1",
    });

    const requiredTables = [
      "agency_workspaces",
      "agency_memberships",
      "agency_domain_events",
      "agency_clients",
      "agency_opportunities",
      "agency_intent_versions",
      "agency_supplier_options",
      "agency_quotes",
      "agency_quote_versions",
      "agency_commercial_activities",
      "agency_intelligence_signals",
      "agency_marketplace_projections",
    ];
    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [requiredTables],
    );
    assert.deepEqual(new Set(tables.rows.map((row) => row.table_name)), new Set(requiredTables));

    const ownershipColumn = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='contact_requests' AND column_name='traveler_account_id'
       ) AS exists`,
    );
    assert.equal(ownershipColumn.rows[0]!.exists, true);

    const freshnessTrigger = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM pg_trigger
        WHERE tgname IN ('agency_supplier_options_freshness_guard','agency_quote_versions_freshness_guard')
          AND NOT tgisinternal`,
    );
    assert.equal(freshnessTrigger.rows[0]!.count, "2");
  } finally {
    await client.end();
  }
});
