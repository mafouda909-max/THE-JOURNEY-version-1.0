import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { buildPoolConfig } from "../src/db";
import { selectDatabaseUrl } from "../src/lib/database-environment";

async function main() {
  // Explicit deployment preparation only. Routes never create their own schema.
  if (process.env.VERCEL_ENV !== "production" || process.env.PASSWORD_PILOT_PREPARE_ENABLED !== "true") return;
  if (!/^[a-f0-9]{64}$/.test(process.env.PASSWORD_AUTH_RATE_LIMIT_SECRET ?? "")) {
    throw new Error("Password pilot throttle secret is not configured.");
  }
  const url = new URL(selectDatabaseUrl());
  if (!url.hostname.endsWith(".neon.tech")) throw new Error("Password pilot preparation requires the managed production database.");
  // DDL uses the same physical database and credentials over a direct TLS connection.
  url.hostname = url.hostname.replace(/-pooler(?=\.)/, "");
  const client = new Pool(buildPoolConfig(url.toString()));
  try {
    const identity = await client.query("SELECT current_setting('neon.project_id', true) AS project");
    if (!identity.rows[0]?.project || identity.rows[0].project === "late-mountain-20124572") {
      throw new Error("Refusing password pilot preparation on an unknown or legacy database.");
    }
    await client.query(readFileSync("db/password_pilot_auth.sql", "utf8"));
    console.log("Password pilot additive schema preparation completed; existing accounts preserved.");
  } finally {
    await client.end();
  }
}

main().catch(() => {
  // Database exceptions can contain credentials or user values. Do not print them.
  console.error("Password pilot preparation failed. Activation remains blocked; inspect configuration and migration prerequisites.");
  process.exitCode = 1;
});
