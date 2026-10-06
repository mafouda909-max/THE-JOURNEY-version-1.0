import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSilaAdvisorBrain } from "../src/lib/sila-advisor-brain";
import {
  createSilaTravelCase,
  mergeSilaTravelCaseMessage,
} from "../src/lib/sila-advisor-travel-case";

test("builds an executive advisor answer with source and offer boundaries", () => {
  const travelCase = createSilaTravelCase(
    "أنا مصري وعايز أسافر تركيا سياحة في ديسمبر أنا ومراتي وطفلة والميزانية محدودة",
    new Date("2026-10-06T10:00:00.000Z"),
  );

  const brain = buildSilaAdvisorBrain(travelCase);

  assert.equal(brain.audience, "TRAVELER");
  assert.match(brain.answer, /تركيا/);
  assert.equal(brain.trustState, "NEEDS_OFFICIAL_SOURCES");
  assert.ok(brain.researchNeeds.some((need) => need.id === "entry-rules"));
  assert.match(brain.offerPolicy, /مخزون حقيقي/);
  assert.ok(brain.nextActions.length > 0);
});

test("builds an agent brief without inventing offer or visa claims", () => {
  const travelCase = createSilaTravelCase(
    "عميل مصري عايز إسبانيا سياحة شهر 7 وميزانيته محدودة وعايز عرض عائلي",
    new Date("2026-10-06T10:00:00.000Z"),
  );
  const updated = mergeSilaTravelCaseMessage(
    travelCase,
    "العميل مهتم بأقل سعر ومش عايز ترانزيت طويل ولسه مش عارف الجوازات سارية ولا لا",
    new Date("2026-10-06T10:03:00.000Z"),
  );

  const brain = buildSilaAdvisorBrain(updated);

  assert.equal(brain.audience, "AGENT");
  assert.ok(brain.agentBrief);
  assert.ok(brain.agentBrief?.knownTripFacts.some((fact) => fact.includes("إسبانيا")));
  assert.ok(brain.agentBrief?.customerContext.some((item) => item.includes("السعر")));
  assert.ok(brain.agentBrief?.doNotAssume.some((item) => item.includes("مصدر رسمي")));
  assert.ok(brain.researchNeeds.some((need) => need.id === "agent-quote-readiness"));
});
