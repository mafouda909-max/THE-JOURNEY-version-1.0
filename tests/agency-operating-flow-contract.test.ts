import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");

const agency = read("src/app/account/agency/page.tsx");
const panel = read("src/app/account/agency/AgencyWorkspacePanel.tsx");
const metrics = read("src/app/account/agency/CommercialMetrics.tsx");
const pipeline = read("src/app/account/agency/CommercialPipelinePanel.tsx");
const opportunity = read("src/app/account/agency/opportunities/[opportunityId]/page.tsx");

test("agency workspace follows inquiry to evidence to quote operating flow", () => {
  assert.match(agency, /Inbox/);
  assert.match(agency, /Opportunity/);
  assert.match(agency, /Supplier evidence/);
  assert.match(agency, /Quote/);
  assert.match(agency, /Delivery \/ Outcome/);
  assert.match(panel, /CommercialPipelinePanel/);
});

test("agency pipeline exposes one next operating action", () => {
  assert.match(pipeline, /Next operating action/);
  assert.match(pipeline, /operatingNext/);
  assert.match(pipeline, /INBOX/);
  assert.match(pipeline, /BUILD_QUOTE/);
  assert.match(pipeline, /FOLLOW_UP/);
  assert.match(pipeline, /لا ترسل سعرًا قبل ربطه بـSupplier Option صالح ومصدر واضح/);
});

test("commercial metrics are secondary progressive disclosure", () => {
  assert.match(metrics, /progressive-panel/);
  assert.match(metrics, /طبقة قياس ثانوية/);
  assert.match(metrics, /ليست واجهة القرار الأساسية/);
});

test("opportunity page orders intent evidence quote before delivery", () => {
  const intentIndex = opportunity.indexOf("Client intent");
  const evidenceIndex = opportunity.indexOf("Supplier evidence");
  const quoteIndex = opportunity.indexOf("Quote version");
  const deliveryIndex = opportunity.indexOf("Delivery / Outcome");
  assert.ok(intentIndex >= 0 && intentIndex < evidenceIndex);
  assert.ok(evidenceIndex < quoteIndex);
  assert.ok(quoteIndex < deliveryIndex);
  assert.ok(opportunity.indexOf("<OpportunityWorkspace") < opportunity.indexOf("<QuoteDeliveryPanel"));
});
