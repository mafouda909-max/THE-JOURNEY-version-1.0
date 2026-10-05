import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { test } from "node:test";
import { Client } from "pg";

const databaseUrl = process.env.COMMERCIAL_WORKFLOW_TEST_DATABASE_URL;

test("private evidence requires a real transfer, matching HEAD and committed database audit", { skip: !databaseUrl }, async () => {
  const parsed = new URL(databaseUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(parsed.hostname));
  assert.equal(parsed.pathname, "/journey_phase1");
  assert.equal(process.env.DATABASE_URL, databaseUrl);
  // Local S3 transport fixture: real signer/SDK HTTP calls and production DB
  // code, never a production storage provider or proof of production privacy.
  const objects = new Map<string, { bytes: Buffer; type: string }>();
  let unavailable = false;
  let corsUnavailable = false;
  let corsReadDenied = false;
  let bucketPublic = false;
  let corsWrites = 0;
  let corsXml = '<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><CORSRule><ID>existing-download</ID><AllowedOrigin>https://another.example</AllowedOrigin><AllowedMethod>GET</AllowedMethod><AllowedHeader>range</AllowedHeader></CORSRule></CORSConfiguration>';
  const server = createServer(async (request, response) => {
    const url = new URL(request.url!, "http://localhost");
    const signed = url.searchParams.get("X-Amz-Credential")?.startsWith("sila-evidence-test/") ||
      request.headers.authorization?.includes("Credential=sila-evidence-test/");
    if (!signed) { response.writeHead(403).end(); return; }
    if (unavailable) { response.writeHead(503).end(); return; }
    if (url.searchParams.has("acl")) {
      assert.equal(request.method, "GET", "Preparation must never write ACLs");
      response.writeHead(200, { "content-type": "application/xml" }).end(`<AccessControlPolicy xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Owner><ID>fixture-owner</ID></Owner><AccessControlList><Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="CanonicalUser"><ID>fixture-owner</ID></Grantee><Permission>FULL_CONTROL</Permission></Grant>${bucketPublic ? '<Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="Group"><URI>http://acs.amazonaws.com/groups/global/AllUsers</URI></Grantee><Permission>READ</Permission></Grant>' : ''}</AccessControlList></AccessControlPolicy>`);
      return;
    }
    if (url.searchParams.has("cors")) {
      if (corsReadDenied) { response.writeHead(403, { "content-type": "application/xml" }).end('<Error><Code>AccessDenied</Code></Error>'); return; }
      if (request.method === "PUT") {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        corsXml = Buffer.concat(chunks).toString();
        corsWrites += 1;
        response.writeHead(200).end(); return;
      }
      response.writeHead(200, { "content-type": "application/xml" }).end(corsXml); return;
    }
    if (request.method === "OPTIONS") {
      if (corsUnavailable) { response.writeHead(403).end(); return; }
      response.writeHead(200, { "access-control-allow-origin": request.headers.origin!, "access-control-allow-methods": "PUT", "access-control-allow-headers": "content-type" }).end();
      return;
    }
    const key = decodeURIComponent(url.pathname);
    if (request.method === "PUT") {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      objects.set(key, { bytes: Buffer.concat(chunks), type: String(request.headers["content-type"]) });
      response.writeHead(200).end(); return;
    }
    const object = objects.get(key);
    if (!object) { response.writeHead(404).end(); return; }
    response.writeHead(200, { "content-length": object.bytes.length, "content-type": object.type });
    response.end(request.method === "HEAD" ? undefined : object.bytes);
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const variables = {
    B2_ENDPOINT: `http://127.0.0.1:${address.port}`, B2_BUCKET_NAME: "sila-private-evidence-test",
    B2_KEY_ID: "sila-evidence-test", B2_APPLICATION_KEY: "fixture-only-never-production",
  };
  const previous = Object.fromEntries(Object.keys(variables).map(key => [key, process.env[key]]));
  Object.assign(process.env, variables);
  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();
  let pool: { end(): Promise<void> } | undefined;
  try {
    await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await client.query(readFileSync("db/production_schema.sql", "utf8"));
    const { POST, GET, PATCH } = await import("../src/app/api/agent-verification/route");
    const { PUT } = await import("../src/app/api/agent-verification/upload/route");
    const { POST: legacyConfirm } = await import("../src/app/api/agent-verification/confirm/route");
    pool = (await import("../src/db")).pool;
    const { preparePrivateStorageCors } = await import("../src/lib/b2");
    bucketPublic = true;
    await assert.rejects(preparePrivateStorageCors());
    assert.equal(corsWrites, 0);
    bucketPublic = false;
    corsReadDenied = true;
    await assert.rejects(preparePrivateStorageCors());
    assert.equal(corsWrites, 0);
    corsReadDenied = false;
    assert.deepEqual(await preparePrivateStorageCors(), { changed: true });
    assert.equal(corsWrites, 1);
    assert.match(corsXml, /https:\/\/another.example/);
    assert.match(corsXml, /https:\/\/the-journey-version-1-0.vercel.app/);
    assert.deepEqual(await preparePrivateStorageCors(), { changed: false });
    assert.equal(corsWrites, 1);
    const agent = (await client.query<{ id: number }>(`INSERT INTO agents(display_name,latin_name,bio,photo_url,city,country,license_type,verification_status,specialty_tags,languages,response_rate,avg_response_hours,total_trips)
      VALUES('Private evidence QA','Private evidence QA','Fixture only','https://example.invalid/a','QA','QA','individual','pending','{}','{Arabic}',0,0,0) RETURNING id`)).rows[0];
    const account = (await client.query<{ id: number }>(`INSERT INTO accounts(email,password_hash,role,display_name,agent_id)
      VALUES($1,'disabled$fixture','agent','Private evidence QA',$2) RETURNING id`, [`evidence-${randomUUID()}@example.invalid`, agent.id])).rows[0];
    const token = randomUUID();
    await client.query("INSERT INTO sessions(token,account_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')", [token, account.id]);
    const headers = { "content-type": "application/json", cookie: `tj_sess=${token}` };
    const call = (body: object, legacy = false) => (legacy ? legacyConfirm : POST)(new Request("http://localhost/api/agent-verification", { method: "POST", headers, body: JSON.stringify(body) }));
    const bytes = Buffer.from("%PDF-1.4\nPrivate evidence transfer fixture only\n%%EOF");
    const profile = { displayName: "Changed QA", latinName: "Changed QA", bio: "Private professional profile save fixture only, never commercial.", city: "Test", country: "Test", licenseType: "individual", licenseNumber: "" };
    await client.query(`CREATE FUNCTION reject_profile_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.action='agent_profile_updated' THEN RAISE EXCEPTION 'QA audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_profile_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION reject_profile_audit();`);
    await assert.rejects(PATCH(new Request("http://localhost/api/agent-verification", { method: "PATCH", headers, body: JSON.stringify(profile) })));
    assert.equal((await client.query("SELECT display_name FROM agents WHERE id=$1", [agent.id])).rows[0].display_name, "Private evidence QA");
    await client.query("DROP TRIGGER reject_profile_audit ON audit_log; DROP FUNCTION reject_profile_audit();");
    assert.equal((await PATCH(new Request("http://localhost/api/agent-verification", { method: "PATCH", headers, body: JSON.stringify(profile) }))).status, 200);
    corsUnavailable = true;
    assert.equal((await call({ documentType: "identity", originalName: "large-fixture-only.pdf", contentType: "application/pdf", contentLength: 4 * 1024 * 1024 })).status, 503);
    assert.equal((await client.query("SELECT count(*)::int AS count FROM agent_documents")).rows[0].count, 0);
    await client.query(`CREATE FUNCTION reject_reservation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.action='kyc_document_upload_started' THEN RAISE EXCEPTION 'QA audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_reservation_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION reject_reservation_audit();`);
    await assert.rejects(call({ documentType: "identity", originalName: "fixture-only.pdf", contentType: "application/pdf", contentLength: bytes.length }));
    assert.equal((await client.query("SELECT count(*)::int AS count FROM agent_documents")).rows[0].count, 0);
    await client.query("DROP TRIGGER reject_reservation_audit ON audit_log; DROP FUNCTION reject_reservation_audit();");
    // Small uploads use the owned gateway even while provider CORS is denied.
    const reservation = await call({ documentType: "identity", originalName: "fixture-only.pdf", contentType: "application/pdf", contentLength: bytes.length });
    assert.equal(reservation.status, 200);
    const reserved = await reservation.json();
    const documentId = reserved.document.id;
    assert.equal(reserved.upload.transport, "same_origin");
    assert.equal(reserved.upload.uploadUrl, `/api/agent-verification/upload?documentId=${documentId}`);
    const transfer = (type = "application/pdf", payload = bytes, origin = "http://localhost", cookie = headers.cookie) => PUT(new Request(`http://localhost${reserved.upload.uploadUrl}`, { method: "PUT", headers: { "content-type": type, origin, cookie }, body: payload }));
    const state = async () => (await client.query("SELECT status FROM agent_documents WHERE id=$1", [documentId])).rows[0].status;
    assert.equal(await state(), "uploading");
    assert.equal((await call({ action: "confirm", documentId })).status, 422);
    assert.equal(await state(), "uploading");
    unavailable = true;
    assert.equal((await transfer()).status, 503);
    assert.equal((await call({ action: "confirm", documentId })).status, 503);
    assert.equal(await state(), "uploading");
    unavailable = false;
    assert.equal((await transfer("text/html")).status, 422);
    assert.equal((await transfer("image/png")).status, 422);
    assert.equal((await transfer("application/pdf", bytes, "https://evil.example")).status, 403);
    assert.equal((await transfer("application/pdf", bytes, "http://localhost", "")).status, 401);
    assert.equal((await transfer("application/pdf", Buffer.alloc(3 * 1024 * 1024 + 1))).status, 413);
    await client.query("UPDATE agent_documents SET created_at=NOW()-INTERVAL '11 minutes' WHERE id=$1", [documentId]);
    assert.equal((await transfer()).status, 409, "Expired upload reservations do not authorize a new transfer");
    await client.query("UPDATE agent_documents SET created_at=NOW() WHERE id=$1", [documentId]);
    const storageKey = (await client.query("SELECT storage_key FROM agent_documents WHERE id=$1", [documentId])).rows[0].storage_key;
    await client.query("UPDATE agent_documents SET storage_key='kyc/agent_999999/identity_other' WHERE id=$1", [documentId]);
    assert.equal((await transfer()).status, 409, "A wrong namespace never reaches the provider");
    await client.query("UPDATE agent_documents SET storage_key=$2 WHERE id=$1", [documentId, storageKey]);
    corsUnavailable = false;
    const signed = await (await import("../src/lib/b2")).createPrivateUploadUrl(storageKey, "text/html", bytes.length);
    assert.equal((await fetch(signed.uploadUrl, { method: "PUT", headers: { "content-type": "text/html" }, body: bytes })).status, 200);
    assert.equal((await call({ action: "confirm", documentId })).status, 422);
    assert.equal(await state(), "uploading");
    corsUnavailable = true;
    assert.equal((await transfer()).status, 200);
    assert.equal(await state(), "uploading", "A real transfer is not yet database confirmation");
    const privateUrl = new URL(signed.uploadUrl); privateUrl.search = "";
    assert.equal((await fetch(privateUrl)).status, 403);
    // Audit failure must roll back the document and agent transitions.
    await client.query(`CREATE FUNCTION reject_evidence_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.action='kyc_document_upload_confirmed' THEN RAISE EXCEPTION 'QA audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_evidence_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION reject_evidence_audit();`);
    await assert.rejects(call({ action: "confirm", documentId }));
    assert.equal(await state(), "uploading");
    assert.equal((await client.query("SELECT verification_status FROM agents WHERE id=$1", [agent.id])).rows[0].verification_status, "pending");
    await client.query("DROP TRIGGER reject_evidence_audit ON audit_log; DROP FUNCTION reject_evidence_audit();");
    const confirmation = await call({ action: "confirm", documentId });
    assert.equal(confirmation.status, 200);
    assert.equal((await confirmation.json()).stored, true);
    assert.equal(await state(), "pending");
    assert.equal((await client.query("SELECT verification_status FROM agents WHERE id=$1", [agent.id])).rows[0].verification_status, "in_review");
    const reopened = await GET(new Request("http://localhost/api/agent-verification", { headers }));
    assert.equal((await reopened.json()).documents[0].status, "pending");
    assert.equal((await call({ documentId }, true)).status, 200);
    assert.equal((await transfer()).status, 409, "Pending/reviewed evidence cannot be overwritten through the gateway");
    assert.equal((await client.query("SELECT count(*)::int AS count FROM audit_log WHERE action='kyc_document_upload_confirmed' AND target_id=$1", [agent.id])).rows[0].count, 1);
    const outsiderAgent = (await client.query<{ id: number }>(`INSERT INTO agents(display_name,latin_name,bio,photo_url,city,country,license_type,verification_status,specialty_tags,languages,response_rate,avg_response_hours,total_trips)
      VALUES('Other QA agent','Other QA agent','Fixture only','https://example.invalid/a','QA','QA','individual','pending','{}','{Arabic}',0,0,0) RETURNING id`)).rows[0];
    const outsider = (await client.query<{ id: number }>(`INSERT INTO accounts(email,password_hash,role,display_name,agent_id)
      VALUES($1,'disabled$fixture','agent','Other QA agent',$2) RETURNING id`, [`other-${randomUUID()}@example.invalid`, outsiderAgent.id])).rows[0];
    const otherToken = randomUUID();
    await client.query("INSERT INTO sessions(token,account_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')", [otherToken, outsider.id]);
    for (const confirm of [POST, legacyConfirm]) {
      assert.equal((await confirm(new Request("http://localhost/api/agent-verification", { method: "POST", headers: { ...headers, cookie: `tj_sess=${otherToken}` }, body: JSON.stringify({ action: "confirm", documentId }) }))).status, 404);
    }
    assert.equal((await transfer("application/pdf", bytes, "http://localhost", `tj_sess=${otherToken}`)).status, 404);
    assert.equal((await POST(new Request("http://localhost/api/agent-verification", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "confirm", documentId }) }))).status, 401);
  } finally {
    if (pool) await pool.end();
    await client.end();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
