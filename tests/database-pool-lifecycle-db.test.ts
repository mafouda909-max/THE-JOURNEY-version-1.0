import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "pg";
import { pool } from "../src/db";

const databaseUrl = process.env.COMMERCIAL_WORKFLOW_TEST_DATABASE_URL;
test("a terminated idle database connection does not crash the process and the next query recovers", { skip: !databaseUrl }, async () => {
  const parsed = new URL(databaseUrl!);
  assert.ok(["127.0.0.1", "localhost"].includes(parsed.hostname));
  assert.equal(parsed.pathname, "/journey_phase1");
  assert.equal(databaseUrl, process.env.DATABASE_URL);
  const control = new Client({ connectionString: databaseUrl! });
  await control.connect();
  try {
    const connection = await pool.connect();
    const { rows } = await connection.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
    connection.release();
    // Removing the product handler would leave only the assertion listener;
    // verify registration before adding the test observer.
    assert.equal(pool.listenerCount("error"), 1);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Idle error was not observed")), 3000);
      pool.once("error", () => { clearTimeout(timer); resolve(); });
      void control.query("SELECT pg_terminate_backend($1)", [rows[0].pid]).catch(error => { clearTimeout(timer); reject(error); });
    });
    assert.equal(pool.listenerCount("error"), 1);
    assert.equal((await pool.query<{ ok: number }>("SELECT 1 AS ok")).rows[0].ok, 1);
  } finally { await pool.end(); await control.end(); }
});
