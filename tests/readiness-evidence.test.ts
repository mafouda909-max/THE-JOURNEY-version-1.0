import assert from "node:assert/strict";
import { test } from "node:test";
import type { TravelKnowledge } from "../src/db/schema";
import { TravelIntelService, TravelIntelUnavailable } from "../src/lib/travel-intel";
import { TravelReadinessEngine } from "../src/lib/travel-readiness";
import { isReadinessResponse, parseReadinessInput } from "../src/lib/readiness-contract";
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
  const input = { nationality: "QA", destination: "TEST", passportValidityMonths: 12, travelPurpose: "tourism", travelDate: "2026-11-01" };
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
