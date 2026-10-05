import assert from "node:assert/strict";
import { mock, test, type TestContext } from "node:test";
import { passwordAuthPost, passwordAuthReadiness } from "../src/lib/password-auth";
import { SITE_ORIGIN } from "../src/lib/site";

function setup(t: TestContext) {
  const vars = { NODE_ENV: "production", AUTH_ORIGIN: SITE_ORIGIN, PASSWORD_AUTH_ENABLED: "true", PASSWORD_AUTH_RATE_LIMIT_SECRET: "1".repeat(64) };
  const before = Object.fromEntries(Object.keys(vars).map((key) => [key, process.env[key]]));
  Object.assign(process.env, vars);
  t.after(() => {
    for (const key of Object.keys(vars)) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
    mock.restoreAll();
  });
}

const valid = { email: "unit@example.invalid", password: "A safe long travel phrase", name: "Unit Traveler", role: "traveler" };
function request(body: unknown = valid, headers: Record<string, string> = {}, url = `${SITE_ORIGIN}/api/auth/signup`) {
  return new Request(url, { method: "POST", headers: { "content-type": "application/json", origin: SITE_ORIGIN, ...headers }, body: JSON.stringify(body) });
}

test("disabled rollout or missing throttle secret refuses signup before database access", async (t) => {
  setup(t);
  delete process.env.PASSWORD_AUTH_ENABLED;
  const off = await passwordAuthPost(request(), "signup");
  assert.equal(off.status, 410);
  assert.match(off.headers.get("cache-control")!, /private, no-store/);
  process.env.PASSWORD_AUTH_ENABLED = "true";
  delete process.env.PASSWORD_AUTH_RATE_LIMIT_SECRET;
  assert.equal((await passwordAuthPost(request(), "signup")).status, 410);
});

test("password routes reject alternate hosts and cross-site or missing origins", async (t) => {
  setup(t);
  assert.equal((await passwordAuthPost(request(valid, {}, "https://other.example.test/api/auth/signup"), "signup")).status, 503);
  assert.equal((await passwordAuthPost(request(valid, { origin: "https://evil.example.test" }), "signup")).status, 403);
  assert.equal((await passwordAuthPost(request(valid, { origin: "" }), "signup")).status, 403);
  assert.equal((await passwordAuthPost(request(valid, { "sec-fetch-site": "cross-site" }), "signup")).status, 403);
});

test("password routes bound JSON bodies and reject malformed shapes before querying", async (t) => {
  setup(t);
  for (const body of [null, [], 42]) assert.equal((await passwordAuthPost(request(body), "signup")).status, 400);
  assert.equal((await passwordAuthPost(request(valid, { "content-type": "text/plain" }), "signup")).status, 400);
  assert.equal((await passwordAuthPost(request({ padding: "x".repeat(5000) }), "signup")).status, 413);
  const malformed = new Request(`${SITE_ORIGIN}/api/auth/signup`, { method: "POST", headers: { origin: SITE_ORIGIN, "content-type": "application/json" }, body: "{" });
  assert.equal((await passwordAuthPost(malformed, "signup")).status, 400);
});

test("self-registration refuses privilege roles and weak credentials", async (t) => {
  setup(t);
  for (const body of [{ ...valid, role: "admin" }, { ...valid, role: "owner" }, { ...valid, password: "short" }, { ...valid, email: "invalid" }, { ...valid, name: "x" }]) {
    const response = await passwordAuthPost(request(body), "signup");
    assert.equal(response.status, 422);
    assert.equal(response.headers.get("set-cookie"), null);
  }
});

test("missing schema refuses valid registration without creating a session", async (t) => {
  setup(t);
  const ready = mock.method(passwordAuthReadiness, "probe", async () => false);
  const response = await passwordAuthPost(request(), "signup");
  assert.equal(response.status, 503);
  assert.equal(ready.mock.callCount(), 1);
  assert.equal(response.headers.get("set-cookie"), null);
});
