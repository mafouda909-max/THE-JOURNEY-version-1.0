import assert from "node:assert/strict";
import { mock, test, type TestContext } from "node:test";
import { POST as requestReset } from "../src/app/api/auth/recovery/request/route";
import { recoveryDispatch } from "../src/lib/recovery-dispatch";
import { POST as reset } from "../src/app/api/auth/recovery/reset/route";
import { POST as confirm } from "../src/app/api/auth/email-verification/confirm/route";
import { passwordAuthReadiness } from "../src/lib/password-auth";
import { passwordBudget } from "../src/lib/password-budget";
import { emailProvider, type EmailProbeResult } from "../src/lib/providers/email";
import { SITE_ORIGIN } from "../src/lib/site";

function setup(t: TestContext) {
  const previous = process.env.AUTH_ORIGIN;
  process.env.AUTH_ORIGIN = SITE_ORIGIN;
  t.after(() => { if (previous === undefined) delete process.env.AUTH_ORIGIN; else process.env.AUTH_ORIGIN = previous; mock.restoreAll(); });
  mock.method(passwordAuthReadiness, "probe", async () => true);
  mock.method(emailProvider, "isConfigured", () => true);
  mock.method(emailProvider, "probe", async (): Promise<EmailProbeResult> => ({ status: "CONNECTED", latencyMs: 1 }));
}
let ip = 1;
function request(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${SITE_ORIGIN}/api/auth/${path}`, { method: "POST", headers: { origin: SITE_ORIGIN, "content-type": "application/json", "x-forwarded-for": `127.3.0.${ip++}`, ...headers }, body: JSON.stringify(body) });
}

test("recovery acknowledges before any account lookup or delivery, for every valid identity", async (t) => {
  setup(t);
  const budgets = mock.method(passwordBudget, "consume", async () => ({ allowed: true, retry: 0 }));
  const scheduled: Array<() => Promise<void>> = [];
  mock.method(recoveryDispatch, "schedule", (task: () => Promise<void>) => { scheduled.push(task); });
  const responses = await Promise.all(["present@example.invalid", "absent@example.invalid", "admin@example.invalid"].map((email) => requestReset(request("recovery/request", { email }))));
  const bodies = await Promise.all(responses.map((response) => response.json()));
  assert.ok(responses.every((response) => response.status === 202 && response.headers.get("cache-control") === "private, no-store" && !response.headers.has("set-cookie")));
  assert.deepEqual(bodies[0], bodies[1]);
  assert.deepEqual(bodies[0], bodies[2]);
  assert.equal(scheduled.length, 3, "work is queued, never awaited in the public response");
  assert.equal(budgets.mock.callCount(), 3);
});

test("mail unavailable and exhausted distributed budget never enqueue recovery", async (t) => {
  setup(t);
  const queued = mock.method(recoveryDispatch, "schedule", () => {});
  const mail = mock.method(emailProvider, "probe", async (): Promise<EmailProbeResult> => ({ status: "NOT_CONFIGURED", latencyMs: null }));
  assert.equal((await requestReset(request("recovery/request", { email: "unit@example.invalid" }))).status, 503);
  mail.mock.restore();
  mock.method(passwordBudget, "consume", async () => ({ allowed: false, retry: 180 }));
  const limited = await requestReset(request("recovery/request", { email: "unit@example.invalid" }));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "180");
  assert.equal(queued.mock.callCount(), 0);
});

test("reset, recovery and confirmation reject malformed shapes and oversize streams", async (t) => {
  setup(t);
  const budget = mock.method(passwordBudget, "consume", async () => { throw new Error("must not query budget"); });
  for (const [path, handler] of [["recovery/request", requestReset], ["recovery/reset", reset], ["email-verification/confirm", confirm]] as const) {
    for (const body of [null, [], 42]) assert.equal((await handler(request(path, body))).status, 400);
    assert.equal((await handler(request(path, { padding: "x".repeat(5000) }))).status, 413);
    assert.equal((await handler(request(path, {}, { origin: "https://foreign.example.test" }))).status, 403);
  }
  assert.equal(budget.mock.callCount(), 0);
});
