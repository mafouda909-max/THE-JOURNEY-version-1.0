import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { execFileSync } from "node:child_process";

test("generated SILA design tokens are committed and in sync", () => {
  const beforeCss = fs.readFileSync("src/styles/sila-generated.css", "utf8");
  const beforeMobile = fs.readFileSync("mobile/src/generated-brand-tokens.ts", "utf8");

  execFileSync(process.execPath, ["scripts/generate-design-tokens.mjs"], { stdio: "pipe" });

  const afterCss = fs.readFileSync("src/styles/sila-generated.css", "utf8");
  const afterMobile = fs.readFileSync("mobile/src/generated-brand-tokens.ts", "utf8");

  assert.equal(afterCss, beforeCss, "web generated tokens are stale; run npm run design:sync");
  assert.equal(afterMobile, beforeMobile, "mobile generated tokens are stale; run npm run design:sync");
});
