import assert from "node:assert/strict";
import { setTimeout as pause } from "node:timers/promises";

const expected = process.env.EXPECTED_PRODUCTION_SHA;
assert.match(expected ?? "", /^[0-9a-f]{40}$/);
const url = "https://the-journey-version-1-0.vercel.app/api/health";
for (let attempt = 1; attempt <= 28; attempt++) {
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const result = await response.json();
    if (response.status === 200 && result.ok === true && result.deployment?.commit === expected) {
      console.log("Production canonical release and health match expected commit: " + expected);
      process.exit(0);
    }
  } catch { /* Print no raw provider, database or response objects. */ }
  if (attempt < 28) await pause(15_000);
}
throw new Error("Canonical production did not become healthy at the expected commit within the release budget");
