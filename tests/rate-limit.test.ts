import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryRateLimiter } from "../src/lib/rate-limit";

function make() {
  return new MemoryRateLimiter();
}

test("allows requests up to the limit then blocks", () => {
  const rl = make();
  const key = "ip:1";
  for (let i = 1; i <= 3; i++) {
    const r = rl.checkRateLimit(key, 3, 60);
    assert.equal(r.allowed, true, `request ${i} should be allowed`);
    assert.equal(r.currentRequests, i);
  }
  const blocked = rl.checkRateLimit(key, 3, 60);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.currentRequests, 3);
});

test("separate keys do not share buckets", () => {
  const rl = make();
  for (let i = 0; i < 5; i++) rl.checkRateLimit("a", 3, 60);
  assert.equal(rl.checkRateLimit("b", 3, 60).allowed, true);
  assert.equal(rl.checkRateLimit("a", 3, 60).allowed, false);
});

test("returns reset seconds within the window", () => {
  const rl = make();
  const r = rl.checkRateLimit("k", 3, 60);
  assert.ok(r.resetSeconds > 0 && r.resetSeconds <= 60);
});
