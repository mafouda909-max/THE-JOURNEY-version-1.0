import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync("src/app/page.tsx", "utf8");
const travel = fs.readFileSync("src/app/account/travel/page.tsx", "utf8");
const shell = fs.readFileSync("src/components/account/WorkspaceShell.tsx", "utf8");
const design = fs.readFileSync("SILA_PRODUCT_DESIGN_SYSTEM.md", "utf8");

test("public entry reduces decision pressure with truthful reassurance", () => {
  assert.match(home, /ابدأ من اللي تعرفه/);
  assert.match(home, /بدون حجز أو دفع/);
  assert.match(home, /المؤكد عن اللي يحتاج تأكيد/);
});

test("traveler workspace elevates one next action and progressively discloses alternatives", () => {
  assert.match(travel, /الخطوة التالية/);
  assert.match(travel, /nextAction/);
  assert.match(travel, /<details className="sila-progressive/);
  assert.match(travel, /كل الأدوات الخاصة بهذه الرحلة/);
});

test("workspace and doctrine use explicit state instead of covert stress sensing", () => {
  assert.match(shell, /sila-cognitive-shell/);
  assert.match(design, /infer stress from covert biometrics/);
  assert.match(design, /\*\*Calm\*\*/);
  assert.match(design, /\*\*Focus\*\*/);
  assert.match(design, /\*\*Critical\*\*/);
});
