import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("public indexing is fail-closed until explicitly enabled", () => {
  const helper = fs.readFileSync("src/lib/public-indexing.ts", "utf8");
  const layout = fs.readFileSync("src/app/layout.tsx", "utf8");
  const robots = fs.readFileSync("src/app/robots.ts", "utf8");
  const sitemap = fs.readFileSync("src/app/sitemap.ts", "utf8");

  assert.match(helper, /PUBLIC_INDEXING_ENABLED === "true"/);
  assert.match(layout, /index: false, follow: false, nocache: true/);
  assert.match(robots, /disallow: "\/"/);
  assert.match(sitemap, /if \(!publicIndexingEnabled\) return \[\]/);
});

test("indexing enablement retains protected surfaces", () => {
  const robots = fs.readFileSync("src/app/robots.ts", "utf8");
  assert.match(robots, /disallow: \["\/review", "\/api\/"\]/);
});
