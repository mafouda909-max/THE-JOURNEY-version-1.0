import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

test("agent activation telemetry is first-party and PII-free", () => {
  const data = read("src/lib/data.ts");
  const eventRoute = read("src/app/api/events/route.ts");
  const join = read("src/app/join/page.tsx");
  const magicRequest = read("src/app/api/auth/magic/request/route.ts");
  const magicConsume = read("src/app/api/auth/magic/consume/route.ts");
  const googleStart = read("src/app/api/auth/google/start/route.ts");
  const googleCallback = read("src/app/api/auth/google/callback/route.ts");

  for (const name of [
    "agent_signup_intent",
    "agent_signup_blocked",
    "agent_auth_started",
    "agent_identity_provisioned",
  ]) {
    assert.match(data, new RegExp(name));
  }

  assert.match(eventRoute, /agent_signup_intent/);
  assert.match(eventRoute, /agent_signup_blocked/);
  assert.match(join, /AnalyticsBeacon name="agent_signup_intent"/);
  assert.match(join, /AnalyticsBeacon name="agent_signup_blocked"/);

  assert.match(magicRequest, /provider: "magic"/);
  assert.match(magicConsume, /provider: "magic"/);
  assert.match(googleStart, /provider: "google"/);
  assert.match(googleCallback, /provider: "google"/);

  for (const source of [magicRequest, magicConsume, googleStart, googleCallback]) {
    const telemetryCalls = source
      .split("\n")
      .filter((line) => line.includes("trackEvent") || line.includes("provider:"));
    assert.equal(
      telemetryCalls.some((line) => /email|name|city|subject|token/i.test(line)),
      false,
      "activation telemetry must not add user identifiers",
    );
  }
});

test("admin activation funnel exposes blocker and completion metrics", () => {
  const admin = read("src/components/market/AdminQueue.tsx");
  assert.match(admin, /تفعيل الوكلاء/);
  assert.match(admin, /agentActivation\.activationRatePct/);
  assert.match(admin, /agentActivation\.blocked/);
});
