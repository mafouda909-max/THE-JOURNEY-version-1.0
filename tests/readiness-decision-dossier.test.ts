import assert from "node:assert/strict";
import { test } from "node:test";
import type { AdvisorDecisionClaim } from "../src/lib/readiness-decision-dossier";
import {
  buildReadinessDecisionDossier,
  resolveAdvisorClaimGroups,
} from "../src/lib/readiness-decision-dossier";
import type { AdvisorLiveResearch } from "../src/lib/readiness-advisor";
import type { TravelReadinessResult } from "../src/lib/travel-readiness";

function claim(
  id: string,
  polarity: "YES" | "NO",
  input: Partial<AdvisorDecisionClaim> = {},
): AdvisorDecisionClaim {
  return {
    id,
    topic: "entry_visa",
    topicLabel: "التأشيرة المسبقة",
    statement: polarity === "YES" ? "تأشيرة مطلوبة" : "لا تشترط تأشيرة مسبقة",
    polarity,
    sourceType: "SOURCE_REPORTED",
    sourceLabel: id,
    sourceUrl: `https://example.com/${id}`,
    authorityLevel: 5,
    evidenceStatus: "VERIFIED",
    scope: ["جواز عادي", "سياحة", "2026-12-15"],
    scopeKey: "entry_visa::2026-12-15|جواز عادي|سياحة",
    checkedAt: "2026-10-06T00:00:00.000Z",
    validUntil: null,
    limitations: [],
    ...input,
  };
}

test("opposing current verified claims in the same scope are conflicted", () => {
  const groups = resolveAdvisorClaimGroups([
    claim("official-a", "YES"),
    claim("official-b", "NO"),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.resolution, "CONFLICTED");
  assert.equal(groups[0]?.sourceCount, 2);
});

test("unconfirmed web context cannot overrule a verified scoped claim", () => {
  const groups = resolveAdvisorClaimGroups([
    claim("official", "YES"),
    claim("web", "NO", {
      authorityLevel: 3,
      evidenceStatus: "UNCONFIRMED",
      sourceType: "SOURCE_REPORTED",
    }),
  ]);
  assert.equal(groups[0]?.resolution, "SUPPORTED");
});

test("stale opposing evidence is not treated as a decisive conflict", () => {
  const groups = resolveAdvisorClaimGroups([
    claim("current", "YES"),
    claim("stale", "NO", {
      evidenceStatus: "STALE",
      authorityLevel: 4,
    }),
  ]);
  assert.equal(groups[0]?.resolution, "SUPPORTED");
});

test("dossier generates only traveler-answerable follow-up questions", () => {
  const readiness: TravelReadinessResult = {
    status: "UNKNOWN",
    overallScore: 0,
    evaluatedAt: "2026-10-06T00:00:00.000Z",
    warnings: [],
    missingInformation: [],
    decisionScope: { included: [], excluded: [] },
    checklist: [
      {
        id: "visa_requirement",
        title: "شرط التأشيرة غير معروف بعد",
        category: "VISA",
        isMandatory: true,
        status: "UNKNOWN",
        description: "غير محسوم",
        nextAction: "أكد من المصدر الرسمي",
        evidence: {
          kind: "travel_requirement",
          linkedEntity: null,
          source: { type: "UNKNOWN", label: "لا يوجد مصدر كافٍ", reference: null },
          issuedAt: null,
          observedAt: null,
          checkedAt: null,
          verifiedAt: null,
          validUntil: null,
          scope: ["التأشيرة المسبقة فقط"],
          status: "CONFLICTED",
          reviewer: null,
          limitations: ["المصادر المتاحة متعارضة ضمن نطاق الرحلة."],
        },
      },
      {
        id: "transit_visa",
        title: "شروط العبور غير محسومة",
        category: "TRANSIT",
        isMandatory: true,
        status: "UNKNOWN",
        description: "غير محسوم",
        nextAction: "أكد خط السير",
        evidence: {
          kind: "travel_requirement",
          linkedEntity: null,
          source: { type: "UNKNOWN", label: "لا يوجد مصدر كافٍ", reference: null },
          issuedAt: null,
          observedAt: null,
          checkedAt: null,
          verifiedAt: null,
          validUntil: null,
          scope: ["العبور فقط"],
          status: "UNKNOWN",
          reviewer: null,
          limitations: ["خط السير غير مكتمل."],
        },
      },
    ],
  };
  const research: AdvisorLiveResearch = {
    status: "NOT_CONFIGURED",
    answer: null,
    confidence: null,
    sources: [],
    checkedAt: "2026-10-06T00:00:00.000Z",
    limitations: [],
  };

  const dossier = buildReadinessDecisionDossier(
    {
      nationality: "مصري",
      destination: "تركيا",
      passportValidityMonths: 12,
      travelPurpose: "tourism",
      transitCountry: "إيطاليا",
      advisorAnswers: {
        tourism_accommodation: "مرنة",
        tourism_onward: "نعم",
      },
    },
    readiness,
    research,
  );

  assert.deepEqual(
    dossier.followUpQuestions.map((question) => question.id),
    ["decision_travel_date", "decision_transit_route"],
  );
  assert.deepEqual(dossier.conflicts, []);
  assert.ok(dossier.unresolved.includes("التأشيرة المسبقة"));
  assert.ok(dossier.unresolved.includes("الترانزيت"));
});
