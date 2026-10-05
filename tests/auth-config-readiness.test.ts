import assert from "node:assert/strict";
import { mock, test, type TestContext } from "node:test";
import { GET } from "../src/app/api/auth/config/route";
import { POST as requestMagicLink } from "../src/app/api/auth/magic/request/route";
import { emailProvider, type EmailProbeResult } from "../src/lib/providers/email";
import { SITE_ORIGIN } from "../src/lib/site";

function setup(t: TestContext, status: EmailProbeResult["status"]) {
  const config: Record<string, string> = {
    NODE_ENV: "production",
    AUTH_ORIGIN: SITE_ORIGIN,
    GOOGLE_AUTH_ENABLED: "true",
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "true",
    GOOGLE_CLIENT_ID: "synthetic-client",
    GOOGLE_CLIENT_SECRET: "synthetic-secret",
    MAGIC_LINK_ENABLED: "true",
    NEXT_PUBLIC_MAGIC_LINK_ENABLED: "true",
    RESEND_API_KEY: "re_synthetic_test_key",
    LEGACY_PASSWORD_LOGIN_ENABLED: "false",
  };
  const before = Object.fromEntries(Object.keys(config).map((key) => [key, process.env[key]]));
  Object.assign(process.env, config);
  t.after(() => {
    for (const key of Object.keys(config)) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
    mock.restoreAll();
  });
  return mock.method(emailProvider, "probe", async (): Promise<EmailProbeResult> => ({ status, latencyMs: null }));
}

test("a key and rollout flags cannot expose magic login before sender readiness", async (t) => {
  setup(t, "CONFIGURATION_REQUIRED");
  const response = await GET(new Request(`${SITE_ORIGIN}/api/auth/config`));
  assert.deepEqual(await response.json(), { google: true, magic: false, legacyPassword: false });
  assert.match(response.headers.get("cache-control")!, /no-store/);
});

test("verified sender readiness exposes magic login only with both rollout flags", async (t) => {
  const probe = setup(t, "CONNECTED");
  assert.equal((await (await GET(new Request(`${SITE_ORIGIN}/api/auth/config`))).json()).magic, true);
  process.env.NEXT_PUBLIC_MAGIC_LINK_ENABLED = "false";
  assert.equal((await (await GET(new Request(`${SITE_ORIGIN}/api/auth/config`))).json()).magic, false);
  assert.equal(probe.mock.callCount(), 1);
});

test("off-origin deployments cannot expose providers or create auth challenges", async (t) => {
  const probe = setup(t, "CONNECTED");
  const response = await GET(new Request("https://unrelated.example.test/api/auth/config"));
  assert.deepEqual(await response.json(), { google: false, magic: false, legacyPassword: false });
  const refused = await requestMagicLink(new Request("https://unrelated.example.test/api/auth/magic/request", { method: "POST" }));
  assert.equal(refused.status, 503);
  assert.equal(probe.mock.callCount(), 0);
});

test("an unready sender is refused before any account lookup or token creation", async (t) => {
  setup(t, "CONFIGURATION_REQUIRED");
  const response = await requestMagicLink(new Request(`${SITE_ORIGIN}/api/auth/magic/request`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.91" },
    body: JSON.stringify({ email: "agent@example.invalid", role: "agent", intent: "signup" }),
  }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "خدمة البريد غير جاهزة لإرسال رابط الدخول الآن." });
});
