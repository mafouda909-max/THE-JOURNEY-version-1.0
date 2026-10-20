import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentTrust } from "../src/api/types";
import { agentEvidence, offerAvailability } from "../src/lib/decision";

const now = Date.parse("2026-10-08T12:00:00Z");
const evidence: AgentTrust = {
  status: "reviewed",
  reviewedAt: "2026-10-07T09:00:00Z",
  validUntil: "2026-11-08",
  limitations: ["لا يضمن إنجاز الرحلة"],
  claims: [
    { kind: "identity", label: "مراجعة الهوية", scope: "صاحب الحساب فقط", verifiedAt: "2026-10-07T09:00:00Z", validUntil: "2026-10-08" },
    { kind: "activity", label: "مراجعة النشاط", scope: "مجال العمل", verifiedAt: "2026-09-01T09:00:00Z", validUntil: "2026-09-30" },
  ],
};

describe("mobile evidence policy", () => {
  it("does not imply verification when trust evidence is absent", () => {
    assert.equal(agentEvidence(undefined, now).tone, "neutral");
    assert.equal(agentEvidence(undefined, now).claims.length, 0);
  });

  it("only presents current claims with their explicit scope", () => {
    const result = agentEvidence(evidence, now);
    assert.equal(result.tone, "verified");
    assert.deepEqual(result.claims.map((claim) => claim.kind), ["identity"]);
    assert.equal(result.claims[0]?.scope, "صاحب الحساب فقط");
    assert.deepEqual(result.limitations, ["لا يضمن إنجاز الرحلة"]);
  });

  it("treats a date-only validUntil as valid through the end of the day", () => {
    assert.equal(agentEvidence(evidence, Date.parse("2026-10-08T23:59:59Z")).claims.length, 1);
    assert.equal(agentEvidence(evidence, Date.parse("2026-10-09T00:00:00Z")).claims.length, 0);
  });

  it("never marks expired or future-dated reviews as current", () => {
    assert.equal(agentEvidence({ ...evidence, validUntil: "2026-10-07" }, now).tone, "warn");
    assert.equal(agentEvidence({ ...evidence, reviewedAt: "2028-01-01" }, now).tone, "warn");
    assert.equal(agentEvidence({ ...evidence, validUntil: "broken-date" }, now).claims.length, 0);
  });

  it("keeps published no-expiry offers distinct from offers with confirmed expiry", () => {
    assert.equal(offerAvailability({ status: "published", expiresAt: null }, now).canRequest, true);
    assert.match(offerAvailability({ status: "published", expiresAt: null }, now).label, /غير متاح/);
  });

  it("does not invite a request for unpublished, expired, or malformed-expiry offers", () => {
    assert.equal(offerAvailability({ status: "draft", expiresAt: null }, now).canRequest, false);
    assert.equal(offerAvailability({ status: "published", expiresAt: "2026-10-07" }, now).canRequest, false);
    assert.equal(offerAvailability({ status: "published", expiresAt: "bad" }, now).canRequest, false);
    assert.equal(offerAvailability({ status: "published", expiresAt: "2026-10-08" }, now).canRequest, true);
  });
});
