import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const verifierPath = "scripts/verify-preview-agency-commercial-db.ts";

test("Preview agency/commercial DB verifier is isolated, one-shot, and self-cleaning", () => {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };
  assert.match(packageJson.scripts?.build ?? "", /verify-preview-agency-commercial-db/);

  assert.equal(fs.existsSync(verifierPath), true, "Preview agency/commercial verifier must exist");
  const source = fs.readFileSync(verifierPath, "utf8");

  assert.match(source, /VERCEL_ENV !== "preview"/);
  assert.match(source, /SILA_PREVIEW_AGENCY_E2E_VERIFY_ENABLED/);
  assert.match(source, /selectDatabaseUrl/);
  assert.match(source, /current_setting\('neon\.project_id'/);
  assert.match(source, /current_setting\('neon\.branch_id'/);
  assert.match(source, /CREATE DATABASE/);
  assert.match(source, /DROP DATABASE/);
  assert.match(source, /finally/);

  for (const file of [
    "tests/agency-db.test.ts",
    "tests/commercial-e2e-db.test.ts",
    "tests/commercial-workflow-db.test.ts",
    "tests/supply-freshness-db.test.ts",
    "tests/traveler-workspace-db.test.ts",
    "tests/traveler-intent-commercial-e2e-db.test.ts",
  ]) {
    assert.ok(source.includes(file), `missing DB verification suite: ${file}`);
  }

  assert.match(source, /AGENCY_TEST_DATABASE_URL/);
  assert.match(source, /COMMERCIAL_WORKFLOW_TEST_DATABASE_URL/);
  assert.match(source, /DATABASE_URL/);
  assert.match(source, /example\.invalid|qa102/i);
});
