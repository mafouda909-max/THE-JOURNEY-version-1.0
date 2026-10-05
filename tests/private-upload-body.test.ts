import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesDocumentContent, PRIVATE_GATEWAY_MAX_BYTES, readPrivateUploadBody } from "../src/lib/private-upload-body";

test("private gateway bounds actual streamed bytes and declared size without trusting MIME alone", async () => {
  const bytes = Buffer.from("%PDF-1.4\nprivate QA only");
  const req = new Request("http://localhost", { method: "PUT", body: bytes, headers: { "content-length": String(bytes.length) } });
  assert.deepEqual(await readPrivateUploadBody(req, AbortSignal.timeout(1000)), bytes);
  assert.equal(matchesDocumentContent(bytes, "application/pdf"), true);
  assert.equal(matchesDocumentContent(Buffer.from("<html>private</html>"), "application/pdf"), false);
  assert.equal(matchesDocumentContent(bytes, "image/png"), false);
  assert.equal(matchesDocumentContent(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), "image/png"), true);
  for (const header of ["0", "-1", "bad", String(PRIVATE_GATEWAY_MAX_BYTES + 1), "999"]) {
    await assert.rejects(readPrivateUploadBody(new Request("http://localhost", { method: "PUT", body: bytes, headers: { "content-length": header } }), AbortSignal.timeout(1000)), RangeError);
  }
  await assert.rejects(readPrivateUploadBody(new Request("http://localhost", { method: "PUT", body: Buffer.alloc(PRIVATE_GATEWAY_MAX_BYTES + 1) }), AbortSignal.timeout(1000)), RangeError);
});

test("a stalled upload aborts its reader instead of leaving file transfer pending", async () => {
  let canceled = false;
  const body = new ReadableStream<Uint8Array>({ cancel() { canceled = true; } });
  const request = new Request("http://localhost", { method: "PUT", body, duplex: "half" } as RequestInit);
  const controller = new AbortController();
  const pending = readPrivateUploadBody(request, controller.signal);
  controller.abort(new DOMException("Upload timed out", "TimeoutError"));
  await assert.rejects(pending, { name: "TimeoutError" });
  assert.equal(canceled, true);
});
