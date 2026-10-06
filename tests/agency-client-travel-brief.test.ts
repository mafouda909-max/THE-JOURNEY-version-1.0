import assert from "node:assert/strict";
import { test } from "node:test";
import { projectAgencyClientTravelBrief } from "../src/lib/agency-client-travel-brief";

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    label: "Private trip",
    privateNotes: "must-not-leak",
    __silaReadiness: {
      version: 1,
      checkedAt: "2026-10-06T00:00:00.000Z",
      input: {
        nationality: "مصري",
        passportValidityMonths: 12,
        destination: "تركيا",
        transitCountry: "إيطاليا",
        travelPurpose: "tourism",
        travelDate: "2026-12-15",
        originCity: "القاهرة",
        travelerCount: 2,
        budgetAmount: 999999,
        budgetCurrency: "EGP",
        advisorAnswers: {
          tourism_accommodation: "عنوان خاص لا يجب كشفه",
          tourism_onward: "نعم",
        },
      },
      decision: {
        status: "NEEDS_CONFIRMATION",
        routeComplexity: "MEDIUM",
        groups: [
          { key: "entry_visa::tourism", topic: "entry_visa", resolution: "UNCONFIRMED" },
          { key: "transit::italy", topic: "transit", resolution: "UNKNOWN" },
        ],
        checklist: [],
        researchStatus: "NOT_CONFIGURED",
        preparation: [
          { id: "passport", requirementState: "TO_VERIFY", readinessState: "REPORTED_READY" },
          { id: "entry_visa", requirementState: "TO_VERIFY", readinessState: "UNKNOWN" },
          { id: "tourism_accommodation", requirementState: "TO_VERIFY", readinessState: "NEEDS_ACTION" },
        ],
        offerIds: [41],
      },
      fingerprint: "a".repeat(64),
      freshness: {
        status: "UNKNOWN",
        nearestValidUntil: null,
        reasons: ["أعد التأكيد قبل الالتزام."],
      },
      change: {
        state: "CHANGED",
        previousCheckedAt: "2026-10-05T00:00:00.000Z",
        changedKeys: [
          "preparation:tourism_accommodation",
          "decision:entry_visa",
          "not-allowed-private-key",
        ],
      },
      ...overrides,
    },
  };
}

test("agency brief is a minimal projection and excludes raw traveler answers and commercial/private fields", () => {
  const brief = projectAgencyClientTravelBrief(snapshot());
  assert.ok(brief);
  assert.equal(brief.source, "linked_saved_trip");
  assert.equal(brief.trip.nationality, "مصري");
  assert.equal(brief.trip.destination, "تركيا");
  assert.equal(brief.trip.purpose, "tourism");
  assert.equal(brief.decision.routeComplexity, "MEDIUM");
  assert.deepEqual(brief.change.changedKeys, [
    "preparation:tourism_accommodation",
    "decision:entry_visa",
  ]);

  const serialized = JSON.stringify(brief);
  assert.doesNotMatch(serialized, /عنوان خاص/);
  assert.doesNotMatch(serialized, /999999/);
  assert.doesNotMatch(serialized, /EGP/);
  assert.doesNotMatch(serialized, /aaaaaaaaaaaaaaaa/);
  assert.doesNotMatch(serialized, /privateNotes/);
  assert.doesNotMatch(serialized, /advisorAnswers/);
  assert.doesNotMatch(serialized, /offerIds/);
});

test("agency brief maps saved preparation states to the canonical safe item catalog", () => {
  const brief = projectAgencyClientTravelBrief(snapshot());
  assert.ok(brief);
  const accommodation = brief.preparation.find((item) => item.id === "tourism_accommodation");
  assert.deepEqual(accommodation, {
    id: "tourism_accommodation",
    category: "ACCOMMODATION",
    title: "الإقامة وإثبات مكان السكن",
    requirementState: "TO_VERIFY",
    readinessState: "NEEDS_ACTION",
    nextAction: "حدد مكان الإقامة، ثم أكد من المصدر الرسمي هل يلزم إثبات حجز أو عنوان.",
  });
});

test("agency projection fails closed for unknown preparation ids or malformed required trip context", () => {
  const unknownItem = snapshot({
    decision: {
      status: "NEEDS_CONFIRMATION",
      routeComplexity: "UNKNOWN",
      groups: [],
      checklist: [],
      researchStatus: "NOT_CONFIGURED",
      preparation: [
        { id: "invented_secret_item", requirementState: "TO_VERIFY", readinessState: "UNKNOWN" },
      ],
      offerIds: [],
    },
  });
  assert.equal(projectAgencyClientTravelBrief(unknownItem), null);

  const badNationality = snapshot({
    input: {
      nationality: "",
      passportValidityMonths: 12,
      destination: "تركيا",
      travelPurpose: "tourism",
    },
  });
  assert.equal(projectAgencyClientTravelBrief(badNationality), null);
});

test("agency projection ages CURRENT freshness through the canonical saved-readiness parser", () => {
  const expired = snapshot({
    freshness: {
      status: "CURRENT",
      nearestValidUntil: "2026-10-05T00:00:00.000Z",
      reasons: ["كان الدليل صالحًا وقت الفحص."],
    },
  });
  const brief = projectAgencyClientTravelBrief(expired, new Date("2026-10-06T00:00:00.000Z"));
  assert.ok(brief);
  assert.equal(brief.freshness.status, "ATTENTION");
  assert.ok(brief.freshness.reasons.some((reason) => /انتهت أقرب صلاحية/.test(reason)));
});
