import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  evaluatePublicAgentTrust,
  toPublicAgent,
  type PublicAgentEvidence,
} from "../src/lib/public-agent";

const now = new Date("2026-10-05T12:00:00.000Z");
const verifiedAgent = {
  id: 7,
  displayName: "Verified Agency",
  latinName: "Verified Agency",
  bio: "A sufficiently descriptive public agency profile.",
  photoUrl: "https://example.invalid/photo.jpg",
  city: "Cairo",
  country: "Egypt",
  licenseType: "agency",
  licenseNumber: "SECRET-LICENSE-123",
  verificationStatus: "verified",
  verifiedAt: new Date("2026-10-01T12:00:00.000Z"),
  specialtyTags: ["packages"],
  languages: ["ar", "en"],
  responseRate: 90,
  avgResponseHours: 3,
  totalTrips: 10,
  joinedAt: new Date("2026-01-01T00:00:00.000Z"),
} as const;

function evidence(
  documentType: string,
  options: { expired?: boolean; verifiedAt?: Date | null } = {},
): PublicAgentEvidence {
  return {
    agentId: verifiedAgent.id,
    documentType,
    status: "verified",
    verifiedAt:
      options.verifiedAt === undefined
        ? new Date("2026-10-02T10:00:00.000Z")
        : options.verifiedAt,
    expiresAt: options.expired
      ? new Date("2026-10-04T00:00:00.000Z")
      : new Date("2027-10-04T00:00:00.000Z"),
  };
}

const completeEvidence = [
  evidence("identity"),
  evidence("license"),
  evidence("commercial_register"),
];

test("license number alone cannot create a public trust claim", () => {
  const evaluated = evaluatePublicAgentTrust(
    { ...verifiedAgent } as any,
    [],
    now,
  );
  assert.equal(evaluated.eligible, false);
  assert.equal(evaluated.trust, null);
  assert.throws(
    () => toPublicAgent({ ...verifiedAgent } as any, [], now),
    /current scoped trust evidence/i,
  );
});

test("public agent projection exposes scoped evidence without KYC/license identifiers", () => {
  const projected = toPublicAgent(
    { ...verifiedAgent } as any,
    completeEvidence,
    now,
  );

  assert.equal(projected.verificationStatus, "verified");
  assert.deepEqual(
    projected.trust.claims.map((claim) => claim.kind),
    ["identity", "activity", "entity"],
  );
  assert.equal(projected.trust.status, "reviewed");
  assert.equal("licenseNumber" in projected, false);
  assert.equal("verifiedAt" in projected, false);
  assert.equal(JSON.stringify(projected).includes("SECRET-LICENSE-123"), false);
});

test("expired or unreviewed required evidence fails public eligibility closed", () => {
  const expired = [
    evidence("identity"),
    evidence("license", { expired: true }),
    evidence("commercial_register"),
  ];
  assert.equal(
    evaluatePublicAgentTrust({ ...verifiedAgent } as any, expired, now).eligible,
    false,
  );

  const noReviewTimestamp = [
    evidence("identity"),
    evidence("license", { verifiedAt: null }),
    evidence("commercial_register"),
  ];
  assert.equal(
    evaluatePublicAgentTrust(
      { ...verifiedAgent } as any,
      noReviewTimestamp,
      now,
    ).eligible,
    false,
  );
});

test("public projection fails closed for non-verified agents", () => {
  assert.throws(
    () =>
      toPublicAgent(
        { ...verifiedAgent, verificationStatus: "suspended" } as any,
        completeEvidence,
        now,
      ),
    /current scoped trust evidence/i,
  );
});

test("future review dates and invalid evidence dates cannot establish current trust", () => {
  for (const invalid of [
    { ...evidence("license"), verifiedAt: new Date("2026-10-06T12:00:00Z") },
    { ...evidence("license"), expiresAt: new Date("invalid") },
    { ...evidence("license"), expiresAt: now },
  ]) {
    assert.equal(
      evaluatePublicAgentTrust(
        { ...verifiedAgent } as any,
        [evidence("identity"), invalid, evidence("commercial_register")],
        now,
      ).eligible,
      false,
    );
  }
  assert.equal(
    evaluatePublicAgentTrust({ ...verifiedAgent } as any, completeEvidence, new Date("invalid")).eligible,
    false,
  );
});

test("an unrecorded expiry is exposed as unknown rather than invented", () => {
  const documents = completeEvidence.map(item => ({ ...item, expiresAt: null }));
  const projected = toPublicAgent({ ...verifiedAgent } as any, documents, now);
  assert.equal(projected.trust.validUntil, null);
  assert.equal(projected.trust.claims.every(claim => claim.validUntil === null), true);
});

test("public offer APIs require current verification and scoped evidence", () => {
  const list = readFileSync("src/app/api/offers/route.ts", "utf8");
  const detail = readFileSync("src/app/api/offers/[id]/route.ts", "utf8");
  assert.match(list, /agents\.verificationStatus, "verified"/);
  assert.match(list, /loadPublicAgentEvidence/);
  assert.match(list, /hasCurrentPublicAgentTrust/);
  assert.match(list, /offers\.expiresAt/);
  assert.match(detail, /agent\.verificationStatus !== "verified"/);
  assert.match(detail, /loadPublicAgentEvidence/);
  assert.match(detail, /hasCurrentPublicAgentTrust/);
  assert.match(detail, /expired/);
});

test("health endpoint never returns raw database exception messages", () => {
  const source = readFileSync("src/app/api/health/route.ts", "utf8");
  assert.doesNotMatch(source, /error:\s*errorMsg/);
  assert.match(source, /HEALTH_CHECK_FAILED/);
});
