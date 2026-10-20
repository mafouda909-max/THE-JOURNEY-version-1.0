import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const ci = fs.readFileSync(".github/workflows/ci.yml", "utf8");
const seed = fs.readFileSync("scripts/seed-service-browser.ts", "utf8");
const password = fs.readFileSync("tests/browser/password-registration.spec.ts", "utf8");

test("CI runs the repository on the pinned Node 22 runtime", () => {
  assert.doesNotMatch(ci, /node-version:\s*24/);
  const setupSteps = [...ci.matchAll(/node-version:\s*([^\n]+)/g)].map((match) => match[1].trim());
  assert.ok(setupSteps.length >= 6);
  assert.ok(setupSteps.every((value) => value === "22"));
});

test("browser QA includes the traveler workspace schema and runtime surface", () => {
  assert.match(ci, /TRAVELER_WORKSPACE_ENABLED:\s*"true"/);
  assert.match(seed, /phase6_traveler_workspace\.sql/);
  assert.match(password, /\/account\/travel/);
  assert.match(password, /احفظ نية السفر/);
  assert.match(password, /الخطوة التالية/);
  assert.match(password, /visual-traveler-workspace-/);
});

test("visual closure browser suite is part of CI artifacts", () => {
  assert.equal(fs.existsSync("tests/browser/visual-closure.spec.ts"), true);
  const visual = fs.readFileSync("tests/browser/visual-closure.spec.ts", "utf8");
  assert.match(visual, /decision-board/);
  assert.match(visual, /focus-action/);
  assert.match(visual, /52/);
  assert.match(visual, /scrollWidth/);
  assert.match(visual, /sila-reading/);
  assert.match(visual, /visual-closure-/);
  assert.match(ci, /test-results\/visual-closure-\*\.png/);
});
