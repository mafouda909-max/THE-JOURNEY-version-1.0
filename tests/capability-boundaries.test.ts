import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { readAuthBody } from "../src/lib/auth-request";
import { guardCapabilityRequest } from "../src/lib/capability-request";

function load(path: string, modules: Record<string, unknown>) {
  const exports: Record<string, any> = {};
  runInNewContext(ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: (name: string) => {
    if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
    return modules[name];
  }, Request, Response, URL, RangeError, process: { env: {} } });
  return exports;
}
const responseModule = { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } };
const request = (path: string, body: unknown, headers: Record<string, string> = {}) => new Request(`https://example.invalid${path}`, {
  method: "POST", headers: { origin: "https://example.invalid", "content-type": "application/json", "x-forwarded-for": "192.0.2.90", ...headers }, body: JSON.stringify(body),
});

test("agent drafting rejects unauthorized, foreign-origin and oversized requests before a provider call", async () => {
  let account: { id: number; role: string } | null = null, calls = 0;
  const route = load("src/app/api/ai/offer-draft/route.ts", {
    "next/server": responseModule,
    "@/lib/identity": { accountFromRequest: async () => account },
    "@/lib/provider-gateway": { aiProvider: { assistOfferDraft: async () => { calls++; return { assistedBy: "deterministic_rules" }; } } },
    "@/lib/auth-request": { readAuthBody }, "@/lib/capability-request": { guardCapabilityRequest },
  });
  const path = "/api/ai/offer-draft";
  assert.equal((await route.POST(request(path, { title: "Draft" }))).status, 401);
  account = { id: 900091, role: "traveler" };
  assert.equal((await route.POST(request(path, { title: "Draft" }))).status, 401);
  account.role = "agent";
  assert.equal((await route.POST(request(path, { title: "Draft" }, { origin: "https://foreign.invalid" }))).status, 403);
  assert.equal((await route.POST(request(path, { title: "x".repeat(17000) }))).status, 413);
  assert.equal((await route.POST(request(path, []))).status, 400);
  assert.equal(calls, 0);
  const response = await route.POST(request(path, { title: "Draft" }));
  assert.equal(response.status, 200); assert.equal(calls, 1);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("expensive document requests have a bounded actor budget and foreign origins do not consume it", async () => {
  const path = "/api/agent-verification/ai-review";
  assert.equal(guardCapabilityRequest(request(path, {}, { origin: "https://foreign.invalid" }), "ai_documents", 900092)?.status, 403);
  assert.equal(guardCapabilityRequest(request(path, {}, { "x-forwarded-for": "192.0.2.91" }), "ai_documents", 900092), null);
  assert.equal(guardCapabilityRequest(request(path, {}, { "x-forwarded-for": "192.0.2.91" }), "ai_documents", 900092), null);
  const blocked = guardCapabilityRequest(request(path, {}, { "x-forwarded-for": "192.0.2.91" }), "ai_documents", 900092)!;
  assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers.get("retry-after")) > 0);
});

test("admin probe authorization and origin precede providers; audit failure cannot report success", async () => {
  let probes = 0, failAudit = false;
  const route = load("src/app/api/tools/route.ts", {
    "next/server": responseModule,
    "@/db": { db: { insert: () => ({ values: async () => { if (failAudit) throw new Error("private-email@example.invalid raw database body"); } }) } },
    "@/db/schema": { auditLog: {} },
    "@/lib/auth": { requireAdmin: (req: Request) => req.headers.get("cookie") === "test-admin" || req.headers.get("x-admin-key") === "test" ? null : Response.json({ error: "Unauthorized" }, { status: 401 }), adminKeyMatches: (key: unknown) => key === "test" },
    "@/lib/rate-limit": { clientIpFromRequest: () => "fixture", rateLimiter: { checkRateLimit: () => ({ allowed: true }) } },
    "@/lib/tools": { getToolMatrix: async () => { probes++; return []; }, getPlatformStatus: async () => ({}) },
  });
  assert.equal((await route.GET(new Request("https://example.invalid/api/tools"))).status, 401);
  assert.equal((await route.POST(request("/api/tools", {}, { cookie: "test-admin", origin: "https://foreign.invalid" }))).status, 403);
  assert.equal(probes, 0);
  const valid = request("/api/tools", {}, { cookie: "test-admin" });
  assert.equal((await route.POST(valid)).status, 200); assert.equal(probes, 1);
  failAudit = true;
  const response = await route.POST(valid);
  assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.doesNotMatch(await response.text(), /private-email|database body/);
});

test("the public supplier facade uses the owned flight gateway", async () => {
  let calls = 0;
  const facade = load("src/lib/travel-suppliers/index.ts", {
    "@/lib/provider-gateway": { searchFlights: async () => { calls++; return { offers: [], connected: false, error: "GATED" }; } },
    "@/lib/capabilities/production": { capabilityRuntime: { probe: async () => ({ ready: false, failureCode: "GATED", latencyMs: null }) } },
  });
  assert.equal(facade.getTravelSupplierAdapter("unknown"), null);
  const status = await facade.getTravelSupplierAdapter("amadeus").probe();
  assert.equal(status.connected, false); assert.equal(status.error, "GATED");
  const results = await facade.searchAllFlightSuppliers({});
  assert.equal(calls, 1); assert.equal(results[0].error, "GATED");
});
