import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = readFileSync(".github/workflows/production-db-check.yml", "utf8");
const script = readFileSync("scripts/check-production-schema.ts", "utf8");
const productionSmoke = readFileSync("tests/production/readiness.spec.ts", "utf8");

test("secret-backed production DB contract stays manual while live Vercel proof is automatic", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /push:\s*\n\s*branches:/);
  assert.match(productionSmoke, /\/api\/health\/traveler-memory/);
  assert.match(productionSmoke, /memoryState\.safeToEnable/);
});

test("production DB contract requires a pinned Neon production identity", () => {
  assert.match(workflow, /PRODUCTION_NEON_PROJECT_ID: \$\{\{ secrets\.PRODUCTION_NEON_PROJECT_ID \}\}/);
  assert.match(script, /PRODUCTION_NEON_PROJECT_ID is required/);
  assert.match(script, /current_setting\('neon\.project_id', true\)/);
  assert.match(script, /current_setting\('neon\.branch_id', true\)/);
  assert.match(script, /late-mountain-20124572/);
  assert.match(script, /observedProjectId !== expectedProjectId/);
});

test("production DB contract still proves traveler workspace schema", () => {
  assert.match(script, /traveler_saved_intents/);
  assert.match(script, /traveler_intent_offers/);
  assert.match(script, /traveler_intent_inquiries/);
  assert.match(script, /including traveler workspace memory tables/);
});

test("production DB contract never prints project IDs or database URLs", () => {
  assert.doesNotMatch(script, /console\.(?:log|error)\([^\n]*observedProjectId/);
  assert.doesNotMatch(script, /console\.(?:log|error)\([^\n]*expectedProjectId/);
  assert.doesNotMatch(script, /console\.(?:log|error)\([^\n]*databaseUrl/);
});
