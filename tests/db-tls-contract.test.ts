import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("production DB contract checker never disables remote TLS verification", () => {
  const source = readFileSync("scripts/check-production-schema.ts", "utf8");
  assert.doesNotMatch(source, /rejectUnauthorized:\s*false/);
  assert.match(source, /rejectUnauthorized:\s*true/);
  assert.match(source, /parsed\.searchParams\.delete\("sslmode"\)/);
  assert.doesNotMatch(source, /plainClient|fallback/i);
});

test("runtime DB client also strips URI SSL overrides and verifies remote certificates", () => {
  const source = readFileSync("src/db/index.ts", "utf8");
  assert.match(source, /searchParams\.delete\("sslmode"\)/);
  assert.match(source, /rejectUnauthorized:\s*true/);
  assert.doesNotMatch(source, /rejectUnauthorized:\s*false/);
});
