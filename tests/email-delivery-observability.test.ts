import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("email delivery is not claimed before signed provider confirmation", () => {
  const email = readFileSync("src/lib/providers/email.ts", "utf8");
  const webhook = readFileSync("src/app/api/webhooks/resend/route.ts", "utf8");
  const env = readFileSync(".env.example", "utf8");

  assert.match(email, /status:\s*"QUEUED"/);
  assert.doesNotMatch(email, /sent:\s*true,[\s\S]{0,120}status:\s*"DELIVERED"/);
  assert.match(webhook, /resend\.webhooks\.verify/);
  assert.match(webhook, /svix-signature/);
  assert.match(webhook, /email\.failed/);
  assert.match(webhook, /email\.bounced/);
  assert.match(env, /^RESEND_WEBHOOK_SECRET=/m);
});
