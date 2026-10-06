import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { buildPoolConfig } from "../src/db";
import { selectDatabaseUrl } from "../src/lib/database-environment";

const LEGACY_NEON_PROJECT_ID = "late-mountain-20124572";
const MIGRATION_PATH = "db/phase6_traveler_workspace.sql";
const APPLY_FLAG = "--apply";
const OWNER_APPROVAL_ENV = "TRAVELER_WORKSPACE_MIGRATION_OWNER_APPROVED";

const REQUIRED_PREREQUISITES: Record<string, string[]> = {
  accounts: ["id"],
  offers: ["id"],
  contact_requests: ["id", "traveler_account_id"],
};

const REQUIRED_WORKSPACE_SCHEMA: Record<string, string[]> = {
  traveler_saved_intents: [
    "id",
    "account_id",
    "label",
    "intent_snapshot",
    "status",
    "created_at",
    "updated_at",
  ],
  traveler_intent_offers: ["saved_intent_id", "offer_id", "position", "created_at"],
  traveler_intent_inquiries: ["saved_intent_id", "contact_request_id", "created_at"],
};

type SchemaProbe = {
  ready: boolean;
  missingCount: number;
};

async function schemaProbe(client: Pool, required: Record<string, string[]>): Promise<SchemaProbe> {
  const result = await client.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name
       from information_schema.columns
      where table_schema = 'public'
        and table_name = any($1::text[])
      order by table_name, ordinal_position`,
    [Object.keys(required)],
  );

  const actual = new Map<string, Set<string>>();
  for (const row of result.rows) {
    if (!actual.has(row.table_name)) actual.set(row.table_name, new Set());
    actual.get(row.table_name)!.add(row.column_name);
  }

  let missingCount = 0;
  for (const [table, columns] of Object.entries(required)) {
    const actualColumns = actual.get(table);
    if (!actualColumns) {
      missingCount += columns.length;
      continue;
    }
    for (const column of columns) {
      if (!actualColumns.has(column)) missingCount += 1;
    }
  }

  return { ready: missingCount === 0, missingCount };
}

async function main() {
  const apply = process.argv.includes(APPLY_FLAG);

  if (apply && process.env[OWNER_APPROVAL_ENV] !== "true") {
    throw new Error("Owner approval flag is required before applying the traveler workspace migration.");
  }

  const url = new URL(selectDatabaseUrl());
  if (!url.hostname.endsWith(".neon.tech")) {
    throw new Error("Traveler workspace migration requires the managed Neon production database.");
  }

  // Migrations use a direct connection to the same physical Neon database.
  // Never run DDL through transaction pooling.
  url.hostname = url.hostname.replace(/-pooler(?=\.)/, "");

  const client = new Pool({
    ...buildPoolConfig(url.toString()),
    max: 1,
  });

  try {
    const identity = await client.query<{ project_id: string | null; branch_id: string | null }>(
      `select current_setting('neon.project_id', true) as project_id,
              current_setting('neon.branch_id', true) as branch_id`,
    );

    const projectId = identity.rows[0]?.project_id?.trim() || "";
    const branchId = identity.rows[0]?.branch_id?.trim() || "";

    if (!projectId || !branchId || projectId === LEGACY_NEON_PROJECT_ID) {
      throw new Error("Refusing traveler workspace migration on an unknown or legacy database.");
    }

    const prerequisites = await schemaProbe(client, REQUIRED_PREREQUISITES);
    if (!prerequisites.ready) {
      throw new Error("Traveler workspace migration prerequisites are incomplete.");
    }

    const before = await schemaProbe(client, REQUIRED_WORKSPACE_SCHEMA);
    if (before.ready) {
      console.log("TRAVELER WORKSPACE MIGRATION: ALREADY READY");
      console.log("No schema changes are required.");
      return;
    }

    if (!apply) {
      console.log("TRAVELER WORKSPACE MIGRATION: READY TO APPLY");
      console.log(`Dry-run only. Workspace schema is missing ${before.missingCount} required table/column elements.`);
      console.log(`Re-run with ${APPLY_FLAG} only after Owner approval is explicit.`);
      return;
    }

    await client.query(readFileSync(MIGRATION_PATH, "utf8"));

    const after = await schemaProbe(client, REQUIRED_WORKSPACE_SCHEMA);
    if (!after.ready) {
      throw new Error("Traveler workspace schema verification failed after migration.");
    }

    console.log("TRAVELER WORKSPACE MIGRATION: APPLIED AND VERIFIED");
    console.log("Phase 6 traveler workspace schema is ready; no existing data was deleted.");
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch(() => {
  // Never print database exceptions: they can contain credentials or user data.
  console.error("Traveler workspace migration guard failed. Production activation remains blocked.");
  process.exitCode = 1;
});
