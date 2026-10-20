import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Preview agency DB verifier uses disposable databases and a one-shot build gate", () => {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8")) as { scripts?: Record<string,string> };
  assert.match(packageJson.scripts?.build ?? "", /verify-preview-agency-commercial-db/);

  const path = "scripts/verify-preview-agency-commercial-db.ts";
  assert.equal(fs.existsSync(path), true);
  const script = fs.readFileSync(path, "utf8");

  assert.match(script, /VERCEL_ENV !== "preview"/);
  assert.match(script, /SILA_PREVIEW_AGENCY_E2E_VERIFY_ENABLED/);
  assert.match(script, /selectDatabaseUrl/);
  assert.match(script, /validatePasswordPilotDatabaseIdentity/);
  assert.match(script, /sila_qa102_/);
  assert.match(script, /CREATE DATABASE/);
  assert.match(script, /DROP DATABASE/);
  assert.match(script, /pg_terminate_backend/);
  assert.match(script, /AGENCY_TEST_DATABASE_URL/);
  assert.match(script, /COMMERCIAL_WORKFLOW_TEST_DATABASE_URL/);
  assert.match(script, /agency-db\.test\.ts/);
  assert.match(script, /commercial-e2e-db\.test\.ts/);
  assert.match(script, /commercial-workflow-db\.test\.ts/);
  assert.match(script, /supply-freshness-db\.test\.ts/);
  assert.match(script, /traveler-workspace-db\.test\.ts/);
  assert.match(script, /traveler-intent-commercial-e2e-db\.test\.ts/);
  assert.match(script, /created = new Set<string>/);
  assert.doesNotMatch(script, /console\.log\([^\n]*(DATABASE_URL|connectionString|password)/i);
});
