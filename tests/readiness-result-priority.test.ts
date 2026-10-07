import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReadinessResponse } from "../src/lib/readiness-contract";
import {
  buildTravelerExecutiveSummary,
  selectReadinessPriorityActions,
} from "../src/lib/readiness-result-priority";

const generatedAt = "2026-10-06T00:00:00.000Z";

function baseResult(input: Partial<ReadinessResponse> = {}): ReadinessResponse {
  return {
    status: "UNKNOWN",
    overallScore: 0,
    evaluatedAt: generatedAt,
    warnings: [],
    missingInformation: [],
    decisionScope: { included: [], excluded: [] },
    checklist: [],
    disclosure: "فحص استرشادي لا يضمن السفر أو الدخول.",
    ...input,
  } as ReadinessResponse;
}

function emptyTravelDossier() {
  return {
    purpose: "tourism" as const,
    items: [],
    confirmedRequired: [],
    confirmedNotRequired: [],
    travelerAction: [],
    needsOfficialConfirmation: [],
    planning: [],
    generatedAt,
    limitations: [],
  };
}

function advisor(input: Partial<NonNullable<ReadinessResponse["advisor"]>> = {}): NonNullable<ReadinessResponse["advisor"]> {
  return {
    purpose: "tourism",
    purposeLabel: "سياحة",
    questionsToComplete: [],
    preparationTopics: [],
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
      confidence: null,
      sources: [],
      checkedAt: generatedAt,
      limitations: [],
    },
    travelDossier: emptyTravelDossier(),
    offers: [],
    offerSearchStatus: "NO_MATCH",
    limitations: [],
    ...input,
  };
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
          source: { type: "curated", label: "قاعدة صلة", reference: null },
          status: "VERIFIED",
          scope: ["جواز عادي"],
          checkedAt: generatedAt,
          observedAt: generatedAt,
          verifiedAt: generatedAt,
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
    advisor: advisor({
      questionsToComplete: ["هل التذكرة ذهاب وعودة أم اتجاه واحد؟"],
    }),
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
    advisor: advisor({
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
        confidence: "MEDIUM",
        sources: [{ title: "Official source", url: "https://example.com", sourceType: "SOURCE_REPORTED" }],
        checkedAt: generatedAt,
        limitations: [],
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
          priceType: "per_person",
          matchReasons: ["الوجهة متطابقة"],
          confirmationNeeded: [],
        },
      ],
      offerSearchStatus: "AVAILABLE",
    }),
  });

  const summary = buildTravelerExecutiveSummary(result);
  const actions = selectReadinessPriorityActions(result);

  assert.equal(summary.verdictTone, "success");
  assert.equal(summary.counts.matchingOffers, 1);
  assert.equal(summary.matchingOffersLabel, "توجد عروض صلة مطابقة داخل المنصة");
  assert.equal(actions.at(-1)?.label, "عرض مطابق");
});
