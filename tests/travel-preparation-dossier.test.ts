import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTravelPreparationDossier } from "../src/lib/travel-preparation-dossier";
import type { TravelReadinessInput, TravelReadinessResult } from "../src/lib/travel-readiness";

function baseResult(overrides: Partial<TravelReadinessResult> = {}): TravelReadinessResult {
  return {
    status: "NEEDS_CONFIRMATION",
    overallScore: 0,
    evaluatedAt: "2026-10-06T00:00:00.000Z",
    warnings: [],
    missingInformation: [],
    decisionScope: { included: [], excluded: [] },
    checklist: [
      {
        id: "passport_validity",
        title: "صلاحية الجواز تحتاج تأكيدًا",
        category: "PASSPORT",
        isMandatory: true,
        status: "PENDING_CONFIRMATION",
        description: "12 شهر حسب إدخال المسافر.",
        nextAction: "طابق الصلاحية مع المصدر الرسمي.",
        evidence: {
          kind: "traveler_report",
          linkedEntity: null,
          source: { type: "TRAVELER_REPORTED", label: "إدخال المسافر", reference: null },
          issuedAt: null,
          observedAt: "2026-10-06T00:00:00.000Z",
          checkedAt: null,
          verifiedAt: null,
          validUntil: null,
          scope: ["مدة الصلاحية المدخلة فقط"],
          status: "REPORTED",
          reviewer: null,
          limitations: ["لم يُفحص الجواز."],
        },
      },
      {
        id: "visa_requirement",
        title: "شرط التأشيرة غير معروف بعد",
        category: "VISA",
        isMandatory: true,
        status: "UNKNOWN",
        description: "لا يوجد دليل مطابق.",
        nextAction: "أكد من المصدر الرسمي.",
        evidence: {
          kind: "travel_requirement",
          linkedEntity: null,
          source: { type: "UNKNOWN", label: "لا يوجد مصدر كافٍ", reference: null },
          issuedAt: null,
          observedAt: null,
          checkedAt: null,
          verifiedAt: null,
          validUntil: null,
          scope: ["سياحة", "جواز عادي"],
          status: "UNKNOWN",
          reviewer: null,
          limitations: ["لا يوجد حكم."],
        },
      },
    ],
    ...overrides,
  };
}

function input(
  purpose: TravelReadinessInput["travelPurpose"],
  answers: Record<string, string> = {},
): TravelReadinessInput {
  return {
    nationality: "مصري",
    destination: "TEST",
    passportValidityMonths: 12,
    travelPurpose: purpose,
    travelDate: "2026-12-15",
    advisorAnswers: answers,
  };
}

test("purpose planning never becomes an official requirement without evidence", () => {
  const dossier = buildTravelPreparationDossier(
    input("tourism", {
      tourism_accommodation: "محجوزة",
      tourism_onward: "نعم",
    }),
    baseResult(),
  );

  const accommodation = dossier.items.find((item) => item.id === "tourism_accommodation");
  assert.equal(accommodation?.readinessState, "REPORTED_READY");
  assert.equal(accommodation?.requirementState, "TO_VERIFY");
  assert.equal(accommodation?.evidence, null);

  const arrival = dossier.items.find((item) => item.id === "tourism_arrival");
  assert.equal(arrival?.requirementState, "PLANNING_ONLY");
  assert.equal(arrival?.readinessState, "UNKNOWN");
});

test("traveler answers update preparedness but do not create verified evidence", () => {
  const dossier = buildTravelPreparationDossier(
    input("study", { study_admission: "نعم", study_duration: "سنة" }),
    baseResult(),
  );
  const admission = dossier.items.find((item) => item.id === "study_admission");
  assert.equal(admission?.readinessState, "REPORTED_READY");
  assert.equal(admission?.requirementState, "TO_VERIFY");
  assert.equal(admission?.travelerReport, "نعم");
  assert.equal(admission?.evidence, null);
});

test("scoped verified visa evidence is the only thing that confirms the visa requirement", () => {
  const verified = baseResult({
    status: "NEEDS_ATTENTION",
    checklist: [
      baseResult().checklist[0]!,
      {
        id: "visa_requirement",
        title: "تأشيرة مسبقة مطلوبة",
        category: "VISA",
        isMandatory: true,
        status: "PENDING_ACTION",
        description: "مثبت ضمن نطاق الاختبار.",
        nextAction: "قدّم على التأشيرة.",
        evidence: {
          kind: "travel_requirement",
          linkedEntity: { type: "travel_fact", id: "41" },
          source: {
            type: "VERIFIED",
            label: "Official immigration source",
            reference: "https://official.example/visa",
          },
          issuedAt: "2026-10-01T00:00:00.000Z",
          observedAt: "2026-10-05T00:00:00.000Z",
          checkedAt: "2026-10-05T00:00:00.000Z",
          verifiedAt: "2026-10-05T00:00:00.000Z",
          validUntil: "2026-12-31T00:00:00.000Z",
          scope: ["مصري", "TEST", "سياحة", "2026-12-15"],
          status: "VERIFIED",
          reviewer: "system",
          limitations: ["يخص التأشيرة المسبقة فقط."],
        },
      },
    ],
  });

  const dossier = buildTravelPreparationDossier(input("tourism"), verified);
  const visa = dossier.items.find((item) => item.id === "entry_visa");
  assert.equal(visa?.requirementState, "CONFIRMED_REQUIRED");
  assert.equal(visa?.readinessState, "NEEDS_TRAVELER_CONFIRMATION");
  assert.equal(visa?.evidence?.evidenceStatus, "VERIFIED");
  assert.equal(visa?.evidence?.sourceUrl, "https://official.example/visa");
});

test("confirmed visa exemption stays scoped and becomes not applicable for traveler readiness", () => {
  const verified = baseResult({
    status: "NEEDS_CONFIRMATION",
    checklist: [
      baseResult().checklist[0]!,
      {
        id: "visa_requirement",
        title: "لا تشترط تأشيرة مسبقة ضمن النطاق",
        category: "VISA",
        isMandatory: false,
        status: "VERIFIED",
        description: "هذا الحكم لا يثبت بقية شروط الدخول.",
        nextAction: "راجع بقية شروط الدخول.",
        evidence: {
          kind: "travel_requirement",
          linkedEntity: { type: "travel_fact", id: "42" },
          source: {
            type: "VERIFIED",
            label: "Official immigration source",
            reference: "https://official.example/exempt",
          },
          issuedAt: "2026-10-01T00:00:00.000Z",
          observedAt: "2026-10-05T00:00:00.000Z",
          checkedAt: "2026-10-05T00:00:00.000Z",
          verifiedAt: "2026-10-05T00:00:00.000Z",
          validUntil: "2026-12-31T00:00:00.000Z",
          scope: ["مصري", "TEST", "سياحة", "2026-12-15"],
          status: "VERIFIED",
          reviewer: "system",
          limitations: ["التأشيرة المسبقة فقط."],
        },
      },
    ],
  });

  const dossier = buildTravelPreparationDossier(input("tourism"), verified);
  const visa = dossier.items.find((item) => item.id === "entry_visa");
  assert.equal(visa?.requirementState, "CONFIRMED_NOT_REQUIRED");
  assert.equal(visa?.readinessState, "NOT_APPLICABLE");
});

test("all travel purposes receive a non-empty safe preparation pack", () => {
  const purposes: NonNullable<TravelReadinessInput["travelPurpose"]>[] = [
    "tourism", "study", "work", "business", "freelance",
    "umrah", "visit", "medical", "transit", "other",
  ];
  for (const purpose of purposes) {
    const dossier = buildTravelPreparationDossier(input(purpose), baseResult());
    assert.ok(dossier.items.length >= 5, purpose);
    assert.ok(dossier.items.every((item) => item.limitations.length > 0), purpose);
    assert.ok(dossier.items.every((item) => item.title.length > 0 && item.nextAction.length > 0), purpose);
  }
});
