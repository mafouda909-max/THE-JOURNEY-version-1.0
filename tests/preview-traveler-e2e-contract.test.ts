import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Preview traveler E2E verifier is build-gated and isolated", () => {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8")) as { scripts?: Record<string,string> };
  assert.match(packageJson.scripts?.build ?? "", /verify-preview-traveler-e2e/);

  const path = "scripts/verify-preview-traveler-e2e.ts";
  assert.equal(fs.existsSync(path), true);
  const script = fs.readFileSync(path, "utf8");
  assert.match(script, /VERCEL_ENV !== "preview"/);
  assert.match(script, /SILA_PREVIEW_TRAVELER_E2E_VERIFY_ENABLED/);
  assert.match(script, /selectDatabaseUrl/);
  assert.match(script, /current_setting\('neon\.project_id'/);
  assert.match(script, /traveler\/intents/);
  assert.match(script, /example\.invalid/);
  assert.match(script, /DELETE FROM traveler_saved_intents/);
  assert.match(script, /DELETE FROM accounts/);
});
