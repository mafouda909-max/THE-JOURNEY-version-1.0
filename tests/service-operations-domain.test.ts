import assert from "node:assert/strict";
import { test } from "node:test";
import { exactServiceMoney, serviceRate } from "../src/lib/service-operations-domain";

test("unobserved rates remain unknown and invalid denominators are rejected", () => {
  assert.equal(serviceRate(0, 0), null);
  assert.equal(serviceRate(9, 10), 0.9);
  assert.throws(() => serviceRate(2, 1));
  assert.throws(() => serviceRate(0, -1));
});
test("recorded cash stays exact above safe integer precision and through negative fractions", () => {
  assert.equal(exactServiceMoney("9007199254740993", "EGP"), "90,071,992,547,409.93 EGP");
  assert.equal(exactServiceMoney("-1", "EGP"), "-0.01 EGP");
  assert.equal(exactServiceMoney("4500", "USD"), "45.00 USD");
  assert.throws(() => exactServiceMoney("1.5", "EGP"));
});
