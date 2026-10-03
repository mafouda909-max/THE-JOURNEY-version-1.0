import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("live flight comparison is explicitly gated and defaults off", () => {
  const page = readFileSync("src/app/compare/page.tsx", "utf8");
  const api = readFileSync("src/app/api/travel/compare/route.ts", "utf8");
  const env = readFileSync(".env.example", "utf8");

  assert.match(page, /FLIGHT_COMPARE_ENABLED/);
  assert.match(api, /FLIGHT_COMPARE_ENABLED/);
  assert.match(api, /status:\s*503/);
  assert.match(env, /^FLIGHT_COMPARE_ENABLED=false$/m);
});
