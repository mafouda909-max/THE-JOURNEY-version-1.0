import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolveAuthOrigin } from "../src/lib/auth-origin";

function read(path: string) {
  return readFileSync(path, "utf8").replace(/\r\n?/g, "\n");
}

test("production auth origin is explicit and fail-closed", () => {
  assert.equal(
    resolveAuthOrigin("https://preview.example.test/join", "production", undefined),
    null,
  );

  assert.equal(
    resolveAuthOrigin(
      "https://preview.example.test/join",
      "production",
      "https://auth.sila.example",
    ),
    "https://auth.sila.example",
  );

  assert.equal(
    resolveAuthOrigin(
      "https://preview.example.test/join",
      "production",
      "javascript:alert(1)",
    ),
    null,
  );

  assert.equal(
    resolveAuthOrigin(
      "https://preview.example.test/join",
      "production",
      "http://example.com",
    ),
    null,
  );

  assert.equal(
    resolveAuthOrigin("http://localhost:3000/join", "development", undefined),
    "http://localhost:3000",
  );
});

test("Google rollout is enforced on both UI and server", () => {
  const join = read("src/app/join/page.tsx");
  const config = read("src/app/api/auth/config/route.ts");
  const start = read("src/app/api/auth/google/start/route.ts");
  const callback = read("src/app/api/auth/google/callback/route.ts");

  assert.match(join, /\/api\/auth\/config/);
  assert.match(config, /GOOGLE_AUTH_ENABLED/);
  assert.match(config, /NEXT_PUBLIC_GOOGLE_AUTH_ENABLED/);
  assert.match(config, /GOOGLE_CLIENT_ID/);
  assert.match(config, /GOOGLE_CLIENT_SECRET/);
  assert.match(start, /GOOGLE_AUTH_ENABLED/);
  assert.match(callback, /GOOGLE_AUTH_ENABLED/);
  assert.match(start, /resolveAuthOrigin/);
  assert.match(callback, /resolveAuthOrigin/);
});

test("magic link rollout is enforced on request and consume endpoints", () => {
  const join = read("src/app/join/page.tsx");
  const config = read("src/app/api/auth/config/route.ts");
  const request = read("src/app/api/auth/magic/request/route.ts");
  const consume = read("src/app/api/auth/magic/consume/route.ts");

  assert.match(join, /\/api\/auth\/config/);
  assert.match(config, /MAGIC_LINK_ENABLED/);
  assert.match(config, /NEXT_PUBLIC_MAGIC_LINK_ENABLED/);
  assert.match(config, /RESEND_API_KEY/);
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
