import "server-only";
import { pool } from "@/db";
import type { Pool } from "pg";
import type { ReadinessAdvisorResult } from "@/lib/readiness-advisor";
import type { AdvisorDecisionDossier } from "@/lib/readiness-decision-dossier";
import type { TravelReadinessInput, TravelReadinessResult } from "@/lib/travel-readiness";
import {
  buildSavedReadinessState,
  mergeSavedReadinessIntoSnapshot,
  publicSavedReadinessSummary,
  savedReadinessFromSnapshot,
  type SavedReadinessPublicSummary,
  type SavedReadinessState,
} from "@/lib/traveler-readiness-memory";

export interface OwnedSavedIntentReadiness {
  id: number;
  label: string;
  snapshot: Record<string, unknown>;
  readiness: SavedReadinessState | null;
}

function asSnapshot(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function loadOwnedSavedIntentReadiness(
  intentId: number,
  accountId: number,
  database: Pick<Pool, "query"> = pool,
): Promise<OwnedSavedIntentReadiness | null> {
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
  const snapshot = asSnapshot(row.intent_snapshot);
  return {
    id: row.id,
    label: row.label,
    snapshot,
    readiness: savedReadinessFromSnapshot(snapshot),
  };
}

export async function persistOwnedSavedIntentReadiness(
  input: {
    intentId: number;
    accountId: number;
    readinessInput: TravelReadinessInput;
    result: TravelReadinessResult;
    advisor: ReadinessAdvisorResult;
    dossier: AdvisorDecisionDossier;
  },
  database: Pick<Pool, "connect"> = pool,
): Promise<SavedReadinessPublicSummary | null> {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const owned = await client.query<{
      intent_snapshot: unknown;
    }>(
      `SELECT intent_snapshot
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

    const snapshot = asSnapshot(row.intent_snapshot);
    const previous = savedReadinessFromSnapshot(snapshot);
    const state = buildSavedReadinessState(
      previous,
      input.readinessInput,
      input.result,
      input.advisor,
      input.dossier,
    );
    const nextSnapshot = mergeSavedReadinessIntoSnapshot(snapshot, state);

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
    return publicSavedReadinessSummary(input.intentId, state);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
