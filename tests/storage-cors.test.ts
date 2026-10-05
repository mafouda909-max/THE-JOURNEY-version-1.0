import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { browserPrivateUploadReady, privateUploadCorsRules } from "../src/lib/storage-cors";

const origin = "https://the-journey-version-1-0.vercel.app";

test("private upload preparation preserves unrelated rules and adds only the exact pilot PUT origin", () => {
  const existing = [{ ID: "sila-private-upload", AllowedOrigins: ["https://another.example"], AllowedMethods: ["GET"], AllowedHeaders: ["range"] }];
  const before = JSON.stringify(existing);
  const result = privateUploadCorsRules(existing, origin);
  assert.equal(result.changed, true);
  assert.equal(JSON.stringify(existing), before);
  assert.deepEqual(result.rules[0], existing[0]);
  assert.deepEqual(result.rules[1].AllowedOrigins, [origin]);
  assert.deepEqual(result.rules[1].AllowedMethods, ["PUT"]);
  assert.deepEqual(result.rules[1].AllowedHeaders, ["content-type"]);
  assert.notEqual(result.rules[1].ID, existing[0].ID);
  assert.equal(privateUploadCorsRules(result.rules, origin).changed, false);
  for (const unsafe of ["http://example.com", `${origin}/`, "https://user:secret@example.com", `${origin}?secret=x`]) {
    assert.throws(() => privateUploadCorsRules([], unsafe));
  }
  assert.throws(() => privateUploadCorsRules(Array.from({ length: 100 }, () => existing[0]), origin));
});

test("actual preflight transport rejects missing permissions and terminates a stalled response", async () => {
  let mode = "denied";
  const server = createServer((request, response) => {
    assert.equal(request.method, "OPTIONS");
    assert.equal(request.headers.origin, origin);
    assert.equal(request.headers["access-control-request-method"], "PUT");
    assert.equal(request.headers["access-control-request-headers"], "content-type");
    if (mode === "stalled") return;
    if (mode === "denied") { response.writeHead(403).end("Denied"); return; }
    response.writeHead(200, {
      "access-control-allow-origin": mode === "wrong-origin" ? "https://another.example" : origin,
      "access-control-allow-methods": mode === "missing-method" ? "GET" : "PUT",
      "access-control-allow-headers": mode === "missing-header" ? "range" : "content-type",
    }).end();
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/private-key`;
  try {
    for (const failure of ["denied", "wrong-origin", "missing-method", "missing-header"]) {
      mode = failure;
      assert.equal(await browserPrivateUploadReady(url, origin, AbortSignal.timeout(1000)), false);
    }
    mode = "ready";
    assert.equal(await browserPrivateUploadReady(url, origin, AbortSignal.timeout(1000)), true);
    mode = "stalled";
    await assert.rejects(browserPrivateUploadReady(url, origin, AbortSignal.timeout(50)));
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
