import assert from "node:assert/strict";
import { test } from "node:test";
import { CAPABILITY_CATALOG } from "../src/lib/capabilities/catalog";
import { CapabilityRuntime } from "../src/lib/capabilities/runtime";
import { CapabilityError, type CapabilityDefinition, type CapabilityObservation } from "../src/lib/capabilities/contracts";

function catalog(overrides: Partial<CapabilityDefinition> = {}) {
  return [{ ...CAPABILITY_CATALOG.find((spec) => spec.id === "web")!, ...overrides }];
}

test("configuration alone never proves readiness; concurrent probes coalesce and obey gates", async () => {
  let configured = true, enabled = true, calls = 0;
  const runtime = new CapabilityRuntime(catalog());
  runtime.register("web", { provider: "fixture", configured: () => configured, enabled: () => enabled, async probe() { calls++; await new Promise((resolve) => setTimeout(resolve, 5)); return { status: "READY" }; } });
  const results = await Promise.all(Array.from({ length: 20 }, () => runtime.probe("web")));
  assert.equal(calls, 1);
  assert.ok(results.every((state) => state.ready && state.lastSuccessAt && state.provider === "fixture"));
  await runtime.probe("web");
  assert.equal(calls, 1);
  enabled = false;
  assert.equal((await runtime.probe("web", true)).status, "GATED");
  assert.equal((await runtime.probe("web", true)).failureCode, "GATED");
  enabled = true; configured = false;
  assert.equal((await runtime.probe("web")).ready, false);
  assert.equal(calls, 1);
});

test("planned capabilities cannot be registered or invoked, regardless of credentials", async () => {
  const runtime = new CapabilityRuntime(CAPABILITY_CATALOG);
  assert.throws(() => runtime.register("payments", { provider: "fixture", configured: () => true, async probe() { return { status: "READY" }; } }));
  assert.equal((await runtime.probe("payments")).status, "PLANNED");
  let touched = false;
  await assert.rejects(() => runtime.call("payments", "admin", async () => { touched = true; }), (error: unknown) => error instanceof CapabilityError && error.code === "PLANNED");
  assert.equal(touched, false);
});

test("timeouts abort probes, open the circuit, retain a real last success and recover after cooldown", async () => {
  let time = 1000, hang = false, calls = 0, aborted = 0;
  const observations: CapabilityObservation[] = [];
  const spec = catalog()[0];
  const runtime = new CapabilityRuntime(catalog({ policy: { ...spec.policy, probeTimeoutMs: 10 } }), (event) => observations.push(event), () => time);
  runtime.register("web", { provider: "fixture", configured: () => true, async probe(signal) { calls++; if (!hang) return { status: "READY" }; signal.addEventListener("abort", () => aborted++); return new Promise(() => {}); } });
  const success = await runtime.probe("web");
  hang = true;
  for (let i = 0; i < 3; i++) { time++; assert.equal((await runtime.probe("web", true)).failureCode, "TIMEOUT"); }
  const blocked = await runtime.probe("web", true);
  assert.equal(blocked.circuit, "open"); assert.equal(blocked.failureCode, "CIRCUIT_OPEN"); assert.equal(blocked.ready, false);
  assert.equal(blocked.lastSuccessAt, success.lastSuccessAt);
  assert.equal(aborted, 3); assert.equal(calls, 4);
  time += 31000; hang = false;
  const recovered = await runtime.probe("web", true);
  assert.equal(recovered.status, "READY"); assert.equal(recovered.circuit, "closed"); assert.equal(recovered.consecutiveFailures, 0);
  assert.ok(observations.every((item) => ["success", "failure"].includes(item.outcome)));
});

test("a corrected sender can be re-probed after NOT_CONFIGURED; cached failure is not a permanent gate", async () => {
  let ready = false;
  const runtime = new CapabilityRuntime(catalog());
  runtime.register("web", { provider: "fixture", configured: () => true, async probe() { return { status: ready ? "READY" : "NOT_CONFIGURED" }; } });
  assert.equal((await runtime.probe("web")).ready, false);
  ready = true;
  assert.equal((await runtime.probe("web", true)).ready, true);
});

test("writes never retry, actors fail closed and raw exceptions never become observability data", async () => {
  const observations: CapabilityObservation[] = [];
  const spec = catalog()[0];
  const runtime = new CapabilityRuntime(catalog({ readOnly: false, actors: ["system"], policy: { ...spec.policy, retries: 1 } }), (event) => observations.push(event));
  runtime.register("web", { provider: "fixture", configured: () => true, async probe() { return { status: "READY" }; } });
  let calls = 0;
  await assert.rejects(() => runtime.call("web", "agent", async () => { calls++; }), (e: unknown) => e instanceof CapabilityError && e.code === "FORBIDDEN");
  await assert.rejects(() => runtime.call("web", "system", async () => { calls++; throw new Error("private@example.invalid prompt bearer provider-body"); }), (e: unknown) => e instanceof CapabilityError && e.message === "PROVIDER_UNAVAILABLE");
  assert.equal(calls, 1);
  assert.doesNotMatch(JSON.stringify(observations), /private|prompt|bearer|provider-body/);
  assert.equal(observations.length, 1);
});

test("only configured safe reads can opt into one bounded retry; broken instrumentation cannot break them", async () => {
  const spec = catalog()[0];
  const runtime = new CapabilityRuntime(catalog({ policy: { ...spec.policy, retries: 1 } }), () => { throw new Error("observer unavailable"); });
  runtime.register("web", { provider: "fixture", configured: () => true, async probe() { return { status: "READY" }; } });
  let calls = 0;
  assert.equal(await runtime.call("web", "system", async () => { if (++calls === 1) throw new Error("transient"); return 42; }), 42);
  assert.equal(calls, 2);
});
test("fallback remains observable without promoting provider readiness or retaining input", async () => {
  const observations: CapabilityObservation[] = [];
  const runtime = new CapabilityRuntime(catalog(), (event) => observations.push(event));
  runtime.register("web", { provider: "fixture", configured: () => false, async probe() { throw new Error("must not call"); } });
  await assert.rejects(() => runtime.call("web", "system", async () => "private-input"));
  runtime.recordFallback("web");
  assert.equal((await runtime.probe("web")).ready, false);
  assert.equal(observations.length, 1); assert.equal(observations[0].outcome, "fallback");
  assert.equal(observations[0].code, "NOT_CONFIGURED"); assert.doesNotMatch(JSON.stringify(observations), /private-input/);
});
