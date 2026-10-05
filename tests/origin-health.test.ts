import assert from "node:assert/strict";
import test from "node:test";
import { evaluateOriginHealth } from "../src/lib/origin-health";

test("origin health is healthy when auth and site origins align", () => {
  assert.deepEqual(
    evaluateOriginHealth(
      "https://the-journey-version-1-0.vercel.app",
      "https://the-journey-version-1-0.vercel.app/path",
    ),
    {
      site: "https://the-journey-version-1-0.vercel.app",
      auth: "https://the-journey-version-1-0.vercel.app",
      aligned: true,
      status: "HEALTHY",
    },
  );
});

test("origin health is explicit when auth origin is absent or mismatched", () => {
  assert.deepEqual(
    evaluateOriginHealth("https://example.com", undefined),
    {
      site: "https://example.com",
      auth: null,
      aligned: null,
      status: "NOT_CONFIGURED",
    },
  );

  const mismatch = evaluateOriginHealth("https://example.com", "https://auth.example.com");
  assert.equal(mismatch.aligned, false);
  assert.equal(mismatch.status, "DEGRADED");
});

test("origin health rejects unsafe protocols", () => {
  const result = evaluateOriginHealth("https://example.com", "ftp://example.com");
  assert.equal(result.auth, null);
  assert.equal(result.status, "NOT_CONFIGURED");
});
