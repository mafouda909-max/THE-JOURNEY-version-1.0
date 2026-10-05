import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { PASSWORD_PILOT_MIGRATIONS, passwordAuthSchemaReady } from "../src/lib/password-auth-schema";

const databaseUrl = process.env.COMMERCIAL_WORKFLOW_TEST_DATABASE_URL;

test("pilot upgrade preserves anonymous requests and checks the complete account page schema", { skip: !databaseUrl }, async () => {
  const client = new Client({ connectionString: databaseUrl! });
  const schema = `password_pilot_test_${randomUUID().replaceAll("-", "")}`;
  await client.connect();
  let created = false;
  try {
    // All simulated legacy changes live inside a new, disposable test schema.
    await client.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(readFileSync("db/production_schema.sql", "utf8"));
    await client.query("INSERT INTO agents(display_name,latin_name,bio,photo_url,city,country,license_type) VALUES('Legacy agent','Legacy','QA','/qa','Cairo','Egypt','individual')");
    await client.query("INSERT INTO accounts(email,password_hash,role,display_name) VALUES('legacy@example.invalid','disabled$qa','traveler','Legacy traveler')");
    await client.query("INSERT INTO offers(agent_id,title,description,trip_type,origin_city,destination_city,destination_country,destination_country_en,price_amount,hero_image) VALUES(1,'Legacy offer','QA','package','Cairo','Istanbul','Turkey','Turkey',1000,'/qa')");
    await client.query("INSERT INTO contact_requests(offer_id,agent_id,traveler_name,traveler_email,message) VALUES(1,1,'Guest','legacy@example.invalid','Existing guest request')");
    await client.query("ALTER TABLE contact_requests DROP COLUMN traveler_account_id");
    const database = drizzle(client);
    const ready = () => passwordAuthSchemaReady((statement) => database.execute(statement));
    assert.equal(await ready(), false, "registration must not open when account-page ownership is missing");

    for (let pass = 0; pass < 2; pass += 1) {
      for (const migration of PASSWORD_PILOT_MIGRATIONS) await client.query(readFileSync(migration, "utf8"));
    }
    assert.equal(await ready(), true);
    assert.deepEqual((await client.query("SELECT id,traveler_account_id,message FROM contact_requests")).rows, [{ id: 1, traveler_account_id: null, message: "Existing guest request" }]);
    assert.deepEqual((await client.query("SELECT id,role,display_name FROM accounts")).rows, [{ id: 1, role: "traveler", display_name: "Legacy traveler" }]);
    await assert.rejects(client.query("UPDATE contact_requests SET traveler_account_id=99999 WHERE id=1"), { code: "23503" });

    await client.query("ALTER TABLE notifications RENAME COLUMN idempotency_key TO missing_key");
    assert.equal(await ready(), false, "missing notification columns also block account activation");
    await client.query("ALTER TABLE notifications RENAME COLUMN missing_key TO idempotency_key");
    assert.equal(await ready(), true);
  } finally {
    // Restore a non-test search path before deleting only the schema this test owns.
    await client.query("ROLLBACK");
    await client.query("SET search_path TO public");
    if (created) await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    await client.end();
  }
});
