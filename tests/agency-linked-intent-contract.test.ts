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
  const shareableFields = helper.match(
    /const SHAREABLE_INTENT_FIELDS = \[([\s\S]*?)\] as const/,
  )?.[1] ?? "";
  assert.ok(shareableFields.length > 0);
  assert.match(helper, /parseTravelerIntent/);
  assert.doesNotMatch(shareableFields, /__silaReadiness|nationality|travelerEmail|password/);
});

test("readiness is a separate, unchecked, per-request opt-in", () => {
  const form = read("src/components/market/ContactForm.tsx");
  const contact = read("src/app/api/contact-requests/route.ts");
  const agencyOpportunity = read("src/app/api/agency/workspaces/[id]/opportunities/[opportunityId]/route.ts");

  assert.match(form, /name="shareReadinessBrief"/);
  assert.match(form, /defaultChecked=\{false\}/);
  assert.match(form, /أوافق على مشاركة ملخص جاهزية السفر/);
  assert.match(form, /لا يتضمن إجاباتك الخام للمستشار/);
  assert.match(contact, /shareReadinessBrief === true/);
  assert.match(contact, /readinessBriefShared/);
  assert.match(contact, /readinessBriefConsentAt/);
  assert.match(agencyOpportunity, /TRAVELER_WORKSPACE_ENABLED === "true"/);
  assert.match(agencyOpportunity, /readinessBriefShared":true/);
  assert.match(agencyOpportunity, /tsi\.account_id = cr\.traveler_account_id/);
});

test("the end-to-end contract proves saved intent reaches the agency commercial version", () => {
  const e2e = read("tests/traveler-intent-commercial-e2e-db.test.ts");
  assert.match(e2e, /agency_intent_versions/);
  assert.match(e2e, /sharedIntent\.budgetAmountMinor/);
  assert.match(e2e, /sharedIntent\.priorities/);
  assert.match(e2e, /DO_NOT_SHARE_READINESS_MEMORY/);
  assert.match(e2e, /hasOwnProperty\.call\(sharedIntent, "__silaReadiness"\), false/);
});
