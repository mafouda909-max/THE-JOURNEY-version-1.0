import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n?/g, "\n");

test("traveler self-registration is discoverable through separately gated auth methods", () => {
  const join = read("src/app/join/page.tsx");
  const legacyAuth = read("src/app/api/auth/[action]/route.ts");
  const google = read("src/app/api/auth/google/start/route.ts");
  const magic = read("src/app/api/auth/magic/request/route.ts");
  assert.match(join, /signup-traveler/);
  assert.match(join, /مسافر جديد/);
  assert.match(join, /المتابعة باستخدام Google/);
  assert.match(join, /إرسال رابط دخول آمن/);
  assert.match(google, /role/);
  assert.match(magic, /requestedRole/);
  assert.match(legacyAuth, /passwordAuthPost\(request, "signup"\)/);
});

test("traveler workspace is fail-closed behind an environment flag", () => {
  const page = read("src/app/account/travel/page.tsx");
  const intents = read("src/app/api/traveler/intents/route.ts");
  const intentOffers = read("src/app/api/traveler/intents/[id]/offers/route.ts");
  const env = read(".env.example");
  assert.match(page, /TRAVELER_WORKSPACE_ENABLED !== "true"\) notFound/);
  assert.match(intents, /TRAVELER_WORKSPACE_ENABLED !== "true"/);
  assert.match(intentOffers, /TRAVELER_WORKSPACE_ENABLED !== "true"/);
  assert.match(env, /TRAVELER_WORKSPACE_ENABLED=false/);
});

test("saved intents are owner scoped across search, comparison and readiness", () => {
  for (const path of [
    "src/app/api/traveler/intents/route.ts",
    "src/app/api/traveler/intents/[id]/offers/route.ts",
    "src/app/compare/page.tsx",
    "src/app/readiness/page.tsx",
  ]) {
    const source = read(path);
    assert.match(source, /travelerSavedIntents\.accountId/);
    assert.ok(source.includes("account!.id") || source.includes("account.id"), `${path} must scope the intent to the authenticated account`);
  }
});

test("intent-linked inquiry requires traveler ownership and becomes the agency source chain", () => {
  const contact = read("src/app/api/contact-requests/route.ts");
  const workspace = read("src/app/account/travel/page.tsx");
  assert.match(contact, /savedIntentId/);
  assert.match(contact, /travelerSavedIntents\.accountId, travelerAccount\.id/);
  assert.match(contact, /travelerIntentInquiries/);
  assert.match(workspace, /JOIN agency_opportunities ao ON ao\.source_contact_request_id = cr\.id/);
  assert.match(workspace, /JOIN agency_quote_deliveries qd ON qd\.opportunity_id = ao\.id/);
  assert.match(workspace, /cr\.traveler_account_id = \$1/);
});

test("contact success state does not promise an unsupported response SLA", () => {
  const form = read("src/components/market/ContactForm.tsx");
  assert.doesNotMatch(form, /٤٨ ساعة|48 ساعة|كحد أقصى/);
  assert.match(form, /زمن الرد يعتمد على الوكيل/);
});

test("comparison and readiness reuse only safe intent fields", () => {
  const compare = read("src/app/compare/page.tsx");
  const compareWorkbench = read("src/components/market/FlightCompareWorkbench.tsx");
  const readiness = read("src/app/readiness/page.tsx");
  assert.match(compare, /departureDate/);
  assert.match(compare, /returnDate/);
  assert.match(compareWorkbench, /لا تحوّل أسماء المدن إلى IATA بدون مصدر موثوق/);
  assert.match(readiness, /destinations/);
  assert.doesNotMatch(readiness, /snap\.nationality/);
});


test("readiness memory is owner-scoped and final results are server-persisted only", () => {
  const route = read("src/app/api/travel/readiness/route.ts");
  const store = read("src/lib/traveler-readiness-store.ts");
  const workbench = read("src/components/market/TravelReadinessWorkbench.tsx");
  const readinessPage = read("src/app/readiness/page.tsx");
  const workspace = read("src/app/account/travel/page.tsx");

  assert.match(route, /savedIntentId/);
  assert.match(route, /loadOwnedSavedIntentReadiness/);
  assert.match(route, /persistOwnedSavedIntentReadiness/);
  assert.match(route, /requireAccount\(account, \["traveler"\]\)/);
  assert.match(route, /TRAVELER_WORKSPACE_ENABLED !== "true"/);
  assert.match(route, /savedTripStatus/);
  assert.match(route, /PERSIST_FAILED/);
  assert.doesNotMatch(route, /readinessInput:\s*raw/);

  assert.match(store, /account_id=\$2/);
  assert.match(store, /FOR UPDATE/);
  assert.match(store, /BEGIN/);
  assert.match(store, /COMMIT/);
  assert.match(store, /ROLLBACK/);

  assert.match(workbench, /savedIntentId: initial\?\.intentId/);
  assert.match(workbench, /SAVED_CHANGE/);
  assert.match(workbench, /SAVED_FRESHNESS/);

  assert.match(readinessPage, /savedReadinessFromSnapshot/);
  assert.match(readinessPage, /travelerSavedIntents\.accountId/);
  assert.doesNotMatch(readinessPage, /snap\.nationality/);

  assert.match(workspace, /savedReadinessFromSnapshot/);
  assert.match(workspace, /أعد التحقق الآن/);
  assert.match(workspace, /Traveler Memory/);
  assert.match(workspace, /الخطوة التالية/);
});

test("saved readiness memory does not require a new database table", () => {
  const schema = read("src/db/schema.ts");
  const memory = read("src/lib/traveler-readiness-memory.ts");
  assert.match(schema, /intentSnapshot: jsonb\("intent_snapshot"\)/);
  assert.match(memory, /SAVED_READINESS_KEY = "__silaReadiness"/);
  assert.doesNotMatch(schema, /traveler_readiness_memory|saved_readiness_results/);
});
