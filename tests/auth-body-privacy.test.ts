import assert from "node:assert/strict";
import { test } from "node:test";
import { readAuthBody } from "../src/lib/auth-request";
import { publicTelemetryEvent } from "../src/lib/public-telemetry";
import { consumeRecoveryLink, readRecoveryLink } from "../src/lib/recovery-link";

test("streamed auth JSON cannot bypass the byte limit or object shape", async () => {
  for (const body of ["null", "[]", "42", '"value"', "{"]) {
    await assert.rejects(() => readAuthBody(new Request("https://example.test", { method: "POST", headers: { "Content-Type": "application/json" }, body })));
  }
  const chunks = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('{"padding":"')); c.enqueue(new TextEncoder().encode("x".repeat(5000))); c.close(); } });
  const streamed = new Request("https://example.test", { method: "POST", headers: { "Content-Type": "application/json" }, body: chunks, duplex: "half" } as RequestInit);
  assert.equal(streamed.headers.has("content-length"), false);
  await assert.rejects(() => readAuthBody(streamed), RangeError);
  assert.deepEqual(await readAuthBody(new Request("https://example.test", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: '{"email":"test@example.invalid"}' })), { email: "test@example.invalid" });
});

test("analytics and speed events exclude private URLs and strip public query/fragment data", () => {
  for (const path of ["/join", "/account/security", "/admin/tools", "/reset-password?token=private", "/verify-email#token=private", "/api/auth/me", "/%61ccount/travel", "/q/private-bearer", "/s/private-bearer", "/review?offer=1", "/readiness?email=private@example.invalid", "/?token=private"]) {
    for (const type of ["pageview", "vital"]) assert.equal(publicTelemetryEvent({ type, url: `https://example.test${path}` }), null);
  }
  const event = { type: "pageview", url: "https://example.test/readiness?destination=private#draft" };
  assert.deepEqual(publicTelemetryEvent(event), { type: "pageview", url: "https://example.test/readiness" });
  assert.equal(event.url.includes("private"), true, "must not mutate SDK input");
  for (const url of ["invalid", "https://secret@example.test/", "javascript:alert(1)"]) assert.equal(publicTelemetryEvent({ url }), null);
});

test("fragment and legacy recovery links are usable once captured, and leave no bearer in history", () => {
  const token = "a".repeat(43);
  for (const suffix of [`#token=${token}`, `?token=${token}`]) {
    const state = { next: "preserved" };
    const calls: unknown[][] = [];
    const history = { state, replaceState: (...args: unknown[]) => { calls.push(args); } };
    assert.equal(consumeRecoveryLink({ href: `https://example.test/reset-password${suffix}`, pathname: "/reset-password" }, history), token);
    assert.deepEqual(calls, [[state, "", "/reset-password"]]);
  }
  assert.equal(readRecoveryLink("https://example.test/verify-email#token=short"), "");
  assert.equal(readRecoveryLink("https://example.test/reset-password"), "");
});
