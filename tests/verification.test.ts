import { test } from "node:test";
import assert from "node:assert/strict";
import {
  verificationHash,
  matchesVerification,
  newVerificationCode,
} from "../src/lib/verification-secret";
import { POST } from "../src/app/api/verification/route";
test("verification codes are hashed and bound to one challenge", () => {
  const code = newVerificationCode();
  assert.match(code, /^\d{6}$/);
  const hash = verificationHash("challenge-a", code);
  assert.equal(hash.length, 64);
  assert.notEqual(hash, code);
  assert.equal(matchesVerification("challenge-a", code, hash), true);
  assert.equal(matchesVerification("challenge-b", code, hash), false);
  assert.equal(matchesVerification("challenge-a", "000000", hash), false);
  assert.equal(matchesVerification("challenge-a", code, "malformed"), false);
});
test("verification refuses unauthenticated users before provider or database access", async () => {
  assert.equal(
    (
      await POST(
        new Request("https://example.test/api/verification", {
          method: "POST",
          body: "{}",
        }),
      )
    ).status,
    401,
  );
});
