import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("agency adopts an explicitly linked Saved Intent only within the inquiry's traveler account", () => {
  const route = read("src/app/api/agency/workspaces/[id]/inquiries/route.ts");
  const helper = read("src/lib/agency-linked-intent.ts");

  assert.match(route, /TRAVELER_WORKSPACE_ENABLED !== "true"/);
  assert.match(route, /traveler_intent_inquiries/);
  assert.match(route, /tsi\.account_id = \([\s\S]*?traveler_account_id/);
  assert.match(route, /buildMarketplaceInquiryIntent/);
  assert.match(route, /intent: projectedIntent\.value/);
  assert.match(helper, /SHAREABLE_INTENT_FIELDS/);
  assert.match(helper, /parseTravelerIntent/);
  assert.doesNotMatch(helper, /__silaReadiness|nationality|travelerEmail|password/);
});

test("contact form explains which saved-trip fields are shared with the offer owner", () => {
  const form = read("src/components/market/ContactForm.tsx");
  assert.match(form, /ربط الطلب برحلة محفوظة/);
  assert.match(form, /تشارك صلة مع مقدم الخدمة بيانات الخطة اللازمة للطلب/);
  assert.match(form, /لا تُشارك ذاكرة الجاهزية أو الرحلات الأخرى غير المرتبطة/);
});

test("the end-to-end contract proves saved intent reaches the agency commercial version", () => {
  const e2e = read("tests/traveler-intent-commercial-e2e-db.test.ts");
  assert.match(e2e, /agency_intent_versions/);
  assert.match(e2e, /sharedIntent\.budgetAmountMinor/);
  assert.match(e2e, /sharedIntent\.priorities/);
  assert.match(e2e, /DO_NOT_SHARE_READINESS_MEMORY/);
  assert.match(e2e, /hasOwnProperty\.call\(sharedIntent, "__silaReadiness"\), false/);
});
