import { pool } from "@/db";

export type TravelerMemoryRuntimeStatus = "READY" | "BLOCKED" | "UNAVAILABLE";

export interface TravelerMemoryRuntimeResult {
  service: "traveler-memory-runtime";
  status: TravelerMemoryRuntimeStatus;
  safeToEnable: boolean;
  featureEnabled: boolean;
  active: boolean;
  database: {
    connected: boolean;
    managedNeon: boolean;
    branchIdentityPresent: boolean;
    notLegacy: boolean;
  };
  schema: {
    ready: boolean;
    checkedTables: number;
    missingCount: number;
  };
  checkedAt: string;
}

const LEGACY_NEON_PROJECT_ID = "late-mountain-20124572";

const REQUIRED_MEMORY_SCHEMA: Record<string, string[]> = {
  accounts: ["id", "role"],
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
  contact_requests: ["id", "traveler_account_id"],
};

export async function probeTravelerMemoryRuntime(): Promise<TravelerMemoryRuntimeResult> {
  const checkedAt = new Date().toISOString();
  const featureEnabled = process.env.TRAVELER_WORKSPACE_ENABLED === "true";

  try {
    const identity = await pool.query<{ project_id: string | null; branch_id: string | null }>({
      text: `select current_setting('neon.project_id', true) as project_id,
                    current_setting('neon.branch_id', true) as branch_id`,
      query_timeout: 5000,
    });

    const projectId = identity.rows[0]?.project_id?.trim() || "";
    const branchId = identity.rows[0]?.branch_id?.trim() || "";
    const managedNeon = Boolean(projectId);
    const branchIdentityPresent = Boolean(branchId);
    const notLegacy = Boolean(projectId && projectId !== LEGACY_NEON_PROJECT_ID);

    const schemaResult = await pool.query<{ table_name: string; column_name: string }>({
      text: `select table_name, column_name
             from information_schema.columns
             where table_schema = 'public'
               and table_name = any($1::text[])
             order by table_name, ordinal_position`,
      values: [Object.keys(REQUIRED_MEMORY_SCHEMA)],
      query_timeout: 5000,
    });

    const actual = new Map<string, Set<string>>();
    for (const row of schemaResult.rows) {
      if (!actual.has(row.table_name)) actual.set(row.table_name, new Set());
      actual.get(row.table_name)!.add(row.column_name);
    }

    let missingCount = 0;
    for (const [table, columns] of Object.entries(REQUIRED_MEMORY_SCHEMA)) {
      const actualColumns = actual.get(table);
      if (!actualColumns) {
        missingCount += columns.length;
        continue;
      }
      for (const column of columns) {
        if (!actualColumns.has(column)) missingCount += 1;
      }
    }

    const schemaReady = missingCount === 0;
    const safeToEnable = managedNeon && branchIdentityPresent && notLegacy && schemaReady;
    const status: TravelerMemoryRuntimeStatus = safeToEnable ? "READY" : "BLOCKED";

    return {
      service: "traveler-memory-runtime",
      status,
      safeToEnable,
      featureEnabled,
      active: safeToEnable && featureEnabled,
      database: {
        connected: true,
        managedNeon,
        branchIdentityPresent,
        notLegacy,
      },
      schema: {
        ready: schemaReady,
        checkedTables: Object.keys(REQUIRED_MEMORY_SCHEMA).length,
        missingCount,
      },
      checkedAt,
    };
  } catch {
    return {
      service: "traveler-memory-runtime",
      status: "UNAVAILABLE",
      safeToEnable: false,
      featureEnabled,
      active: false,
      database: {
        connected: false,
        managedNeon: false,
        branchIdentityPresent: false,
        notLegacy: false,
      },
      schema: {
        ready: false,
        checkedTables: Object.keys(REQUIRED_MEMORY_SCHEMA).length,
        missingCount: 0,
      },
      checkedAt,
    };
  }
}
