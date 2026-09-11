import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path: string, modules: Record<string, unknown>, env: Record<string, string> = {}, globals: Record<string, unknown> = {}) {
  const exports: Record<string, any> = {};
  runInNewContext(ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports,
    require: (name: string) => {
      if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
      return modules[name];
    },
    process: { env },
    Buffer,
    Request,
    Response,
    URL,
    console,
    ...globals,
  });
  return exports;
}

test("admin browser session is signed, expires, and never stores the master key", () => {
  const master = "TEST_ADMIN_SECRET_0123456789abcdef";
  const auth = load("src/lib/auth.ts", {
    "next/server": { NextResponse: { json: (data: unknown, init?: ResponseInit) => Response.json(data, init) } },
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
    "node:crypto": require("node:crypto"),
    "node:fs": { existsSync: () => false, readFileSync: () => "", writeFileSync: () => {}, mkdirSync: () => {} },
    "node:path": require("node:path"),
  }, { NODE_ENV: "production", ADMIN_API_KEY: master });

  const now = 1_800_000_000_000;
  const token = auth.createAdminSessionToken(now, 60);
  assert.equal(typeof token, "string");
  assert.ok(token);
  assert.equal(token.includes(master), false);
  assert.equal(auth.adminSessionMatches(token, now), true);
  assert.equal(auth.adminSessionMatches(token, now + 61_000), false);
  assert.equal(auth.adminSessionMatches(master, now), false);

  const cookieRequest = new Request("https://example.invalid/review", {
    headers: { cookie: `tj_admin=${encodeURIComponent(token)}` },
  });
  assert.equal(auth.isAdminRequest(cookieRequest), true);

  const rawCookieRequest = new Request("https://example.invalid/review", {
    headers: { cookie: `tj_admin=${encodeURIComponent(master)}` },
  });
  assert.equal(auth.isAdminRequest(rawCookieRequest), false);

  const headerRequest = new Request("https://example.invalid/review", {
    headers: { "x-admin-key": master },
  });
  assert.equal(auth.isAdminRequest(headerRequest), true);
});

test("media listing and upload fail closed without admin authorization", async () => {
  let listCalls = 0;
  let uploadCalls = 0;
  const route = load("src/app/api/media/route.ts", {
    "next/server": { NextResponse: { json: (data: unknown, init?: ResponseInit) => Response.json(data, init) } },
    "@/lib/b2": {
      B2_BUCKET_NAME: "test-bucket",
      b2Configured: true,
      listMedia: async () => { listCalls += 1; return []; },
      createUploadUrl: async () => { uploadCalls += 1; return { key: "uploads/test.png", url: "https://upload.invalid" }; },
    },
    "@/lib/auth": {
      requireAdmin: (request: Request) => request.headers.get("x-admin-key") === "ok"
        ? null
        : Response.json({ error: "Unauthorized" }, { status: 401 }),
    },
  });

  const deniedGet = await route.GET(new Request("https://example.invalid/api/media"));
  assert.equal(deniedGet.status, 401);
  assert.equal(listCalls, 0);

  const deniedPost = await route.POST(new Request("https://example.invalid/api/media", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename: "test.png", contentType: "image/png" }),
  }));
  assert.equal(deniedPost.status, 401);
  assert.equal(uploadCalls, 0);

  const allowedGet = await route.GET(new Request("https://example.invalid/api/media", {
    headers: { "x-admin-key": "ok" },
  }));
  assert.equal(allowedGet.status, 200);
  assert.equal(listCalls, 1);

  const allowedPost = await route.POST(new Request("https://example.invalid/api/media", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-key": "ok" },
    body: JSON.stringify({ filename: "test.png", contentType: "image/png" }),
  }));
  assert.equal(allowedPost.status, 201);
  assert.equal(uploadCalls, 1);
});
