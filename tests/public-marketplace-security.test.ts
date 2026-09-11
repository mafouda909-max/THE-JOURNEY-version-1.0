import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { toPublicAgent } from "../src/lib/public-agent";

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
  verifiedAt: new Date(),
  specialtyTags: ["packages"],
  languages: ["ar", "en"],
  responseRate: 90,
  avgResponseHours: 3,
  totalTrips: 10,
  joinedAt: new Date(),
} as const;

test("public agent projection exposes trust state without KYC/license identifiers", () => {
  const projected = toPublicAgent({ ...verifiedAgent } as any);
  assert.equal(projected.hasLicense, true);
  assert.equal(projected.verificationStatus, "verified");
  assert.equal("licenseNumber" in projected, false);
  assert.equal("verifiedAt" in projected, false);
});

test("public projection fails closed for non-verified agents", () => {
  assert.throws(
    () => toPublicAgent({ ...verifiedAgent, verificationStatus: "suspended" } as any),
    /unverified agent/i,
  );
});

test("public offer APIs require current verification and do not return raw agent rows", () => {
  const list = readFileSync("src/app/api/offers/route.ts", "utf8");
  const detail = readFileSync("src/app/api/offers/[id]/route.ts", "utf8");
  assert.match(list, /agents\.verificationStatus, "verified"/);
  assert.match(list, /toPublicAgent\(r\.agent\)/);
  assert.match(list, /offers\.expiresAt/);
  assert.match(detail, /agent\.verificationStatus !== "verified"/);
  assert.match(detail, /toPublicAgent\(agent\)/);
  assert.match(detail, /expired/);
});

test("health endpoint never returns raw database exception messages", () => {
  const source = readFileSync("src/app/api/health/route.ts", "utf8");
  assert.doesNotMatch(source, /error:\s*errorMsg/);
  assert.match(source, /Database health check failed/);
});
