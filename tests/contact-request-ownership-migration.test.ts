import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Client } from "pg";

const databaseUrl = process.env.COMMERCIAL_WORKFLOW_TEST_DATABASE_URL;
const migrationPath = "db/contact_request_ownership.sql";

test("release manifest keeps traveler ownership migration in the existing-database chain", () => {
  const manifest = JSON.parse(readFileSync("db/release_manifest.json", "utf8")) as {
    existingDatabaseMigrations: string[];
  };
  const ownershipIndex = manifest.existingDatabaseMigrations.indexOf(migrationPath);
  const agencyFoundationIndex = manifest.existingDatabaseMigrations.indexOf("db/phase1_agency_foundation.sql");

  assert.ok(ownershipIndex >= 0, `${migrationPath} must remain in the release migration chain`);
  assert.ok(agencyFoundationIndex >= 0, "agency foundation migration must remain in the release chain");
  assert.ok(ownershipIndex < agencyFoundationIndex, "traveler ownership must be aligned before agency commercial migrations");

  const migration = readFileSync(migrationPath, "utf8").replace(/\r\n?/g, "\n");
  assert.match(migration, /ADD COLUMN IF NOT EXISTS traveler_account_id INTEGER/);
  assert.match(migration, /FOREIGN KEY \(traveler_account_id\)[\s\S]*REFERENCES accounts\(id\)[\s\S]*ON DELETE SET NULL/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS contact_requests_traveler_account_idx[\s\S]*ON contact_requests\(traveler_account_id\)/);
});

test("traveler ownership migration upgrades a legacy contact_requests table without claiming anonymous rows", { skip: !databaseUrl }, async () => {
  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();
  const schema = `ownership_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await client.query(`
      CREATE TABLE accounts (
        id SERIAL PRIMARY KEY
      );
      CREATE TABLE contact_requests (
        id SERIAL PRIMARY KEY,
        traveler_name TEXT NOT NULL,
        traveler_email TEXT NOT NULL
      );
      INSERT INTO contact_requests (traveler_name, traveler_email)
      VALUES ('Legacy anonymous traveler', 'legacy@example.invalid');
    `);

    await client.query(readFileSync(migrationPath, "utf8"));

    const contract = await client.query<{
      has_column: boolean;
      has_fk: boolean;
      has_index: boolean;
      anonymous_is_unclaimed: boolean;
    }>(`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = $1
            AND table_name = 'contact_requests'
            AND column_name = 'traveler_account_id'
            AND is_nullable = 'YES'
        ) AS has_column,
        EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'contact_requests_traveler_account_id_fkey'
            AND conrelid = 'contact_requests'::regclass
        ) AS has_fk,
        EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = $1
            AND tablename = 'contact_requests'
            AND indexname = 'contact_requests_traveler_account_idx'
        ) AS has_index,
        EXISTS (
          SELECT 1 FROM contact_requests
          WHERE traveler_email = 'legacy@example.invalid'
            AND traveler_account_id IS NULL
        ) AS anonymous_is_unclaimed
    `, [schema]);

    assert.deepEqual(contract.rows[0], {
      has_column: true,
      has_fk: true,
      has_index: true,
      anonymous_is_unclaimed: true,
    });

    const account = await client.query<{ id: number }>("INSERT INTO accounts DEFAULT VALUES RETURNING id");
    await client.query(
      "UPDATE contact_requests SET traveler_account_id = $1 WHERE traveler_email = 'legacy@example.invalid'",
      [account.rows[0]!.id],
    );
    await client.query("DELETE FROM accounts WHERE id = $1", [account.rows[0]!.id]);
    const deletedOwner = await client.query<{ traveler_account_id: number | null }>(
      "SELECT traveler_account_id FROM contact_requests WHERE traveler_email = 'legacy@example.invalid'",
    );
    assert.equal(deletedOwner.rows[0]!.traveler_account_id, null);
  } finally {
    await client.query("RESET search_path").catch(() => undefined);
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => undefined);
    await client.end();
  }
});
