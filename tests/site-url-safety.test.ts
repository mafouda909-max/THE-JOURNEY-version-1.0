import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("canonical URL fallback never points at an unregistered custom domain", () => {
  const source = readFileSync("src/lib/site.ts", "utf8");

  assert.match(source, /https:\/\/the-journey-version-1-0\.vercel\.app/);
  assert.doesNotMatch(source, /https:\/\/alrehlla\.com/);
  assert.match(source, /NEXT_PUBLIC_SITE_URL/);
});
