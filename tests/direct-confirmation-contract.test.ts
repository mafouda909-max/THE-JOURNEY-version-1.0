import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("direct confirmation is feature-gated and tied to an approved exact quote delivery", () => {
  const migration = read("db/phase9_direct_confirmation.sql");
  const agencyRoute = read("src/app/api/agency/workspaces/[id]/opportunities/[opportunityId]/direct-confirmation/route.ts");
  const publicResponse = read("src/lib/quote-delivery-public.ts");
  const ackRoute = read("src/app/api/quote-deliveries/[token]/acknowledge/route.ts");
  const env = read(".env.example");

  assert.match(env, /DIRECT_CONFIRMATION_ENABLED=false/);
  assert.match(agencyRoute, /DIRECT_CONFIRMATION_ENABLED !== "true"/);
  assert.match(agencyRoute, /delivery\.status !== "responded" \|\| delivery\.response !== "approved"/);
  assert.match(agencyRoute, /agency_direct_confirmations/);
  assert.match(migration, /delivery_id INTEGER NOT NULL UNIQUE/);
  assert.match(migration, /delivery_status <> 'responded' OR delivery_response <> 'approved'/);
  assert.match(migration, /traveler response can be recorded only once/);
  assert.match(publicResponse, /DIRECT_CONFIRMATION_ENABLED !== "true"/);
  assert.match(publicResponse, /row\.delivery_status !== "responded" \|\| row\.response !== "approved"/);
  assert.match(publicResponse, /quote\.direct_confirmation_traveler_response/);
  assert.match(ackRoute, /DIRECT_CONFIRMATION_ENABLED !== "true"/);
});

test("traveler-facing copy distinguishes approval and direct-contact acknowledgement from booking/payment", () => {
  const quotePage = read("src/app/q/[token]/page.tsx");
  const quoteActions = read("src/app/q/[token]/QuoteClientActions.tsx");
  const directConfirmation = read("src/app/q/[token]/DirectConfirmationActions.tsx");
  const agencyPanel = read("src/components/agency/DirectConfirmationPanel.tsx");

  assert.match(quotePage, /لا تنفذ صلة حجزًا أو إصدار تذكرة أو تحصيل أموال/);
  assert.match(quoteActions, /يجب أن يؤكدها مقدم الخدمة معك مباشرة خارج صلة/);
  assert.match(directConfirmation, /ليست تحققًا مستقلًا من صلة أو حجزًا أو تذكرة أو عملية دفع/);
  assert.match(agencyPanel, /ليست تحققًا مستقلًا من صلة أو حجزًا مؤكدًا داخل المنصة/);
  assert.match(directConfirmation, /not_confirmed/);
});

test("demo documentation explicitly records the one-offer versus multi-provider RFQ boundary", () => {
  const doc = read("docs/SILA_DIRECT_CONFIRMATION_AND_DEMO_PLAYBOOK.md");
  assert.match(doc, /Traveler request → provider\/agency offer → traveler decision/);
  assert.match(doc, /not yet.*multi-provider RFQ/i);
  assert.match(doc, /DIRECT_CONFIRMATION_ENABLED defaults to false/);
});
