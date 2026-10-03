import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");

const PUBLIC_FILES = [
  "src/app/layout.tsx",
  "src/components/chrome.tsx",
  "src/app/page.tsx",
  "src/app/trust/page.tsx",
  "src/app/agents/page.tsx",
  "src/app/review/page.tsx",
  "src/app/offers/[id]/page.tsx",
  "src/app/join/page.tsx",
  "src/lib/providers/email.ts",
  "src/lib/providers/ai.ts",
  "src/lib/ai-document-verification.ts",
  "mobile/app.json",
  "mobile/src/brand.ts",
  "mobile/src/App.tsx",
  "mobile/src/components/ui.tsx",
  "mobile/src/screens/OffersScreen.tsx",
];

test("public product surfaces use SILA / صلة naming", () => {
  for (const path of PUBLIC_FILES) {
    const content = read(path);
    assert.doesNotMatch(content, /THE JOURNEY/iu, `${path} still exposes THE JOURNEY`);
    assert.doesNotMatch(content, /منصة الرحلة/u, `${path} still exposes منصة الرحلة`);
    assert.doesNotMatch(content, /وكيل الرحلة/u, `${path} still exposes وكيل الرحلة`);
  }

  for (const path of ["src/components/chrome.tsx", "src/app/trust/page.tsx", "src/lib/brand.ts"]) {
    assert.doesNotMatch(read(path), /alrihla\.travel|alrehlla\.com/iu, `${path} hardcodes a legacy public domain`);
  }

  const app = JSON.parse(read("mobile/app.json"));
  assert.equal(app.expo?.name, "صلة — SILA");

  const mobileBrand = read("mobile/src/brand.ts");
  assert.match(mobileBrand, /nameAr: "صلة"/u);
  assert.match(mobileBrand, /nameEn: "SILA"/);
  assert.match(mobileBrand, /اعرف قبل أن تختار/u);
});

test("approved SILA vector assets exist", () => {
  for (const path of [
    "public/brand/sila-logo-ar.svg",
    "public/brand/sila-logo-en.svg",
    "public/brand/sila-logo-primary.svg",
    "public/brand/sila-app-icon.svg",
    "public/brand/asset-manifest.json",
  ]) {
    assert.ok(fs.existsSync(path), `missing ${path}`);
    if (path.endsWith(".svg")) assert.match(read(path), /<svg/);
  }
});

test("brand source of truth preserves approved logo rules", () => {
  const manifest = JSON.parse(read("public/brand/asset-manifest.json"));
  assert.equal(manifest.brand, "SILA / صلة");
  assert.match(String(manifest.rules?.arabicKasra), /ص/u);
  assert.match(String(manifest.rules?.arabicKasra), /ل/u);
  assert.match(String(manifest.rules?.retyping), /forbidden/i);

  const brand = read("src/lib/brand.ts");
  assert.match(brand, /nameAr: "صلة"/u);
  assert.match(brand, /nameEn: "SILA"/);
  assert.match(brand, /اعرف قبل أن تختار/u);
});
