import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { Client } from "pg";
import { buildPoolConfig } from "../src/db";
import { selectDatabaseUrl } from "../src/lib/database-environment";
import { validatePasswordPilotDatabaseIdentity } from "../src/lib/password-pilot-preparation";

const suites = [
  { slug: "agency", file: "tests/agency-db.test.ts" },
  { slug: "commercial_e2e", file: "tests/commercial-e2e-db.test.ts" },
  { slug: "commercial_workflow", file: "tests/commercial-workflow-db.test.ts" },
  { slug: "supply_freshness", file: "tests/supply-freshness-db.test.ts" },
  { slug: "traveler_workspace", file: "tests/traveler-workspace-db.test.ts" },
  { slug: "traveler_commercial", file: "tests/traveler-intent-commercial-e2e-db.test.ts" },
] as const;

function directNeonUrl(connectionString: string): URL {
  const url = new URL(connectionString);
  assert.ok(url.hostname.endsWith(".neon.tech"), "Preview agency DB verification requires managed Neon.");
  url.hostname = url.hostname.replace(/-pooler(?=\.)/, "");
  return url;
}

function normalizedNeonHost(connectionString: string): string {
  const url = new URL(connectionString);
  return url.hostname.toLowerCase().replace(/-pooler(?=\.)/, "");
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function testDatabaseUrl(adminUrl: URL, databaseName: string): string {
  const url = new URL(adminUrl.toString());
  url.pathname = `/${encodeURIComponent(databaseName)}`;
  return url.toString();
}

async function runSuite(file: string, connectionString: string): Promise<void> {
  const childEnv = { ...process.env };
  delete childEnv.VERCEL_ENV;
  delete childEnv.SILA_PREVIEW_DATABASE_URL;
  childEnv.NODE_ENV = "test";
  childEnv.DATABASE_URL = connectionString;
  childEnv.POSTGRES_URL = connectionString;
  childEnv.AGENCY_TEST_DATABASE_URL = connectionString;
  childEnv.COMMERCIAL_WORKFLOW_TEST_DATABASE_URL = connectionString;

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "--test", file], {
      cwd: process.cwd(),
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const limit = 64_000;
    child.stdout.on("data", (chunk) => {
      if (stdout.length < limit) stdout += String(chunk).slice(0, limit - stdout.length);
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < limit) stderr += String(chunk).slice(0, limit - stderr.length);
    });
    child.once("error", () => reject(new Error(`Could not start DB verification suite: ${file}`)));
    child.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`DB verification suite failed: ${file}`));
        return;
      }
      const pass = stdout.match(/ℹ pass (\d+)/)?.[1] ?? "?";
      const fail = stdout.match(/ℹ fail (\d+)/)?.[1] ?? "0";
      console.log(`Preview DB suite PASS: ${file} (pass=${pass}, fail=${fail})`);
      resolve();
    });
  });
}

async function cleanupDatabase(client: Client, databaseName: string): Promise<void> {
  await client.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
    [databaseName],
  );
  await client.query(`DROP DATABASE ${quoteIdentifier(databaseName)}`);
}

let verificationStage = "gate";

async function main() {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.SILA_PREVIEW_AGENCY_E2E_VERIFY_ENABLED !== "true"
  ) {
    return;
  }

  verificationStage = "database_selection";
  const previewConnection = selectDatabaseUrl();
  const inheritedConnection = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  assert.ok(inheritedConnection, "Inherited database reference is required for Preview isolation proof.");
  assert.notEqual(
    normalizedNeonHost(previewConnection),
    normalizedNeonHost(inheritedConnection),
    "Agency DB verifier refuses the inherited Production Neon branch.",
  );

  const adminUrl = directNeonUrl(previewConnection);
  const client = new Client(buildPoolConfig(adminUrl.toString()));
  const created = new Set<string>();
  const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase();
  const runId = randomUUID().replace(/-/g, "").slice(0, 8).toLowerCase();

  verificationStage = "database_connect";
  await client.connect();
  try {
    verificationStage = "identity";
    const identity = await client.query(
      "SELECT current_setting('neon.project_id', true) AS project, current_setting('neon.branch_id', true) AS branch",
    );
    validatePasswordPilotDatabaseIdentity({
      projectId: String(identity.rows[0]?.project ?? ""),
      branchId: String(identity.rows[0]?.branch ?? ""),
    });

    for (const suite of suites) {
      verificationStage = `prepare_${suite.slug}`;
      const databaseName = `sila_qa102_${commit}_${runId}_${suite.slug}`.slice(0, 63);
      const existing = await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [databaseName]);
      assert.equal(existing.rowCount, 0, `QA database already exists: ${databaseName}`);

      await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
      created.add(databaseName);

      verificationStage = `run_${suite.slug}`;
      await runSuite(suite.file, testDatabaseUrl(adminUrl, databaseName));

      verificationStage = `cleanup_${suite.slug}`;
      await cleanupDatabase(client, databaseName);
      created.delete(databaseName);
    }

    verificationStage = "complete";
    console.log("Preview agency/commercial DB E2E verification completed; isolated QA databases cleaned.");
  } finally {
    for (const databaseName of created) {
      try {
        await cleanupDatabase(client, databaseName);
      } catch {
        console.error("Preview agency/commercial DB verifier could not clean one self-created QA database.");
      }
    }
    await client.end().catch(() => undefined);
  }
}

main().catch(() => {
  // Raw PostgreSQL/process errors can contain credentials or fixture data.
  console.error(`Preview agency/commercial DB verification failed at stage=${verificationStage}. Release remains blocked.`);
  process.exitCode = 1;
});
