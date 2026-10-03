import crypto from "node:crypto";
import { Client } from "pg";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const out = [];
const result = (gate, status, detail = {}) => out.push({ gate, status, ...detail });
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);

function configured(names) {
  return names.every((name) => typeof process.env[name] === "string" && process.env[name].trim().length > 0);
}

async function probeDatabase() {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    result("database", "NOT_CONFIGURED");
    return { identityVerified: false };
  }
  const parsed = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    result("database", "FAILED", { reason: "INVALID_SCHEME" });
    return { identityVerified: false };
  }
  const hostFingerprint = sha(parsed.hostname + "|" + parsed.pathname);
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) parsed.searchParams.delete(key);
  const client = new Client({
    connectionString: parsed.toString(),
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: true },
  });
  try {
    await client.connect();
    const meta = await client.query(`
      select
        current_database() as database_name,
        current_user as role_name,
        version() as version,
        current_setting('neon.project_id', true) as neon_project_id,
        current_setting('neon.branch_id', true) as neon_branch_id,
        has_schema_privilege(current_user, 'public', 'USAGE') as schema_usage,
        has_schema_privilege(current_user, 'public', 'CREATE') as schema_create,
        has_table_privilege(current_user, 'public.accounts', 'SELECT,INSERT,UPDATE') as accounts_rw,
        has_table_privilege(current_user, 'public.offers', 'SELECT,INSERT,UPDATE') as offers_rw
    `);
    const row = meta.rows[0] ?? {};
    const expectedProject = process.env.PRODUCTION_NEON_PROJECT_ID?.trim() || "";
    const expectedDbFingerprint = process.env.PRODUCTION_DB_IDENTITY_SHA256?.trim() || "";
    const legacyProject = "late-mountain-20124572";
    const neonProject = String(row.neon_project_id ?? "");
    const isLegacy = neonProject === legacyProject || raw.includes(legacyProject);
    const identityVerified = !isLegacy && (
      (expectedProject && neonProject && expectedProject === neonProject) ||
      (expectedDbFingerprint && expectedDbFingerprint === hostFingerprint)
    );
    result("database", "REACHABLE", {
      tls: "VERIFY_FULL",
      database: String(row.database_name ?? ""),
      role: String(row.role_name ?? ""),
      server: String(row.version ?? "").split(" ").slice(0, 2).join(" "),
      hostFingerprint,
      neonProjectFingerprint: neonProject ? sha(neonProject) : null,
      neonBranchFingerprint: row.neon_branch_id ? sha(String(row.neon_branch_id)) : null,
      permissions: {
        schemaUsage: Boolean(row.schema_usage),
        schemaCreate: Boolean(row.schema_create),
        accountsRw: Boolean(row.accounts_rw),
        offersRw: Boolean(row.offers_rw),
      },
      identityVerified,
      legacyTarget: isLegacy,
    });
    return { identityVerified, neonProject, hostFingerprint };
  } catch (error) {
    result("database", "FAILED", { reason: error instanceof Error ? error.message.slice(0, 180) : "UNKNOWN" });
    return { identityVerified: false };
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function probeGoogle() {
  const names = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "AUTH_ORIGIN"];
  if (!configured(names)) return result("google", "NOT_CONFIGURED");
  const origin = new URL(process.env.AUTH_ORIGIN);
  if (origin.protocol !== "https:") return result("google", "FAILED", { reason: "AUTH_ORIGIN_NOT_HTTPS" });
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: "sila-production-gate-invalid-code",
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: origin.origin + "/api/auth/google/callback",
  });
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = await response.json().catch(() => ({}));
    if (response.status === 400 && json.error === "invalid_grant") {
      return result("google", "CREDENTIALS_ACCEPTED", { origin: origin.origin });
    }
    return result("google", "FAILED", { http: response.status, reason: String(json.error ?? "unexpected_response") });
  } catch (error) {
    return result("google", "FAILED", { reason: error instanceof Error ? error.message.slice(0, 180) : "NETWORK" });
  }
}

async function probeResend() {
  if (!configured(["RESEND_API_KEY"])) return result("resend", "NOT_CONFIGURED");
  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) return result("resend", "FAILED", { http: response.status });
    const domains = Array.isArray(json.data) ? json.data : [];
    const verified = domains.filter((d) => d?.status === "verified").map((d) => String(d.name ?? "")).filter(Boolean);
    return result("resend", verified.length ? "REACHABLE_VERIFIED_DOMAIN" : "REACHABLE_NO_VERIFIED_DOMAIN", {
      verifiedDomainCount: verified.length,
      verifiedDomainFingerprints: verified.map(sha),
      smokeMailboxConfigured: Boolean(process.env.PRODUCTION_SMOKE_EMAIL?.trim()),
    });
  } catch (error) {
    return result("resend", "FAILED", { reason: error instanceof Error ? error.message.slice(0, 180) : "NETWORK" });
  }
}

async function probeB2() {
  const names = ["B2_ENDPOINT", "B2_BUCKET_NAME", "B2_KEY_ID", "B2_APPLICATION_KEY"];
  if (!configured(names)) return result("b2", "NOT_CONFIGURED");
  try {
    const client = new S3Client({
      region: "us-east-005",
      endpoint: process.env.B2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_APPLICATION_KEY,
      },
    });
    const response = await client.send(new ListObjectsV2Command({
      Bucket: process.env.B2_BUCKET_NAME,
      MaxKeys: 1,
      Prefix: "release-gate/",
    }));
    return result("b2", "REACHABLE", {
      bucketFingerprint: sha(process.env.B2_BUCKET_NAME),
      canList: true,
      sampleCount: Array.isArray(response.Contents) ? response.Contents.length : 0,
    });
  } catch (error) {
    return result("b2", "FAILED", { reason: error instanceof Error ? error.name + ":" + error.message.slice(0, 140) : "UNKNOWN" });
  }
}

async function probeAmadeus() {
  const names = ["AMADEUS_CLIENT_ID", "AMADEUS_CLIENT_SECRET"];
  if (!configured(names)) return result("amadeus", "NOT_CONFIGURED");
  const env = (process.env.AMADEUS_ENV || "test").toLowerCase();
  const base = (process.env.AMADEUS_BASE_URL || (env === "production" ? "https://api.amadeus.com" : "https://test.api.amadeus.com")).replace(/\/$/, "");
  try {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.AMADEUS_CLIENT_ID,
      client_secret: process.env.AMADEUS_CLIENT_SECRET,
    });
    const response = await fetch(base + "/v1/security/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.access_token) return result("amadeus", "FAILED", { env, http: response.status });
    return result("amadeus", "TOKEN_OK", { env });
  } catch (error) {
    return result("amadeus", "FAILED", { env, reason: error instanceof Error ? error.message.slice(0, 180) : "NETWORK" });
  }
}

const db = await probeDatabase();
await Promise.all([probeGoogle(), probeResend(), probeB2(), probeAmadeus()]);
console.log("SILA_PRODUCTION_GATE_RESULTS=" + JSON.stringify(out));
if (!db.identityVerified) {
  console.error("PRODUCTION_DB_IDENTITY_NOT_VERIFIED");
  process.exitCode = 12;
}
