import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolveAuthOrigin } from "../src/lib/auth-origin";

function read(path: string) {
  return readFileSync(path, "utf8").replace(/\r\n?/g, "\n");
}

test("production auth origin is explicit and fail-closed", () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const previousNodeEnv = mutableEnv.NODE_ENV;
  const previousOrigin = mutableEnv.AUTH_ORIGIN;
  try {
    mutableEnv.NODE_ENV = "production";
    delete mutableEnv.AUTH_ORIGIN;
    assert.equal(resolveAuthOrigin("https://preview.example.test/join"), null);

    mutableEnv.AUTH_ORIGIN = "https://auth.sila.example";
    assert.equal(
      resolveAuthOrigin("https://preview.example.test/join"),
      "https://auth.sila.example",
    );

    mutableEnv.AUTH_ORIGIN = "javascript:alert(1)";
    assert.equal(resolveAuthOrigin("https://preview.example.test/join"), null);

    mutableEnv.AUTH_ORIGIN = "http://example.com";
    assert.equal(resolveAuthOrigin("https://preview.example.test/join"), null);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousOrigin === undefined) delete process.env.AUTH_ORIGIN;
    else mutableEnv.AUTH_ORIGIN = previousOrigin;
  }
});

test("Google rollout is enforced on both UI and server", () => {
  const join = read("src/app/join/page.tsx");
  const start = read("src/app/api/auth/google/start/route.ts");
  const callback = read("src/app/api/auth/google/callback/route.ts");

  assert.match(join, /NEXT_PUBLIC_GOOGLE_AUTH_ENABLED/);
  assert.match(start, /GOOGLE_AUTH_ENABLED/);
  assert.match(callback, /GOOGLE_AUTH_ENABLED/);
  assert.match(start, /resolveAuthOrigin/);
  assert.match(callback, /resolveAuthOrigin/);
});

test("magic link rollout is enforced on request and consume endpoints", () => {
  const join = read("src/app/join/page.tsx");
  const request = read("src/app/api/auth/magic/request/route.ts");
  const consume = read("src/app/api/auth/magic/consume/route.ts");

  assert.match(join, /NEXT_PUBLIC_MAGIC_LINK_ENABLED/);
  assert.match(request, /MAGIC_LINK_ENABLED/);
  assert.match(consume, /MAGIC_LINK_ENABLED/);
  assert.match(request, /resolveAuthOrigin/);
  assert.match(consume, /resolveAuthOrigin/);
});

test("legacy password signup remains disabled and admin legacy login is separately gated", () => {
  const legacy = read("src/app/api/auth/[action]/route.ts");
  assert.match(legacy, /action === "signup"/);
  assert.match(legacy, /status: 410/);
  assert.match(legacy, /LEGACY_PASSWORD_LOGIN_ENABLED/);
  assert.match(legacy, /LEGACY_ADMIN_PASSWORD_LOGIN_ENABLED/);
});
