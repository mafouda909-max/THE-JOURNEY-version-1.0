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
    exports, require: (name: string) => {
      if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
      return modules[name];
    }, process: { env }, crypto, Response, Request, AbortSignal, URL, Buffer, Blob, FormData, ...globals,
  });
  return exports;
}

test("stored evidence rejects foreign keys, prototype types, absent MIME and invalid sizes", () => {
  const doc = { documentType: "identity", storageKey: "kyc/agent_11/identity_test.pdf" };
  const object = { size: 100, contentType: "application/pdf" };
  assert.equal(validDocumentEvidence(11, doc, object), true);
  assert.equal(validDocumentEvidence(12, doc, object), false);
  assert.equal(validDocumentEvidence(11, { ...doc, documentType: "toString" }, object), false);
  assert.equal(validDocumentEvidence(11, doc, null), false);
  for (const size of [0, -1, NaN, MAX_DOCUMENT_BYTES + 1]) assert.equal(validDocumentEvidence(11, doc, { ...object, size }), false);
  for (const contentType of [null, "text/html", "application/octet-stream"]) assert.equal(validDocumentEvidence(11, doc, { ...object, contentType }), false);
  assert.equal(validDocumentEvidence(11, { ...doc, expiresAt: new Date(0) }, object), false);
});

test("shared media listing cannot sign KYC even if storage returns a foreign key", async () => {
  class Command { constructor(public input: unknown) {} }
  const signed: string[] = [];
  const b2 = load("src/lib/b2.ts", {
    "@aws-sdk/client-s3": {
      S3Client: class { async send() { return { Contents: [{ Key: "kyc/agent_11/identity_test.pdf" }, { Key: "uploads/agent_12/photo.png" }, { Key: "uploads/agent_11/photo.png" }] }; } },
      GetObjectCommand: Command, ListObjectsV2Command: Command, PutObjectCommand: Command, HeadObjectCommand: Command,
    },
    "@aws-sdk/s3-request-presigner": { getSignedUrl: async (_client: unknown, cmd: { input: { Key: string } }) => { signed.push(cmd.input.Key); return "LOCAL_STUB"; } },
  }, { B2_ENDPOINT: "https://local.invalid", B2_BUCKET_NAME: "test", B2_KEY_ID: "LOCAL_STUB", B2_APPLICATION_KEY: "LOCAL_STUB" });
  for (const prefix of ["", "kyc/", "uploads/", "uploads/agent_11/../"]) await assert.rejects(b2.listMedia(prefix));
  await b2.listMedia("uploads/agent_11/");
  assert.deepEqual(signed, ["uploads/agent_11/photo.png"]);
});

test("media denies unauthenticated and foreign scope before invoking storage", async () => {
  let account: any = null;
  const route = load("src/app/api/media/route.ts", {
    "next/server": { NextResponse: { json: (data: unknown, init?: ResponseInit) => Response.json(data, init) } },
    "@/lib/b2": { b2Configured: true, listMedia: () => { throw new Error("Storage must not be reached"); } },
    "@/lib/identity": { accountFromRequest: async () => account, requireAccount: (value: unknown) => value ? null : Response.json({}, { status: 401 }) },
  });
  assert.equal((await route.GET(new Request("http://local.invalid/api/media"))).status, 401);
  assert.equal((await route.POST(new Request("http://local.invalid/api/media", { method: "POST" }))).status, 401);
  account = { role: "agent", agentId: 11 };
  assert.equal((await route.GET(new Request("http://local.invalid/api/media?prefix=uploads/agent_12/"))).status, 403);
});

test("raw Responses API output is parsed strictly and cannot invent document identity", () => {
  const ai = load("src/lib/ai-document-verification.ts", {
    "@/lib/private-storage": {}, "@/lib/document-evidence": { DOCUMENT_MIME_TYPES: [] },
  });
  const result = {
    overallConfidence: 50, riskLevel: "medium", recommendation: "review", summary: "TEST",
    profileChecks: { nameMatch: "not_available", addressMatch: "not_available", licenseMatch: "not_available" },
    documents: [{ documentId: 1, documentType: "identity", classification: "unclear", quality: "low", validity: "unclear", tamperRisk: "unclear", reasons: [],
      extracted: Object.fromEntries(["fullName", "latinName", "documentNumber", "address", "issuingAuthority", "issueDate", "expiryDate", "licenseNumber"].map(key => [key, null])) }], warnings: [],
  };
  const response = (value: unknown) => ({ status: "completed", output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
  const docs = [{ id: 1, documentType: "identity" }];
  assert.equal(ai.parseVerificationResponse(response(result), docs).recommendation, "review");
  assert.throws(() => ai.parseVerificationResponse({ ...response(result), status: "incomplete" }, docs));
  assert.throws(() => ai.parseVerificationResponse(response({ ...result, overallConfidence: 101 }), docs));
  assert.throws(() => ai.parseVerificationResponse(response(result), [{ id: 99, documentType: "identity" }]));
  assert.throws(() => ai.parseVerificationResponse({ status: "completed", output: [{ type: "message", content: [{ type: "refusal" }] }] }, docs));
});

test("AI cleanup executes on parser failure and surfaces deletion failures", async () => {
  let deleteCount = 0;
  let deleteStatus = 200;
  const ai = load("src/lib/ai-document-verification.ts", {
    "@/lib/private-storage": { privateStorageProvider: { getPresignedDownloadUrl: async () => ({ downloadUrl: "https://local.invalid/document" }) } },
    "@/lib/document-evidence": { DOCUMENT_MIME_TYPES: ["application/pdf"] },
  }, { AI_DOCUMENT_REVIEW_ENABLED: "true", OPENAI_API_KEY: "LOCAL_STUB" }, {
    fetch: async (url: string, options: { method?: string } = {}) => {
      if (options.method === "DELETE") { deleteCount++; return new Response("", { status: deleteStatus }); }
      if (url === "https://local.invalid/document") return new Response("%PDF-TEST", { headers: { "content-type": "application/pdf" } });
      if (url.endsWith("/files")) return Response.json({ id: "local-test-file" });
      return Response.json({ status: "incomplete", output: [] });
    },
  });
  const docs = [{ id: 1, documentType: "identity", originalName: "test.pdf", storageKey: "kyc/agent_11/identity_test.pdf" }];
  await assert.rejects(ai.analyzeAgentDocuments({}, docs), /incomplete/);
  assert.equal(deleteCount, 1);
  deleteCount = 0; deleteStatus = 500;
  await assert.rejects(ai.analyzeAgentDocuments({}, docs), /cleanup failed/);
  assert.equal(deleteCount, 2);
});

test("private key generation keeps accepted filenames valid and keys distinct", () => {
  const { PrivateStorageProvider } = load("src/lib/private-storage.ts", { "@/lib/b2": {} });
  const provider = new PrivateStorageProvider();
  const key = provider.generatePrivateStorageKey(11, "identity", "identity..pdf");
  assert.equal(validDocumentEvidence(11, { documentType: "identity", storageKey: key }, { size: 100, contentType: "application/pdf" }), true);
  assert.notEqual(key, provider.generatePrivateStorageKey(11, "identity", "identity..pdf"));
});

test("confirmation scopes documents to session, validates stored evidence and matches UI response", async () => {
  let object: { size: number; contentType: string } | null = { size: 20, contentType: "application/pdf" };
  let status = "pending";
  let auditCount = 0;
  const rows = () => [{ id: 1, agentId: 11, documentType: "identity", storageKey: "kyc/agent_11/identity_test.pdf", status }];
  const columns = (table: string) => new Proxy({ name: table }, { get: (_t, key) => key === "name" ? table : String(key) });
  const route = load("src/app/api/agent-verification/route.ts", {
    "next/server": { NextResponse: { json: (data: unknown, init?: ResponseInit) => Response.json(data, init) } },
    "drizzle-orm": { eq: (key: string, value: unknown) => (row: any) => row[key] === value, and: (...conditions: any[]) => (row: any) => conditions.every(c => c(row)) },
    "@/db/schema": { agents: columns("agents"), agentDocuments: columns("documents"), auditLog: columns("audit") },
    "@/db": { db: {
      select: () => ({ from: (table: any) => ({ where: (predicate: any) => ({ limit: async () => (table.name === "agents" ? [{ id: 11, verificationStatus: "in_review" }] : rows()).filter(predicate) }) }) }),
      insert: () => ({ values: async () => { auditCount++; } }),
    } },
    "@/lib/identity": { accountFromRequest: async () => ({ id: 9, agentId: 11, role: "agent" }), requireAccount: () => null },
    "@/lib/private-storage": {}, "@/lib/b2": { privateObjectInfo: async () => object },
    "@/lib/document-evidence": { validDocumentEvidence },
  });
  const request = (documentId: number) => new Request("http://local.invalid/api/agent-verification", { method: "POST", body: JSON.stringify({ action: "confirm", documentId }) });
  assert.equal((await route.POST(request(2))).status, 404);
  object = null;
  assert.equal((await route.POST(request(1))).status, 422);
  object = { size: 20, contentType: "text/html" };
  assert.equal((await route.POST(request(1))).status, 422);
  object = { size: 20, contentType: "application/pdf" };
  status = "rejected";
  assert.equal((await route.POST(request(1))).status, 409);
  status = "pending";
  const response = await route.POST(request(1));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).document.stored, true);
  assert.equal(auditCount, 1);
  assert.match(readFileSync("src/app/account/verification/page.tsx", "utf8"), /confirmation\.document\?\.stored/);
});

test("admin decision refuses a profile changed while evidence was being checked", async () => {
  const agent = { id: 11, verificationStatus: "in_review", licenseType: "individual", displayName: "TEST", latinName: "TEST", bio: "TEST", city: "TEST", country: "TEST", licenseNumber: null };
  const docs = ["identity", "license"].map((documentType, id) => ({ id, agentId: 11, documentType, status: "pending", storageKey: `kyc/agent_11/${documentType}_test.pdf` }));
  const columns = (name: string) => new Proxy({ name }, { get: (_t, key) => key === "name" ? name : String(key) });
  const eq = (key: string, value: unknown) => (row: any) => row[key] === value;
  const route = load("src/app/api/agents/[id]/route.ts", {
    "next/server": { NextResponse: { json: (data: unknown, init?: ResponseInit) => Response.json(data, init) } },
    "drizzle-orm": { eq, and: (...parts: any[]) => (row: any) => parts.every(part => part(row)), sql: (_strings: unknown, key: string, value: unknown) => eq(key, value) },
    "@/db/schema": { agents: columns("agents"), agentDocuments: columns("documents") },
    "@/lib/auth": { requireAdmin: () => null }, "@/lib/notify": {},
    "@/lib/document-evidence": { validDocumentEvidence },
    "@/lib/b2": { privateObjectInfo: async () => { agent.licenseType = "agency"; return { size: 100, contentType: "application/pdf" }; } },
    "@/db": { db: {
      select: () => ({ from: (table: any) => ({ where: () => { const values = table.name === "agents" ? [{ ...agent }] : docs; return { limit: async () => values, then: (resolve: any) => resolve(values) }; } }) }),
      update: () => ({ set: () => ({ where: (predicate: any) => ({ returning: async () => predicate(agent) ? [agent] : [] }) }) }),
    } },
  });
  const response = await route.PATCH(new Request("http://local.invalid/api/agents/11", { method: "PATCH", body: JSON.stringify({ action: "verify" }) }), { params: Promise.resolve({ id: "11" }) });
  assert.equal(response.status, 409);
  assert.equal(agent.verificationStatus, "in_review");
});
