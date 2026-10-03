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
  "mobile/app.json",
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

  const app = JSON.parse(read("mobile/app.json"));
  assert.equal(app.expo?.name, "صلة — SILA");
});

test("approved SILA vector assets exist", () => {
  for (const path of [
    "public/brand/sila-logo-ar.svg",
    "public/brand/sila-logo-en.svg",
    "public/brand/sila-logo-primary.svg",
    "public/brand/sila-app-icon.svg",
  ]) {
    assert.ok(fs.existsSync(path), `missing ${path}`);
    assert.match(read(path), /<svg/);
  }
});
