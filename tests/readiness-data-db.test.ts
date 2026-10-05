import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Client } from "pg";

const databaseUrl = process.env.COMMERCIAL_WORKFLOW_TEST_DATABASE_URL;
test("readiness read scope, real server timeout, rollback and pool recovery", { skip: !databaseUrl }, async () => {
  const url = new URL(databaseUrl!);
  assert.ok(["localhost","127.0.0.1"].includes(url.hostname));
  assert.equal(url.pathname, "/journey_phase1");
  assert.equal(process.env.DATABASE_URL, databaseUrl);
  const lock = new Client({ connectionString: databaseUrl! });
  await lock.connect();
  const { pool } = await import("../src/db");
  try {
    await lock.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await lock.query(readFileSync("db/production_schema.sql","utf8"));
    await lock.query("INSERT INTO travel_knowledge(category,country,destination_country,data_payload,source_type,freshness_status,checked_at) VALUES('visa','QA','TEST','{}','UNKNOWN','UNKNOWN',NOW()),('visa','OTHER','TEST','{}','UNKNOWN','UNKNOWN',NOW())");
    const { readVisaKnowledge } = await import("../src/lib/travel-knowledge-read");
    const rows = await readVisaKnowledge("QA","TEST");
    assert.equal(rows.length,1);
    assert.equal(rows[0].country,"QA");
    assert.ok(rows[0].checkedAt instanceof Date);
    await lock.query("BEGIN; LOCK TABLE travel_knowledge IN ACCESS EXCLUSIVE MODE;");
    const started = Date.now();
    await assert.rejects(readVisaKnowledge("QA","TEST"), (error: unknown) => (error as { code?: string }).code === "57014");
    assert.ok(Date.now()-started < 9000, "Server must cancel the lock wait, not leave an unbounded statement");
    await lock.query("ROLLBACK");
    assert.equal((await readVisaKnowledge("QA","TEST")).length,1);
    const timeout = await pool.query("SHOW statement_timeout");
    assert.notEqual(timeout.rows[0].statement_timeout,"4s","Local readiness policy cannot leak into unrelated business queries");
    assert.equal(pool.waitingCount,0);
  } finally {
    await lock.query("ROLLBACK").catch(() => {});
    await lock.end();
    await pool.end();
  }
});
