import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync("src/app/page.tsx", "utf8");
const search = fs.readFileSync("src/components/market/SearchModule.tsx", "utf8");
const travelerForm = fs.readFileSync("src/components/market/TravelerIntentForm.tsx", "utf8");
const intro = fs.readFileSync("src/components/brand/SilaPageIntro.tsx", "utf8");

test("SILA home carries the decision-path visual signature", () => {
  assert.match(home, /SilaDecisionField/);
  assert.match(home, /sila-trust-rail/);
  assert.match(home, /sila-step-rail/);
});

test("search uses one branded action surface instead of generic chip UI", () => {
  assert.match(search, /SilaRelationRail/);
  assert.match(search, /bg-signal/);
  assert.match(search, /min-h-\[52px\]/);
  assert.doesNotMatch(search, /transition-all/);
});

test("traveler form uses persistent labels and progressive disclosure", () => {
  assert.match(travelerForm, /<fieldset/);
  assert.match(travelerForm, /htmlFor="intent-destination"/);
  assert.match(travelerForm, /<details className="sila-progressive/);
  assert.match(travelerForm, /الحفظ لا يرسل طلبًا لأي وكيل/);
});

test("page intro is open composition rather than a decorative side-stripe card", () => {
  assert.match(intro, /sila-brand-intro/);
  assert.doesNotMatch(intro, /inset-y-0 start-0 w-1\.5 bg-signal/);
});
