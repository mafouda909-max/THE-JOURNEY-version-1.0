import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReadinessAdvisorResult } from "../src/lib/readiness-advisor";
import type { AdvisorDecisionDossier } from "../src/lib/readiness-decision-dossier";
import type { TravelReadinessInput, TravelReadinessResult } from "../src/lib/travel-readiness";
import {
  buildSavedReadinessState,
  mergeSavedReadinessIntoSnapshot,
  savedReadinessFromSnapshot,
} from "../src/lib/traveler-readiness-memory";

const input: TravelReadinessInput = {
  nationality: "مصري",
  passportValidityMonths: 12,
  destination: "تركيا",
  travelPurpose: "tourism",
  travelDate: "2026-12-15",
  originCity: "القاهرة",
  travelerCount: 2,
  advisorAnswers: {
    tourism_accommodation: "مرنة",
    tourism_onward: "نعم",
  },
};

function result(overrides: Partial<TravelReadinessResult> = {}): TravelReadinessResult {
  return {
    status: "NEEDS_CONFIRMATION",
    overallScore: 0,
    evaluatedAt: "2026-10-06T00:00:00.000Z",
    warnings: [],
    missingInformation: [],
    decisionScope: { included: ["visa"], excluded: [] },
    checklist: [
      {
        id: "visa_requirement",
        title: "شرط التأشيرة",
        category: "VISA",
        isMandatory: true,
        status: "VERIFIED",
        description: "مثبت ضمن النطاق",
        nextAction: "أكد قبل السفر",
        evidence: {
          kind: "travel_requirement",
          linkedEntity: null,
          source: { type: "SOURCE_REPORTED", label: "Official", reference: "https://official.example/visa" },
          issuedAt: null,
          observedAt: "2026-10-05T00:00:00.000Z",
          checkedAt: "2026-10-06T00:00:00.000Z",
          verifiedAt: "2026-10-06T00:00:00.000Z",
          validUntil: "2026-12-01T00:00:00.000Z",
          scope: ["مصري", "تركيا", "سياحة"],
          status: "VERIFIED",
          reviewer: "system",
          limitations: [],
        },
      },
    ],
    ...overrides,
  };
}

function advisor(overrides: Partial<ReadinessAdvisorResult> = {}): ReadinessAdvisorResult {
  return {
    purpose: "tourism",
    purposeLabel: "سياحة",
    questionsToComplete: [],
    preparationTopics: [],
    liveResearch: {
      status: "NOT_CONFIGURED",
      answer: null,
      confidence: null,
      sources: [],
      checkedAt: "2026-10-06T00:00:00.000Z",
      limitations: [],
    },
    routeIntelligence: {
      status: "NOT_APPLICABLE",
      complexity: "UNKNOWN",
      complexityLabel: "لا يوجد ترانزيت مدخل",
      summary: "لا يوجد تحليل مسار.",
      routeDescription: null,
      layoverMinutes: null,
      factors: [],
      limitations: [],
    },
    offers: [],
    offerSearchStatus: "NO_MATCH",
    limitations: [],
    ...overrides,
  };
}

function dossier(overrides: Partial<AdvisorDecisionDossier> = {}): AdvisorDecisionDossier {
  return {
    claims: [],
    groups: [
      {
        key: "entry_visa::tourism",
        topic: "entry_visa",
        topicLabel: "التأشيرة المسبقة",
        resolution: "SUPPORTED",
        claimIds: ["checklist:visa_requirement"],
        sourceCount: 1,
        reason: "مثبت",
      },
    ],
    supported: ["التأشيرة المسبقة"],
    unresolved: [],
    conflicts: [],
    followUpQuestions: [],
    generatedAt: "2026-10-06T00:00:00.000Z",
    ...overrides,
  };
}

test("saved readiness ignores timestamps when the decision substance is unchanged", () => {
  const first = buildSavedReadinessState(null, input, result(), advisor(), dossier());
  assert.equal(first.change.state, "FIRST_CHECK");
  assert.equal(first.freshness.status, "CURRENT");

  const laterResult = result({
    evaluatedAt: "2026-10-07T00:00:00.000Z",
    checklist: result().checklist.map((item) => ({
      ...item,
      evidence: {
        ...item.evidence,
        checkedAt: "2026-10-07T00:00:00.000Z",
        verifiedAt: "2026-10-07T00:00:00.000Z",
      },
    })),
  });
  const second = buildSavedReadinessState(first, input, laterResult, advisor(), dossier());
  assert.equal(second.change.state, "UNCHANGED");
  assert.equal(second.fingerprint, first.fingerprint);
  assert.deepEqual(second.change.changedKeys, []);
});

test("saved readiness reports actual decision deltas", () => {
  const first = buildSavedReadinessState(null, input, result(), advisor(), dossier());
  const changed = buildSavedReadinessState(
    first,
    input,
    result({ status: "NEEDS_ATTENTION" }),
    advisor({
      routeIntelligence: {
        ...advisor().routeIntelligence,
        status: "AVAILABLE",
        complexity: "HIGH",
        complexityLabel: "تعقيد مرتفع",
      },
      offers: [{
        id: 42,
        title: "عرض حقيقي",
        href: "/offers/42",
        destination: "تركيا",
        priceAmount: 100,
        currency: "USD",
        priceType: "per_person",
        agentName: "وكيل",
        matchReasons: ["مطابق"],
        confirmationNeeded: ["أكد التوفر"],
      }],
      offerSearchStatus: "AVAILABLE",
    }),
    dossier({
      groups: [{
        key: "entry_visa::tourism",
        topic: "entry_visa",
        topicLabel: "التأشيرة المسبقة",
        resolution: "CONFLICTED",
        claimIds: ["a", "b"],
        sourceCount: 2,
        reason: "تعارض",
      }],
      conflicts: ["التأشيرة المسبقة"],
      supported: [],
    }),
  );

  assert.equal(changed.change.state, "CHANGED");
  assert.ok(changed.change.changedKeys.includes("status"));
  assert.ok(changed.change.changedKeys.includes("route"));
  assert.ok(changed.change.changedKeys.includes("offers"));
  assert.ok(changed.change.changedKeys.includes("decision:entry_visa"));
});

test("saved readiness freshness is attention for stale or conflicted evidence", () => {
  const stale = result({
    checklist: result().checklist.map((item) => ({
      ...item,
      evidence: { ...item.evidence, status: "STALE" },
    })),
  });
  const state = buildSavedReadinessState(null, input, stale, advisor(), dossier());
  assert.equal(state.freshness.status, "ATTENTION");

  const conflicted = buildSavedReadinessState(
    null,
    input,
    result(),
    advisor(),
    dossier({ conflicts: ["التأشيرة المسبقة"] }),
  );
  assert.equal(conflicted.freshness.status, "ATTENTION");
});

test("saved readiness freshness stays unknown when verified evidence lacks validity metadata", () => {
  const noValidity = result({
    checklist: result().checklist.map((item) => ({
      ...item,
      evidence: { ...item.evidence, validUntil: null },
    })),
  });
  const state = buildSavedReadinessState(null, input, noValidity, advisor(), dossier());
  assert.equal(state.freshness.status, "UNKNOWN");
  assert.equal(state.freshness.nearestValidUntil, null);
});

test("saved readiness round-trips through the reserved snapshot key", () => {
  const state = buildSavedReadinessState(null, input, result(), advisor(), dossier());
  const snapshot = mergeSavedReadinessIntoSnapshot(
    { destinations: ["تركيا"], originCity: "القاهرة" },
    state,
  );
  const parsed = savedReadinessFromSnapshot(snapshot);
  assert.equal(parsed?.fingerprint, state.fingerprint);
  assert.equal(parsed?.input.destination, "تركيا");
  assert.equal((snapshot.destinations as string[])[0], "تركيا");
});


test("changing trip context alone updates memory without claiming the decision changed", () => {
  const first = buildSavedReadinessState(null, input, result(), advisor(), dossier());
  const updatedInput: TravelReadinessInput = {
    ...input,
    travelDate: "2026-12-20",
    budgetAmount: 25000,
    budgetCurrency: "EGP",
  };
  const second = buildSavedReadinessState(
    first,
    updatedInput,
    result({ evaluatedAt: "2026-10-07T00:00:00.000Z" }),
    advisor(),
    dossier(),
  );

  assert.equal(second.change.state, "UNCHANGED");
  assert.equal(second.fingerprint, first.fingerprint);
  assert.deepEqual(second.change.changedKeys, []);
  assert.equal(second.input.travelDate, "2026-12-20");
  assert.equal(second.input.budgetAmount, 25000);
});

test("research availability alone does not masquerade as a decision delta", () => {
  const first = buildSavedReadinessState(null, input, result(), advisor(), dossier());
  const second = buildSavedReadinessState(
    first,
    input,
    result({ evaluatedAt: "2026-10-07T00:00:00.000Z" }),
    advisor({
      liveResearch: {
        status: "AVAILABLE",
        answer: "ملخص بحث حي",
        confidence: "MEDIUM",
        sources: [{
          title: "Official",
          url: "https://official.example/current",
          sourceType: "SOURCE_REPORTED",
        }],
        checkedAt: "2026-10-07T00:00:00.000Z",
        limitations: [],
      },
    }),
    dossier(),
  );

  assert.equal(second.change.state, "UNCHANGED");
  assert.equal(second.fingerprint, first.fingerprint);
  assert.deepEqual(second.change.changedKeys, []);
  assert.equal(second.decision.researchStatus, "AVAILABLE");
});

test("saved freshness ages into attention after the nearest recorded validity expires", () => {
  const state = buildSavedReadinessState(null, input, result(), advisor(), dossier());
  assert.equal(state.freshness.status, "CURRENT");

  const snapshot = mergeSavedReadinessIntoSnapshot({}, state);
  const beforeExpiry = savedReadinessFromSnapshot(
    snapshot,
    new Date("2026-11-30T12:00:00.000Z"),
  );
  assert.equal(beforeExpiry?.freshness.status, "CURRENT");

  const afterExpiry = savedReadinessFromSnapshot(
    snapshot,
    new Date("2026-12-02T00:00:00.000Z"),
  );
  assert.equal(afterExpiry?.freshness.status, "ATTENTION");
  assert.ok(
    afterExpiry?.freshness.reasons.some((reason) => /انتهت أقرب صلاحية/.test(reason)),
  );
});
