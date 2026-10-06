import assert from "node:assert/strict";
import test from "node:test";
import { createSilaTravelCase } from "../src/lib/sila-advisor-travel-case";
import { runSilaAgenticOs } from "../src/lib/sila-agentic-os";
import type { AdvisorDecisionDossier } from "../src/lib/readiness-decision-dossier";

const NOW = new Date("2026-10-06T10:00:00.000Z");

test("Sila Agentic OS coordinates specialist agents instead of one chatbot response", () => {
  const travelCase = createSilaTravelCase(
    "أنا مصري وعايز أسافر تركيا سياحة في ديسمبر والميزانية محدودة، وعايز أعرف أبدأ منين.",
    NOW,
  );

  const os = runSilaAgenticOs({ travelCase }, NOW);

  assert.equal(os.mode, "AGENTIC_OS_V1");
  assert.ok(os.agents.some((agent) => agent.role === "RESEARCH_AGENT"));
  assert.ok(os.agents.some((agent) => agent.role === "QUALITY_GUARD"));
  assert.ok(os.workflow.some((step) => step.id === "recall-memory"));
  assert.ok(os.workflow.some((step) => step.id === "collect-evidence"));
  assert.equal(os.workflow.at(-1)?.id, "quality-gate");
  assert.equal(os.finalGate.canAnswerUser, true);
  assert.equal(os.finalGate.canPublishOrChangeOffer, false);
});

test("Sila Agentic OS blocks offer recommendation when offer audit says suspend", () => {
  const os = runSilaAgenticOs(
    {
      offers: [
        {
          title: "عرض تركيا منتهي",
          description: "برنامج سياحي إلى تركيا يحتاج إعادة مراجعة لأن تاريخ السفر والصلاحية انتهوا ولا يجوز عرضه للمستخدم قبل التأكيد.",
          status: "published",
          destinationCountry: "تركيا",
          tripType: "tourism",
          priceAmount: 10000,
          currency: "EGP",
          expiresAt: "2026-09-01",
          departureDate: "2026-09-10",
          agentVerificationStatus: "verified",
          agentTrustCurrent: true,
          lastConfirmedAt: "2026-08-15",
          sourceEvidence: [
            {
              label: "تأكيد وكيل قديم",
              kind: "agent_statement",
              checkedAt: "2026-08-15",
            },
          ],
          includes: ["فندق"],
          excludes: ["الطيران"],
        },
      ],
    },
    NOW,
  );

  assert.ok(os.workflow.some((step) => step.id === "audit-offers"));
  assert.ok(os.workflow.some((step) => step.id === "schedule-offer-monitoring"));
  assert.equal(os.finalGate.canRecommendOffer, false);
  assert.ok(os.finalGate.reason.includes("تغيير عرض") || os.finalGate.reason.includes("محجوبة"));
});


test("Sila Agentic OS blocks strong recommendation when decision evidence conflicts", () => {
  const travelCase = createSilaTravelCase(
    "أنا مصري وعايز تركيا سياحة في ديسمبر",
    NOW,
  );
  const decisionDossier: AdvisorDecisionDossier = {
    claims: [{
      id: "visa:conflict",
      topic: "entry_visa",
      topicLabel: "التأشيرة المسبقة",
      statement: "مصدران متعارضان",
      polarity: "UNKNOWN",
      sourceType: "SOURCE_REPORTED",
      sourceLabel: "Official conflict",
      sourceUrl: "https://official.example/conflict",
      authorityLevel: 5,
      evidenceStatus: "CONFLICTED",
      scope: ["مصري", "تركيا", "سياحة"],
      scopeKey: "entry_visa::سياحة|تركيا|مصري",
      checkedAt: "2026-10-06T10:00:00.000Z",
      validUntil: null,
      limitations: ["conflict"],
    }],
    groups: [{
      key: "entry_visa::سياحة|تركيا|مصري",
      topic: "entry_visa",
      topicLabel: "التأشيرة المسبقة",
      resolution: "CONFLICTED",
      claimIds: ["visa:conflict"],
      sourceCount: 2,
      reason: "conflict",
    }],
    supported: [],
    unresolved: [],
    conflicts: ["التأشيرة المسبقة"],
    followUpQuestions: [],
    generatedAt: NOW.toISOString(),
  };

  const os = runSilaAgenticOs({ travelCase, decisionDossier }, NOW);

  assert.ok(
    os.workflow.some(
      (step) => step.id === "review-evidence-ledger" && step.status === "BLOCKED",
    ),
  );
  assert.equal(os.finalGate.canRecommendOffer, false);
  assert.ok(os.finalGate.reason.includes("متضاربة"));
});
