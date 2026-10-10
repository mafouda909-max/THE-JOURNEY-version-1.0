import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { buildPoolConfig } from "../src/db";
import { selectDatabaseUrl } from "../src/lib/database-environment";
import { PASSWORD_PILOT_MIGRATIONS, passwordAuthSchemaReady } from "../src/lib/password-auth-schema";
import {
  passwordPilotPreparationMode,
  validatePasswordPilotDatabaseIdentity,
} from "../src/lib/password-pilot-preparation";

async function main() {
  // Explicit deployment preparation only. Routes never create their own schema.
  // Production and Preview have separate gates so a Preview QA preparation can
  // never be enabled by the Production migration flag (or vice versa).
  const preparationMode = passwordPilotPreparationMode(process.env);
  if (!preparationMode) return;
  if (!/^[a-f0-9]{64}$/.test(process.env.PASSWORD_AUTH_RATE_LIMIT_SECRET ?? "")) {
    throw new Error("Password pilot throttle secret is not configured.");
  }
  const url = new URL(selectDatabaseUrl());
  if (!url.hostname.endsWith(".neon.tech")) throw new Error("Password pilot preparation requires a managed Neon database.");
  // DDL uses the same physical database and credentials over a direct TLS connection.
  url.hostname = url.hostname.replace(/-pooler(?=\.)/, "");
  const client = new Pool(buildPoolConfig(url.toString()));
  try {
    const identity = await client.query(
      "SELECT current_setting('neon.project_id', true) AS project, current_setting('neon.branch_id', true) AS branch",
    );
    validatePasswordPilotDatabaseIdentity({
      projectId: String(identity.rows[0]?.project ?? ""),
      branchId: String(identity.rows[0]?.branch ?? ""),
    });
    for (const migration of PASSWORD_PILOT_MIGRATIONS) {
      await client.query(readFileSync(migration, "utf8"));
    }
    const directDatabase = drizzle(client);
    if (!await passwordAuthSchemaReady((statement) => directDatabase.execute(statement))) {
      throw new Error("Account page schema prerequisites are missing.");
    }
    console.log(
      `Password pilot ${preparationMode} schema preparation completed; existing accounts and requests preserved.`,
    );
  } finally {
    await client.end();
  }
}

main().catch(() => {
  // Database exceptions can contain credentials or user values. Do not print them.
  console.error("Password pilot preparation failed. Activation remains blocked; inspect configuration and migration prerequisites.");
  process.exitCode = 1;
});
