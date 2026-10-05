import assert from "node:assert/strict";
import { test } from "node:test";
import type { TravelKnowledge } from "../src/db/schema";
import { TravelIntelService, TravelIntelUnavailable } from "../src/lib/travel-intel";
import { TravelReadinessEngine, type TravelReadinessInput } from "../src/lib/travel-readiness";
import { isReadinessQuestionsResponse, isReadinessResponse, parseReadinessInput } from "../src/lib/readiness-contract";
import { evidenceSourceUrl } from "../src/lib/evidence";

const now = Date.parse("2026-10-05T12:30:00.000Z");
const scope = { travelDocument: "passport", purpose: "tourism", travelDates: { from: "2026-10-01", until: "2026-11-30" } };
const query = { nationality: "QA", destination: "TEST", travelDocument: "passport" as const, purpose: "tourism", travelDate: "2026-11-01" };
const emptySearch = async () => ({ query: "QA only", results: [], retrievedAt: new Date(now).toISOString(), freshness: "unknown" as const });
const disabledWeb = { isConfigured: () => false, search: emptySearch };
function row(overrides: Partial<TravelKnowledge> = {}, data: Record<string, unknown> = {}): TravelKnowledge {
  return {
    id: 1, category: "visa", country: "QA", destinationCountry: "TEST",
    dataPayload: JSON.stringify({ visaRequired: false, decisionBasis: "structured_authoritative", scope, requirements: ["Isolated QA rule, never production evidence"], ...data }),
    sourceType: "VERIFIED", freshnessStatus: "FRESH", sourceUrl: "https://official.example/isolated-qa",
    retrievedAt: new Date(now-3600000), checkedAt: new Date(now-1800000), validUntil: new Date(now+3600000), ...overrides,
  };
}
const service = (rows: TravelKnowledge[]) => new TravelIntelService(async () => rows, disabledWeb, () => now);

test("visa decisions retain source timestamps and require matching scope and real freshness", async () => {
  const fresh = await service([row()]).getVisaRequirements(query);
  assert.equal(fresh.visaRequired, false);
  assert.equal(fresh.checkedAt, "2026-10-05T12:00:00.000Z");
  assert.notEqual(fresh.checkedAt, fresh.evaluatedAt);
  assert.equal(fresh.evidence.verifiedAt, null, "Do not invent verification/reviewer from check time");
  assert.equal(fresh.evidence.reviewer, null);
  for (const record of [
    row({ validUntil: new Date(now-1) }),
    row({ checkedAt: new Date(now-25*3600000) }),
    row({ checkedAt: new Date(now+3600000) }),
    row({ sourceUrl: null }),
    row({ sourceType: "AI_INFERRED" }),
    row({}, { scope: undefined }),
    row({}, { scope: { ...scope, purpose: undefined } }),
    row({}, { scope: { ...scope, travelDocument: "diplomatic" } }),
    row({}, { scope: { ...scope, purpose: "business" } }),
    row({}, { scope: { ...scope, travelDates: { from: "2026-02-30", until: "2026-12-01" } } }),
    row({}, { scope: { ...scope, travelDates: { from: "2026-11-02", until: "2026-11-30" } } }),
  ]) assert.equal((await service([record]).getVisaRequirements(query)).visaRequired, "VERIFICATION_REQUIRED");
  assert.equal((await service([row({ validUntil: new Date(now-1) })]).getVisaRequirements(query)).evidence.status, "EXPIRED");
  assert.equal((await service([row({ checkedAt: new Date(now-25*3600000) })]).getVisaRequirements(query)).evidence.status, "STALE");
  assert.equal((await service([row()]).getVisaRequirements({ ...query, purpose: undefined })).visaRequired, "VERIFICATION_REQUIRED");
});
test("conflicting and over-budget evidence cannot become an entry decision", async () => {
  const conflict = await service([row(),row({ id: 2 }, { visaRequired: true })]).getVisaRequirements(query);
  assert.equal(conflict.visaRequired, "VERIFICATION_REQUIRED");
  assert.equal(conflict.evidence.status, "CONFLICTED");
  assert.equal((await service(Array.from({ length: 51 }, (_,index) => row({ id: index+1 }))).getVisaRequirements(query)).visaRequired, "VERIFICATION_REQUIRED");
});
test("search candidates never become verification and operational errors never become a successful unknown", async () => {
  const web = { isConfigured: () => true, search: async () => ({ ...await emptySearch(), results: [{ title: "Candidate only", url: "https://mofa.gov.bad.example/embassy", content: "Not an entry rule" }] }) };
  const candidate = await new TravelIntelService(async () => [], web, () => now).getVisaRequirements(query);
  assert.equal(candidate.visaRequired, "VERIFICATION_REQUIRED");
  assert.notEqual(candidate.sourceType, "VERIFIED");
  assert.equal(candidate.checkedAt, null);
  assert.equal(candidate.evidence.status, "UNCONFIRMED");
  const failedWeb = { isConfigured: () => true, search: async () => { throw new Error("Private provider detail"); } };
  await assert.rejects(new TravelIntelService(async () => [], failedWeb, () => now).getVisaRequirements(query), (error: unknown) => error instanceof TravelIntelUnavailable && error.code === "PROVIDER_UNAVAILABLE" && !error.message.includes("Private"));
  await assert.rejects(new TravelIntelService(async () => { throw new Error("Private DB detail"); }, disabledWeb, () => now).getVisaRequirements(query), (error: unknown) => error instanceof TravelIntelUnavailable && error.code === "DATA_UNAVAILABLE");
  assert.equal(evidenceSourceUrl("https://example.test/rule?access_token=private"), null);
});
test("readiness never says READY while passport/transit/evidence need confirmation", async () => {
  const engine = new TravelReadinessEngine(service([row()]));
  const input: TravelReadinessInput = { nationality: "QA", destination: "TEST", passportValidityMonths: 12, travelPurpose: "tourism", travelDate: "2026-11-01" };
  const result = await engine.evaluateReadiness(input);
  assert.equal(result.status, "NEEDS_CONFIRMATION");
  assert.equal(result.checklist[0].evidence.status, "REPORTED");
  assert.equal(result.checklist[1].status, "VERIFIED");
  assert.equal((await engine.evaluateReadiness({ ...input, passportValidityMonths: 0 })).status, "BLOCKED");
  assert.equal((await engine.evaluateReadiness({ ...input, transitCountry: "OTHER" })).status, "UNKNOWN");
  assert.equal((await new TravelReadinessEngine(service([row({}, { visaRequired: true })])).evaluateReadiness(input)).status, "NEEDS_ATTENTION");
  const unknown = await new TravelReadinessEngine(service([])).evaluateReadiness(input);
  assert.equal(unknown.status, "UNKNOWN");
  assert.ok(unknown.checklist.some(item => item.id === "visa_requirement" && item.status === "UNKNOWN" && item.nextAction));
  const wire = { ...result, disclosure: "Scope QA only" };
  assert.equal(isReadinessResponse(wire), true);
  assert.equal(isReadinessResponse({ ...wire, status: "READY" }), false);
  assert.equal(isReadinessResponse({ ...wire, checklist: [{ title: "Partial result" }] }), false);
  assert.equal(isReadinessResponse({ ...wire, evaluatedAt: "bad" }), false);
});
test("strict readiness input rejects empty/null coercion and invalid dates instead of correcting them", () => {
  const valid = { nationality: "QA", destination: "TEST", passportValidityMonths: 12 };
  assert.equal(parseReadinessInput(valid)?.passportValidityMonths, 12);
  assert.equal(parseReadinessInput({ ...valid, passportValidityMonths: "12" })?.passportValidityMonths, 12);
  for (const months of [null,undefined,"",true,[],{},Infinity,-1,121,"12bad"]) assert.equal(parseReadinessInput({ ...valid, passportValidityMonths: months }), null);
  for (const input of [null,[],true,{ ...valid, nationality: "a".repeat(65) },{ ...valid, travelDate: "2026-02-30" }]) assert.equal(parseReadinessInput(input), null);
});


test("readiness context keeps purpose categories strict and never compares an incomplete budget", () => {
  const base = { nationality: "QA", destination: "TEST", passportValidityMonths: 12 };
  for (const purpose of ["tourism","study","work","business","freelance","umrah","visit","medical","transit","other"]) {
    assert.equal(parseReadinessInput({ ...base, travelPurpose: purpose })?.travelPurpose, purpose);
  }
  for (const purpose of ["remote-ish","employee","pilgrimage",true,17]) {
    assert.equal(parseReadinessInput({ ...base, travelPurpose: purpose }), null);
  }

  assert.equal(
    parseReadinessInput({ ...base, budgetAmount: 20000, budgetCurrency: "EGP" })?.budgetAmount,
    20000,
  );
  assert.equal(parseReadinessInput({ ...base, budgetAmount: 20000 }), null);
  assert.equal(parseReadinessInput({ ...base, budgetCurrency: "EGP" }), null);
  assert.equal(parseReadinessInput({ ...base, budgetAmount: 20000, budgetCurrency: "GBP" }), null);
  assert.equal(parseReadinessInput({ ...base, travelerCount: 0 }), null);
  assert.equal(parseReadinessInput({ ...base, travelerCount: 2 })?.travelerCount, 2);
});

test("wire contract accepts sourced advisor output but rejects invented or unsafe source links", () => {
  const engine = new TravelReadinessEngine(service([row()]));
  return engine.evaluateReadiness({
    nationality: "QA",
    destination: "TEST",
    passportValidityMonths: 12,
    travelPurpose: "tourism",
    travelDate: "2026-11-01",
  }).then((result) => {
    const advisor = {
      purpose: "tourism",
      purposeLabel: "سياحة",
      questionsToComplete: ["هل لديك حجز إقامة؟"],
      preparationTopics: ["الدخول والتأشيرة"],
      routeIntelligence: {
        status: "NOT_APPLICABLE",
        complexity: "UNKNOWN",
        complexityLabel: "لا يوجد ترانزيت مدخل",
        summary: "لم تُدخل دولة ترانزيت، لذلك لا يوجد تحليل لمسار الربط.",
        routeDescription: null,
        layoverMinutes: null,
        factors: [],
        limitations: [],
      },
      liveResearch: {
        status: "SOURCES_ONLY",
        answer: null,
        confidence: null,
        sources: [{ title: "Official QA", url: "https://official.example/travel", sourceType: "SOURCE_REPORTED" }],
        checkedAt: "2026-10-05T12:00:00.000Z",
        limitations: ["مصدر مرشح للمراجعة."],
      },
      offers: [],
      offerSearchStatus: "NO_MATCH",
      limitations: ["لا يوجد عرض مختلق."],
    };
    const wire = { ...result, disclosure: "QA", advisor };
    assert.equal(isReadinessResponse(wire), true);
    assert.equal(
      isReadinessResponse({
        ...wire,
        advisor: {
          ...advisor,
          liveResearch: {
            ...advisor.liveResearch,
            sources: [{ title: "bad", url: "javascript:alert(1)", sourceType: "SOURCE_REPORTED" }],
          },
        },
      }),
      false,
    );
  });
});


test("advisor answers are bounded context and NEEDS_INPUT has a strict wire contract", () => {
  const base = { nationality: "QA", destination: "TEST", passportValidityMonths: 12, travelPurpose: "tourism" };
  const parsed = parseReadinessInput({
    ...base,
    advisorAnswers: {
      tourism_accommodation: "مرنة",
      tourism_onward: "غير متأكد",
    },
  });
  assert.deepEqual(parsed?.advisorAnswers, {
    tourism_accommodation: "مرنة",
    tourism_onward: "غير متأكد",
  });
  assert.equal(parseReadinessInput({ ...base, advisorAnswers: { "bad key": "x" } }), null);
  assert.equal(parseReadinessInput({ ...base, advisorAnswers: { tourism_onward: "x".repeat(501) } }), null);

  assert.equal(isReadinessQuestionsResponse({
    phase: "NEEDS_INPUT",
    questions: [{ id: "tourism_onward", label: "هل لديك تذكرة عودة؟", why: "لتحديد سياق الدخول." }],
  }), true);
  assert.equal(isReadinessQuestionsResponse({
    phase: "NEEDS_INPUT",
    questions: [{
      id: "decision_transit_baggage",
      label: "ماذا سيحدث للأمتعة المسجلة؟",
      why: "لفهم مسار الربط.",
      kind: "choice",
      options: [
        { value: "through", label: "حتى الوجهة" },
        { value: "recheck", label: "استلام وإعادة شحن" },
      ],
    }],
  }), true);
  assert.equal(isReadinessQuestionsResponse({
    phase: "NEEDS_INPUT",
    questions: [{
      id: "decision_transit_baggage",
      label: "ماذا سيحدث للأمتعة المسجلة؟",
      why: "لفهم مسار الربط.",
      kind: "choice",
    }],
  }), false);
  assert.equal(isReadinessQuestionsResponse({
    phase: "NEEDS_INPUT",
    questions: [{ id: "bad key", label: "سؤال", why: "سبب" }],
  }), false);
});
