import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const RUNTIME_FILES = [
  "src/app/globals.css",
  "src/styles/sila-generated.css",
  "src/lib/brand.ts",
  "src/app/page.tsx",
  "src/app/offers/page.tsx",
  "src/app/agents/page.tsx",
  "src/app/destinations/page.tsx",
  "src/app/trust/page.tsx",
  "src/app/offers/[id]/page.tsx",
  "src/components/market/SearchModule.tsx",
  "src/components/market/OfferCard.tsx",
  "src/components/market/OffersBrowser.tsx",
  "mobile/src/theme.ts",
  "mobile/src/generated-brand-tokens.ts",
  "mobile/src/App.tsx",
  "mobile/src/components/ui.tsx",
  "mobile/src/screens/OfferDetailScreen.tsx",
  "public/brand/asset-manifest.json",
];

test("retired warm SILA brand accents do not leak into runtime identity", () => {
  for (const path of RUNTIME_FILES) {
    const content = fs.readFileSync(path, "utf8");
    assert.doesNotMatch(content, /#FFC5AB/i, `${path} still contains retired peach`);
    assert.doesNotMatch(content, /#B2462E/i, `${path} still contains retired coral`);
    assert.doesNotMatch(content, /(?:color-|bg-|text-|border-)?apricot/i, `${path} still contains apricot token`);
    assert.doesNotMatch(content, /(?:color-|bg-|text-|border-)?clay/i, `${path} still contains clay token`);
  }
});

test("cool-blue SILA signal tokens are canonical", () => {
  const canonical = JSON.parse(fs.readFileSync("design/sila.tokens.json", "utf8"));
  const manifest = JSON.parse(fs.readFileSync("public/brand/asset-manifest.json", "utf8"));

  assert.equal(canonical.color.signal.value, "#2E6FD8");
  assert.equal(canonical.color.sky.value, "#7CC8E8");
  assert.equal(manifest.colors.signal, "#2E6FD8");
  assert.equal(manifest.colors.sky, "#7CC8E8");
});
