import assert from "node:assert/strict";
import { mock, test, type TestContext } from "node:test";
import { capabilityRuntime } from "../src/lib/capabilities/production";
import { CAPABILITY_CATALOG } from "../src/lib/capabilities/catalog";
import type { CapabilityId, CapabilityState, CapabilityStatus } from "../src/lib/capabilities/contracts";
import { passwordAuthReadiness } from "../src/lib/password-auth";
import { GET } from "../src/app/api/health/route";
import { POST as recordEvent } from "../src/app/api/events/route";
import { SITE_ORIGIN } from "../src/lib/site";

function setup(t: TestContext) {
  const vars = { AUTH_ORIGIN: SITE_ORIGIN, PASSWORD_AUTH_ENABLED: "true", MAGIC_LINK_ENABLED: "false", GOOGLE_AUTH_ENABLED: "false", FLIGHT_COMPARE_ENABLED: "false" };
  const before = Object.fromEntries(Object.keys(vars).map((key) => [key, process.env[key]])); Object.assign(process.env, vars);
  t.after(() => { for (const key of Object.keys(vars)) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; } mock.restoreAll(); });
  mock.method(passwordAuthReadiness, "probe", async () => true);
  mock.method(capabilityRuntime, "probe", async (id: CapabilityId): Promise<CapabilityState> => {
    const status: CapabilityStatus = id === "email" ? "DEGRADED" : id === "flights" ? "GATED" : "READY";
    return { ...CAPABILITY_CATALOG.find((item) => item.id === id)!, status, provider: "fixture", ready: status === "READY", checkedAt: null, latencyMs: 1, lastSuccessAt: null, failureCode: null, consecutiveFailures: 0, circuit: "closed", observationScope: "current_runtime" };
  });
}
test("public health excludes database identity and keeps optional mail from blocking password access", async (t) => {
  setup(t);
  const response = await GET(), body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.status, "HEALTHY"); assert.equal(body.auth.password, true);
  assert.equal(body.email.status, "UNAVAILABLE");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.doesNotMatch(JSON.stringify(body), /database_name|role_name|identity|neondb|branch_id|error.message/);
  process.env.MAGIC_LINK_ENABLED = "true";
  assert.equal((await GET()).status, 503);
});
test("clients cannot spoof internal capability observations", async () => {
  const response = await recordEvent(new Request(`${SITE_ORIGIN}/api/events`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "capability_observed", meta: "forged" }) }));
  assert.equal(response.status, 422);
});
test("an enabled but unavailable password schema fails health closed", async (t) => {
  setup(t);
  mock.method(passwordAuthReadiness, "probe", async () => false);
  const response = await GET(), body = await response.json();
  assert.equal(response.status, 503); assert.equal(body.ok, false); assert.equal(body.auth.password, false);
});
