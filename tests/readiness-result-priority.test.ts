import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReadinessResponse } from "../src/lib/readiness-contract";
import {
  buildTravelerExecutiveSummary,
  selectReadinessPriorityActions,
} from "../src/lib/readiness-result-priority";

function baseResult(input: Partial<ReadinessResponse> = {}): ReadinessResponse {
  return {
    status: "UNKNOWN",
    overallScore: 0,
    evaluatedAt: "2026-10-06T00:00:00.000Z",
    warnings: [],
    missingInformation: [],
    decisionScope: { included: [], excluded: [] },
    checklist: [],
    disclosure: "فحص استرشادي لا يضمن السفر أو الدخول.",
    ...input,
  } as ReadinessResponse;
}

test("executive summary prioritizes blockers above generic readiness copy", () => {
  const result = baseResult({
    status: "BLOCKED",
    checklist: [
      {
        id: "passport_validity",
        title: "صلاحية الجواز غير كافية",
        status: "BLOCKED",
        isMandatory: true,
        description: "الجواز أقل من النطاق المطلوب في الفحص.",
        nextAction: "جدد الجواز قبل الحجز أو السفر.",
        evidence: {
          source: { label: "قاعدة صلة", reference: null },
          status: "VERIFIED",
          scope: ["جواز عادي"],
          checkedAt: "2026-10-06T00:00:00.000Z",
          observedAt: "2026-10-06T00:00:00.000Z",
          verifiedAt: "2026-10-06T00:00:00.000Z",
          validUntil: null,
          limitations: [],
        },
      },
    ],
  });

  const summary = buildTravelerExecutiveSummary(result);
  const actions = selectReadinessPriorityActions(result);

  assert.equal(summary.verdictTone, "critical");
  assert.equal(summary.verdictLabel, "لا تتحرك قبل حل المانع");
  assert.equal(summary.primaryRisk, "صلاحية الجواز غير كافية");
  assert.equal(summary.counts.blockers, 1);
  assert.equal(actions[0]?.label, "مانع");
  assert.equal(actions[0]?.nextAction, "جدد الجواز قبل الحجز أو السفر.");
});

test("priority actions surface missing questions before low-value diagnostics", () => {
  const result = baseResult({
    status: "NEEDS_CONFIRMATION",
    missingInformation: ["حدد هل لديك حجز إقامة مؤكد."],
    advisor: {
      purposeLabel: "سياحة",
      followUpQuestions: [],
      questionsToComplete: ["هل التذكرة ذهاب وعودة أم اتجاه واحد؟"],
      routeIntelligence: {
        status: "NOT_APPLICABLE",
        complexity: "UNKNOWN",
        complexityLabel: "لا يوجد ترانزيت ظاهر",
        summary: "لا يوجد مسار ترانزيت في البيانات.",
        routeDescription: null,
        layoverMinutes: null,
        factors: [],
        limitations: [],
      },
      liveResearch: {
        status: "NOT_CONFIGURED",
        answer: null,
        sources: [],
        checkedAt: "2026-10-06T00:00:00.000Z",
      },
      travelDossier: {
        purpose: "tourism",
        purposeLabel: "سياحة",
        items: [],
        confirmedRequired: [],
        confirmedNotRequired: [],
        needsOfficialConfirmation: [],
        planning: [],
      },
      offers: [],
      offerSearchStatus: "NO_MATCH",
      warnings: [],
    },
  });

  const actions = selectReadinessPriorityActions(result);
  assert.equal(actions[0]?.label, "سؤال ناقص");
  assert.equal(actions[0]?.body, "هل التذكرة ذهاب وعودة أم اتجاه واحد؟");
  assert.equal(actions[1]?.label, "معلومة ناقصة");
  assert.equal(actions[1]?.body, "حدد هل لديك حجز إقامة مؤكد.");
});

test("summary reports real matching offers without inventing supply", () => {
  const result = baseResult({
    status: "READY",
    advisor: {
      purposeLabel: "سياحة",
      followUpQuestions: [],
      questionsToComplete: [],
      routeIntelligence: {
        status: "NOT_APPLICABLE",
        complexity: "LOW",
        complexityLabel: "مسار مباشر",
        summary: "لا يوجد ترانزيت ظاهر.",
        routeDescription: null,
        layoverMinutes: null,
        factors: [],
        limitations: [],
      },
      liveResearch: {
        status: "AVAILABLE",
        answer: "مصادر متاحة.",
        sources: [{ title: "Official source", url: "https://example.com" }],
        checkedAt: "2026-10-06T00:00:00.000Z",
      },
      travelDossier: {
        purpose: "tourism",
        purposeLabel: "سياحة",
        items: [],
        confirmedRequired: [],
        confirmedNotRequired: [],
        needsOfficialConfirmation: [],
        planning: [],
      },
      offers: [
        {
          id: 101,
          title: "باكدج اسطنبول",
          href: "/offers/101",
          destination: "تركيا",
          agentName: "وكيل موثق",
          priceAmount: 500,
          currency: "USD",
          matchReasons: ["الوجهة متطابقة"],
          confirmationNeeded: [],
        },
      ],
      offerSearchStatus: "AVAILABLE",
      warnings: [],
    },
  });

  const summary = buildTravelerExecutiveSummary(result);
  const actions = selectReadinessPriorityActions(result);

  assert.equal(summary.verdictTone, "success");
  assert.equal(summary.counts.matchingOffers, 1);
  assert.equal(summary.matchingOffersLabel, "توجد عروض صلة مطابقة داخل المنصة");
  assert.equal(actions.at(-1)?.label, "عرض مطابق");
});
