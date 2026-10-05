import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mock, test, type TestContext } from "node:test";
import { GET as startGoogle } from "../src/app/api/auth/google/start/route";
import { GET as finishGoogle } from "../src/app/api/auth/google/callback/route";
import { SITE_ORIGIN } from "../src/lib/site";

function setup(t: TestContext) {
  const values = {
    NODE_ENV: "production", AUTH_ORIGIN: SITE_ORIGIN, GOOGLE_AUTH_ENABLED: "true",
    GOOGLE_CLIENT_ID: "synthetic-client", GOOGLE_CLIENT_SECRET: "synthetic-secret",
  };
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => {
    for (const key of Object.keys(values)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    mock.restoreAll();
  });
}

function callback(cookie = "sila_google_state=expected-state; sila_google_verifier=synthetic-verifier") {
  return new Request(`${SITE_ORIGIN}/api/auth/google/callback?code=synthetic-code&state=expected-state`, {
    headers: { cookie },
  });
}

function refused(response: Awaited<ReturnType<typeof finishGoogle>>, code: string) {
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), `${SITE_ORIGIN}/join?error=${code}`);
  assert.match(response.headers.get("cache-control")!, /no-store/);
  assert.equal(response.cookies.get("tj_sess"), undefined);
  const cookies = response.cookies.getAll();
  assert.equal(cookies.length, 4);
  assert.ok(cookies.every((cookie) => cookie.value === "" && cookie.maxAge === 0));
  assert.ok(!response.headers.get("location")!.includes("synthetic-secret"));
}

test("Google starts with only identity scopes, same-host callback, PKCE and private cookies", async (t) => {
  setup(t);
  const response = await startGoogle(new Request(`${SITE_ORIGIN}/api/auth/google/start?role=admin&intent=login`));
  const url = new URL(response.headers.get("location")!);
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("scope"), "openid email profile");
  assert.equal(url.searchParams.get("redirect_uri"), `${SITE_ORIGIN}/api/auth/google/callback`);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("state"), response.cookies.get("sila_google_state")!.value);
  const verifier = response.cookies.get("sila_google_verifier")!.value;
  assert.equal(url.searchParams.get("code_challenge"), createHash("sha256").update(verifier).digest("base64url"));
  assert.equal(response.cookies.get("sila_google_role")!.value, "traveler");
  for (const cookie of response.cookies.getAll()) {
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.secure, true);
    assert.equal(cookie.sameSite, "lax");
    assert.equal(cookie.maxAge, 600);
  }
  assert.match(response.headers.get("cache-control")!, /no-store/);
  assert.ok(!url.search.includes("synthetic-secret"));
});

test("Google refuses missing configuration and alternate hosts before provider calls", async (t) => {
  setup(t);
  const fetch = mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected provider call"); });
  delete process.env.GOOGLE_CLIENT_SECRET;
  refused(await finishGoogle(callback()), "google_not_configured");
  process.env.GOOGLE_CLIENT_SECRET = "synthetic-secret";
  const response = await startGoogle(new Request("https://alternate.example.invalid/api/auth/google/start"));
  assert.equal(response.headers.get("location"), "https://alternate.example.invalid/join?error=google_not_configured");
  refused(await finishGoogle(new Request("https://alternate.example.invalid/api/auth/google/callback")), "google_not_configured");
  assert.equal(fetch.mock.callCount(), 0);
});

test("missing, mismatched and malformed state cookies cannot contact Google", async (t) => {
  setup(t);
  const fetch = mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected provider call"); });
  for (const cookie of ["", "sila_google_state=other-state; sila_google_verifier=valid", "sila_google_state=%; sila_google_verifier=valid"]) {
    refused(await finishGoogle(callback(cookie)), "google_state_invalid");
  }
  assert.equal(fetch.mock.callCount(), 0);
});

for (const kind of ["network", "timeout", "http", "json", "shape", "token-type"] as const) {
  test(`Google token ${kind} failure clears the attempt without a session or leaked provider data`, async (t) => {
    setup(t);
    const fetch = mock.method(globalThis, "fetch", async (_url: RequestInfo | URL, options?: RequestInit) => {
      assert.equal(options?.redirect, "error");
      assert.equal(options?.cache, "no-store");
      assert.ok(options?.signal);
      if (kind === "network") throw new Error("synthetic-secret provider diagnostics");
      if (kind === "timeout") throw new DOMException("Timeout", "TimeoutError");
      if (kind === "http") return new Response("synthetic-secret provider diagnostics", { status: 400 });
      if (kind === "json") return new Response("not json");
      if (kind === "shape") return Response.json(["unexpected"]);
      return Response.json({ access_token: { unsafe: true } });
    });
    refused(await finishGoogle(callback()), kind === "token-type" ? "google_token_missing" : "google_token_exchange_failed");
    assert.equal(fetch.mock.callCount(), 1);
  });
}

for (const kind of ["network", "http", "json", "unverified", "string-verified", "subject-type"] as const) {
  test(`Google profile ${kind} failure cannot provision an identity or issue a session`, async (t) => {
    setup(t);
    const fetch = mock.method(globalThis, "fetch", async (url: RequestInfo | URL, options?: RequestInit) => {
      assert.equal(options?.redirect, "error");
      if (String(url) === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "synthetic-access" });
      assert.equal(String(url), "https://openidconnect.googleapis.com/v1/userinfo");
      assert.deepEqual(options?.headers, { Authorization: "Bearer synthetic-access" });
      if (kind === "network") throw new Error("synthetic-secret provider diagnostics");
      if (kind === "http") return new Response("provider diagnostics", { status: 503 });
      if (kind === "json") return new Response("not json");
      return Response.json({
        sub: kind === "subject-type" ? {} : "synthetic-subject",
        email: "synthetic@example.invalid",
        email_verified: kind === "string-verified" ? "true" : kind !== "unverified",
      });
    });
    const code = ["network", "http", "json"].includes(kind) ? "google_profile_failed" : "google_email_not_verified";
    refused(await finishGoogle(callback()), code);
    assert.equal(fetch.mock.callCount(), 2);
  });
}
