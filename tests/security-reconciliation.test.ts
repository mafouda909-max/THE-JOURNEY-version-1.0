import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { validDocumentEvidence, MAX_DOCUMENT_BYTES } from "../src/lib/document-evidence";

function load(path: string, modules: Record<string, unknown>, env = {}, globals = {}) {
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
    crypto,
    Response,
    Request,
    AbortSignal,
    URL,
    Buffer,
    Blob,
    FormData,
    console,
    ...globals,
  });
  return exports;
}

function columns(name: string) {
  return new Proxy({ name }, { get: (_target, key) => key === "name" ? name : String(key) });
}

test("stored verification evidence rejects foreign namespaces, invalid MIME, expired evidence and invalid sizes", () => {
  const doc = { documentType: "identity", storageKey: "kyc/agent_11/identity_test.pdf" };
  const object = { size: 100, contentType: "application/pdf" };
  assert.equal(validDocumentEvidence(11, doc, object), true);
  assert.equal(validDocumentEvidence(12, doc, object), false);
  assert.equal(validDocumentEvidence(11, { ...doc, documentType: "toString" }, object), false);
  assert.equal(validDocumentEvidence(11, { ...doc, storageKey: "kyc/agent_11/identity_../foreign.pdf" }, object), false);
  assert.equal(validDocumentEvidence(11, { ...doc, expiresAt: new Date(0) }, object), false);
  assert.equal(validDocumentEvidence(11, doc, null), false);
  for (const size of [0, -1, NaN, MAX_DOCUMENT_BYTES + 1]) {
    assert.equal(validDocumentEvidence(11, doc, { ...object, size }), false);
  }
  for (const contentType of [null, "text/html", "application/octet-stream"]) {
    assert.equal(validDocumentEvidence(11, doc, { ...object, contentType }), false);
  }
});

test("private KYC storage keys are opaque, unique and remain inside the expected namespace", () => {
  const { PrivateStorageProvider } = load("src/lib/private-storage.ts", { "@/lib/b2": {} });
  const provider = new PrivateStorageProvider();
  const first = provider.generatePrivateStorageKey(11, "identity", "passport.pdf");
  const second = provider.generatePrivateStorageKey(11, "identity", "passport.pdf");
  assert.match(first, /^kyc\/agent_11\/identity_[0-9a-f-]{36}_/);
  assert.notEqual(first, second);
  assert.equal(validDocumentEvidence(11, { documentType: "identity", storageKey: first }, { size: 100, contentType: "application/pdf" }), true);
});

test("traveler account history fails closed until guest requests have authenticated ownership", () => {
  const source = readFileSync("src/app/account/page.tsx", "utf8");
  assert.match(source, /self-declared email is not proof of ownership/i);
  assert.doesNotMatch(source, /eq\(contactRequests\.travelerEmail, account\.email\)/);
});

test("production MCP configuration probing is disabled", () => {
  const mcp = load("src/lib/mcp.ts", {
    "node:fs": { existsSync: () => true, readFileSync: () => JSON.stringify({ mcp: { unsafe: { enabled: true, command: "x" } } }) },
    "node:path": { join: (...parts: string[]) => parts.join("/") },
    "@/lib/tools": {},
  }, { NODE_ENV: "production" });
  const loaded = mcp.mcpConfigManager.loadConfig();
  assert.equal(loaded.config, null);
  assert.equal(loaded.configPath, null);
});

test("admin authorization fails closed in production without ADMIN_API_KEY", () => {
  const auth = load("src/lib/auth.ts", {
    "next/server": { NextResponse: { json: (data: unknown, init?: ResponseInit) => Response.json(data, init) } },
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
    "node:crypto": require("node:crypto"),
    "node:fs": { existsSync: () => true, readFileSync: () => JSON.stringify({ key: "unsafe-local-key-1234" }), writeFileSync: () => { throw new Error("must not write"); }, mkdirSync: () => {} },
    "node:path": require("node:path"),
  }, { NODE_ENV: "production" });
  assert.equal(auth.adminAuthConfigured, false);
  assert.equal(auth.requireAdmin(new Request("http://local.invalid")).status, 503);
});

test("raw AI verification responses are validated against the evidence contract", () => {
  const ai = load("src/lib/ai-document-verification.ts", {
    "@/lib/private-storage": {},
    "@/lib/document-evidence": { DOCUMENT_MIME_TYPES: ["application/pdf"] },
  });
  const result = {
    overallConfidence: 50,
    riskLevel: "medium",
    recommendation: "review",
    summary: "TEST",
    profileChecks: { nameMatch: "not_available", addressMatch: "not_available", licenseMatch: "not_available" },
    documents: [{
      documentId: 1,
      documentType: "identity",
      classification: "unclear",
      quality: "low",
      validity: "unclear",
      tamperRisk: "unclear",
      reasons: [],
      extracted: Object.fromEntries(["fullName", "latinName", "documentNumber", "address", "issuingAuthority", "issueDate", "expiryDate", "licenseNumber"].map(key => [key, null])),
    }],
    warnings: [],
  };
  const response = (value: unknown) => ({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
  const docs = [{ id: 1, documentType: "identity" }];
  assert.equal(ai.parseVerificationResponse(response(result), docs).recommendation, "review");
  assert.throws(() => ai.parseVerificationResponse({ ...response(result), status: "incomplete" }, docs));
  assert.throws(() => ai.parseVerificationResponse(response({ ...result, overallConfidence: 101 }), docs));
  assert.throws(() => ai.parseVerificationResponse(response(result), [{ id: 99, documentType: "identity" }]));
});

test("valid AI results are not discarded solely because temporary-file cleanup fails", async () => {
  let deleteCount = 0;
  const ai = load("src/lib/ai-document-verification.ts", {
    "@/lib/private-storage": { privateStorageProvider: { getPresignedDownloadUrl: async () => ({ downloadUrl: "https://local.invalid/document" }) } },
    "@/lib/document-evidence": { DOCUMENT_MIME_TYPES: ["application/pdf"] },
  }, { AI_DOCUMENT_REVIEW_ENABLED: "true", OPENAI_API_KEY: "LOCAL_STUB" }, {
    fetch: async (url: string, options: { method?: string } = {}) => {
      if (options.method === "DELETE") { deleteCount++; return new Response("", { status: 500 }); }
      if (url === "https://local.invalid/document") return new Response("%PDF-TEST", { headers: { "content-type": "application/pdf" } });
      if (url.endsWith("/files")) return Response.json({ id: "local-test-file" });
      const result = {
        overallConfidence: 50,
        riskLevel: "medium",
        recommendation: "review",
        summary: "TEST",
        profileChecks: { nameMatch: "not_available", addressMatch: "not_available", licenseMatch: "not_available" },
        documents: [{
          documentId: 1,
          documentType: "identity",
          classification: "unclear",
          quality: "low",
          validity: "unclear",
          tamperRisk: "unclear",
          reasons: [],
          extracted: { fullName: null, latinName: null, documentNumber: null, address: null, issuingAuthority: null, issueDate: null, expiryDate: null, licenseNumber: null },
        }],
        warnings: [],
      };
      return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(result) }] }] });
    },
  });
  const docs = [{ id: 1, documentType: "identity", originalName: "test.pdf", storageKey: "kyc/agent_11/identity_test.pdf" }];
  const result = await ai.analyzeAgentDocuments({ displayName: "A", latinName: "A", city: "C", country: "EG", licenseType: "individual", licenseNumber: null, email: "a@example.com" }, docs);
  assert.equal(result.recommendation, "review");
  assert.equal(deleteCount, 2);
});

test("GET /api/offers keeps published discovery public and protects every non-published status", async () => {
  let adminChecks = 0;
  const rows = [{ offer: { id: 1, tripType: "package", status: "published" }, agent: { id: 11 } }];
  const route = load("src/app/api/offers/route.ts", {
    "next/server": { NextResponse: { json: (data: unknown, init?: ResponseInit) => Response.json(data, init) } },
    "drizzle-orm": { desc: (value: unknown) => value, eq: (left: unknown, right: unknown) => ({ left, right }) },
    "@/db": { db: { select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ orderBy: async () => rows }) }) }) }) } },
    "@/db/schema": { agents: columns("agents"), auditLog: columns("audit"), offers: columns("offers") },
    "@/lib/identity": { accountFromRequest: async () => null },
    "@/lib/auth": { requireAdmin: (request: Request) => { adminChecks++; return request.headers.get("x-admin-key") === "TEST_ADMIN" ? null : Response.json({ error: "Unauthorized" }, { status: 401 }); } },
    "@/lib/format": { TRIP_TYPES: [] },
  });

  const publicDefault = await route.GET(new Request("http://local.invalid/api/offers"));
  assert.equal(publicDefault.status, 200);
  assert.equal(adminChecks, 0);

  const publicPublished = await route.GET(new Request("http://local.invalid/api/offers?status=published"));
  assert.equal(publicPublished.status, 200);
  assert.equal(adminChecks, 0);

  for (const status of ["pending_review", "rejected", "draft"]) {
    const denied = await route.GET(new Request(`http://local.invalid/api/offers?status=${status}`));
    assert.equal(denied.status, 401);
  }
  assert.equal(adminChecks, 3);

  const allowed = await route.GET(new Request("http://local.invalid/api/offers?status=pending_review", { headers: { "x-admin-key": "TEST_ADMIN" } }));
  assert.equal(allowed.status, 200);
  assert.equal(adminChecks, 4);
});
