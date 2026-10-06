import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const helper = readFileSync("src/lib/traveler-memory-runtime.ts", "utf8");
const route = readFileSync("src/app/api/health/traveler-memory/route.ts", "utf8");
const productionSmoke = readFileSync("tests/production/readiness.spec.ts", "utf8");

test("traveler memory runtime proof rejects legacy and requires the owned schema", () => {
  assert.match(helper, /late-mountain-20124572/);
  assert.match(helper, /current_setting\('neon\.project_id', true\)/);
  assert.match(helper, /current_setting\('neon\.branch_id', true\)/);
  assert.match(helper, /traveler_saved_intents/);
  assert.match(helper, /traveler_intent_offers/);
  assert.match(helper, /traveler_intent_inquiries/);
  assert.match(helper, /safeToEnable = managedNeon && branchIdentityPresent && notLegacy && schemaReady/);
});

test("public traveler memory health never returns raw database identity", () => {
  assert.doesNotMatch(route, /project_id|branch_id|DATABASE_URL|POSTGRES_URL/);
  assert.doesNotMatch(helper, /projectId,|branchId,/);
  assert.doesNotMatch(helper, /error:/);
});

test("production smoke proves the runtime traveler memory contract", () => {
  assert.match(productionSmoke, /\/api\/health\/traveler-memory/);
  assert.match(productionSmoke, /memoryState\.safeToEnable/);
  assert.match(productionSmoke, /memoryState\.database\.notLegacy/);
  assert.match(productionSmoke, /memoryState\.schema\.ready/);
});
