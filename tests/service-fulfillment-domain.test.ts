import assert from "node:assert/strict";
import { test } from "node:test";
import { serviceEconomics, serviceId, serviceMinor, servicePilotWorkspaceIds, serviceTransition } from "../src/lib/service-fulfillment-domain";
import { readServiceBody, serviceOriginAllowed } from "../src/lib/service-request";

test("pilot configuration fails closed for malformed or out-of-range office IDs", () => {
  assert.deepEqual(servicePilotWorkspaceIds(""), []);
  assert.deepEqual(servicePilotWorkspaceIds(" 2,3,2 "), [2, 3]);
  for (const value of ["*", "2,", "2,wrong", "0", "-1", "1.5", "2147483648", "9007199254740992"]) assert.deepEqual(servicePilotWorkspaceIds(value), []);
});
test("service money and identifiers reject coercion and unsafe integers", () => {
  for (const value of [true, false, null, {}, [], "1e3", "1.2", "-1", Number.MAX_SAFE_INTEGER + 1]) assert.equal(serviceMinor(value), null);
  assert.equal(serviceMinor(15000), 15000);
  assert.equal(serviceMinor(0, true), null);
  assert.equal(serviceId("2147483648"), null);
});
test("SILA contribution uses its net fees and costs, including refunds", () => {
  const result = serviceEconomics(15000, 15000, 3000, 7500);
  assert.equal(result.netCollectedMinor, 12000);
  assert.equal(result.cashContributionMinor, 4500);
  assert.equal(result.moneyState, "partial");
  assert.equal(serviceEconomics(15000, 15000, 15000, 7500).moneyState, "refunded");
  assert.equal(serviceEconomics(15000, 0, 0, 7500).cashContributionMinor, -7500);
  assert.throws(() => serviceEconomics(15000, 15001, 0, 0));
  assert.throws(() => serviceEconomics(15000, 1000, 1001, 0));
});
test("delivery, acceptance and cancellation are different authorized work actions", () => {
  assert.equal(serviceTransition("deliver", "partner", "in_progress"), "delivered");
  assert.equal(serviceTransition("accept_delivery", "partner", "delivered"), null);
  assert.equal(serviceTransition("accept_delivery", "office", "in_progress"), null);
  assert.equal(serviceTransition("request_rework", "office", "delivered"), "rework");
  assert.equal(serviceTransition("cancel", "office", "completed"), null);
  assert.equal(serviceTransition("__proto__", "office", "offered"), null);
  assert.equal(serviceTransition("constructor", "partner", "offered"), null);
});
test("financial requests require JSON and reject cross-origin or oversized bodies", async () => {
  const request = (body: string, headers: Record<string, string>) => new Request("https://sila.test/action", { method: "POST", headers, body });
  assert.equal(await readServiceBody(request("{}", { "content-type": "text/plain" })), null);
  assert.equal(await readServiceBody(request("{}", { "content-type": "application/json", origin: "https://foreign.test" })), null);
  assert.equal(await readServiceBody(request(JSON.stringify({ scope: "أ".repeat(20_000) }), { "content-type": "application/json" })), null);
  assert.deepEqual(await readServiceBody(request("{}", { "content-type": "application/json", origin: "https://sila.test" })), {});
  assert.equal(await readServiceBody(request("{}", { "content-type": "application/json", "content-length": "99999999" })), null);
  assert.equal(await readServiceBody(new Request("https://sila.test/action", { method: "POST", headers: { "content-type": "application/json" }, body: new Uint8Array([0xff, 0xfe]) })), null);
});

test("explicit app origins support proxy normalization without trusting forwarded hosts", () => {
  const same = new Request("http://internal.local/action", { headers: { origin: "https://sila.test", "x-forwarded-host": "foreign.test" } });
  assert.equal(serviceOriginAllowed(same, ["https://sila.test"]), true);
  assert.equal(serviceOriginAllowed(same, ["bad", "javascript:alert(1)"]), false);
  const foreign = new Request("https://sila.test/action", { headers: { origin: "https://foreign.test", "x-forwarded-host": "foreign.test" } });
  assert.equal(serviceOriginAllowed(foreign, ["https://sila.test"]), false);
});
