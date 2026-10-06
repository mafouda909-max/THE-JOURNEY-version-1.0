import "server-only";
import type { Pool } from "pg";
import { pool } from "@/db";
import {
  mergeSilaAdvisorCaseIntoSnapshot,
  removeSilaAdvisorCaseFromSnapshot,
  silaAdvisorCaseFromSnapshot,
} from "@/lib/sila-advisor-memory";
import type { SilaTravelCaseSnapshot } from "@/lib/sila-advisor-travel-case";

export interface OwnedSilaAdvisorMemory {
  intentId: number;
  label: string;
  travelCase: SilaTravelCaseSnapshot | null;
}

function asSnapshot(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function loadOwnedSilaAdvisorMemory(
  intentId: number,
  accountId: number,
  database: Pick<Pool, "query"> = pool,
): Promise<OwnedSilaAdvisorMemory | null> {
  const result = await database.query<{
    id: number;
    label: string;
    intent_snapshot: unknown;
  }>(
    `SELECT id,label,intent_snapshot
       FROM traveler_saved_intents
      WHERE id=$1
        AND account_id=$2
        AND status='active'
      LIMIT 1`,
    [intentId, accountId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    intentId: row.id,
    label: row.label,
    travelCase: silaAdvisorCaseFromSnapshot(row.intent_snapshot),
  };
}

export async function persistOwnedSilaAdvisorMemory(
  input: {
    intentId: number;
    accountId: number;
    travelCase: SilaTravelCaseSnapshot;
  },
  database: Pick<Pool, "connect"> = pool,
): Promise<OwnedSilaAdvisorMemory | null> {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const owned = await client.query<{
      id: number;
      label: string;
      intent_snapshot: unknown;
    }>(
      `SELECT id,label,intent_snapshot
         FROM traveler_saved_intents
        WHERE id=$1
          AND account_id=$2
          AND status='active'
        FOR UPDATE`,
      [input.intentId, input.accountId],
    );
    const row = owned.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return null;
    }

    const nextSnapshot = mergeSilaAdvisorCaseIntoSnapshot(
      asSnapshot(row.intent_snapshot),
      input.travelCase,
    );
    await client.query(
      `UPDATE traveler_saved_intents
          SET intent_snapshot=$3::jsonb,
              updated_at=NOW()
        WHERE id=$1
          AND account_id=$2
          AND status='active'`,
      [input.intentId, input.accountId, JSON.stringify(nextSnapshot)],
    );
    await client.query("COMMIT");
    return {
      intentId: row.id,
      label: row.label,
      travelCase: input.travelCase,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function clearOwnedSilaAdvisorMemory(
  intentId: number,
  accountId: number,
  database: Pick<Pool, "connect"> = pool,
): Promise<boolean> {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const owned = await client.query<{ intent_snapshot: unknown }>(
      `SELECT intent_snapshot
         FROM traveler_saved_intents
        WHERE id=$1
          AND account_id=$2
          AND status='active'
        FOR UPDATE`,
      [intentId, accountId],
    );
    const row = owned.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return false;
    }

    const nextSnapshot = removeSilaAdvisorCaseFromSnapshot(asSnapshot(row.intent_snapshot));
    await client.query(
      `UPDATE traveler_saved_intents
          SET intent_snapshot=$3::jsonb,
              updated_at=NOW()
        WHERE id=$1
          AND account_id=$2
          AND status='active'`,
      [intentId, accountId, JSON.stringify(nextSnapshot)],
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
