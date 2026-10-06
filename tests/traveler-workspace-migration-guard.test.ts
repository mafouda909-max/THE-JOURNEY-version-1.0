import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const script = readFileSync("scripts/prepare-traveler-workspace.ts", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};

test("traveler workspace migration is dry-run by default and owner-gated for writes", () => {
  assert.match(script, /const APPLY_FLAG = "--apply"/);
  assert.match(script, /TRAVELER_WORKSPACE_MIGRATION_OWNER_APPROVED/);
  assert.match(script, /if \(apply && process\.env\[OWNER_APPROVAL_ENV\] !== "true"\)/);
  assert.match(script, /READY TO APPLY/);
});

test("traveler workspace migration refuses unknown and legacy databases", () => {
  assert.match(script, /late-mountain-20124572/);
  assert.match(script, /current_setting\('neon\.project_id', true\)/);
  assert.match(script, /current_setting\('neon\.branch_id', true\)/);
  assert.match(script, /projectId === LEGACY_NEON_PROJECT_ID/);
});

test("traveler workspace migration uses a direct Neon connection and exact Phase 6 file", () => {
  assert.match(script, /hostname\.replace\(\/-pooler/);
  assert.match(script, /db\/phase6_traveler_workspace\.sql/);
  assert.match(script, /accounts/);
  assert.match(script, /offers/);
  assert.match(script, /contact_requests/);
  assert.match(script, /traveler_saved_intents/);
  assert.match(script, /traveler_intent_offers/);
  assert.match(script, /traveler_intent_inquiries/);
});

test("traveler workspace migration is never part of automatic build", () => {
  assert.equal(packageJson.scripts.build.includes("prepare-traveler-workspace"), false);
  assert.match(packageJson.scripts["db:traveler-workspace:check"], /prepare-traveler-workspace\.ts/);
  assert.match(packageJson.scripts["db:traveler-workspace:apply"], /prepare-traveler-workspace\.ts --apply/);
});
