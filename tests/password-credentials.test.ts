import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPilotPassword, passwordPolicyError, pilotPasswordHash, verifyPilotPassword } from "../src/lib/password-credentials";

test("pilot passwords support passphrases and reject short, oversized and common values", () => {
  for (const value of [null, 42, "short", "a".repeat(129), " ".repeat(20), "passwordpassword", "1234567890123456"]) {
    assert.ok(passwordPolicyError(value));
  }
  assert.equal(passwordPolicyError("رحلتي جميلة مع صلة وأصدقائي"), null);
  assert.equal(passwordPolicyError("A memorable travel phrase 2026"), null);
});

test("pilot hashes use independent random salts and preserve every password character", async () => {
  const password = "  رحلة مع صلة وأصدقائي 2026  ";
  const first = await hashPilotPassword(password);
  const second = await hashPilotPassword(password);
  assert.notEqual(first, second);
  assert.equal(pilotPasswordHash(first), true);
  assert.match(first, /^scrypt-pilot-v1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.equal(await verifyPilotPassword(password, first), true);
  assert.equal(await verifyPilotPassword(password.trim(), first), false);
  assert.equal(await verifyPilotPassword("wrong password phrase", first), false);
});

test("pilot login rejects OAuth-only, legacy and corrupt hashes without throwing", async () => {
  for (const stored of [null, "disabled$anything", "a".repeat(32) + ":" + "b".repeat(128), "scrypt-pilot-v1$bad"]) {
    assert.equal(await verifyPilotPassword("a safe long password", stored), false);
  }
});
