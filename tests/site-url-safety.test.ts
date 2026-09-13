import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const FORBIDDEN_UNOWNED_DOMAIN = "alrehlla.com";

function sourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

test("canonical URL fallback never points at an unregistered custom domain", () => {
  const source = readFileSync("src/lib/site.ts", "utf8");

  assert.match(source, /https:\/\/the-journey-version-1-0\.vercel\.app/);
  assert.doesNotMatch(source, /https:\/\/alrehlla\.com/);
  assert.match(source, /NEXT_PUBLIC_SITE_URL/);
});

test("application source never hardcodes the unowned custom domain", () => {
  for (const path of sourceFiles("src")) {
    const source = readFileSync(path, "utf8");
    assert.equal(
      source.includes(FORBIDDEN_UNOWNED_DOMAIN),
      false,
      `${path} must derive public origin from SITE_ORIGIN instead of hardcoding ${FORBIDDEN_UNOWNED_DOMAIN}`,
    );
  }
});
