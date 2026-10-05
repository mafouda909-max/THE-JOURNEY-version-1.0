import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, notifications } from "@/db/schema";
import { capabilityRuntime } from "@/lib/capabilities/production";

/**
 * Notification service — in-app now, provider-agnostic email seam later.
 *
 * Guarantees: typed by event name, idempotent by (type+target+day) key,
 * never throws into the calling business action (notifications are
 * side-effects, not blockers).
 */

const dayStamp = () => new Date().toISOString().slice(0, 10);

export async function notify(params: {
  accountId: number;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  targetId?: number | null;
  dedupeScope?: string | null;
}): Promise<boolean> {
  const scope = params.dedupeScope
    ? createHash("sha256").update(params.dedupeScope).digest("hex").slice(0, 16)
    : "default";
  try {
    const inserted = await capabilityRuntime.call("notifications", "system", () => db.insert(notifications).values({
      accountId: params.accountId,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link ?? null,
      idempotencyKey: `${params.accountId}:${params.type}:${params.targetId ?? 0}:${scope}:${dayStamp()}`,
    }).onConflictDoNothing().returning({ id: notifications.id }));
    return inserted.length > 0;
  } catch {
    // Notifications are optional side effects; provider failure cannot block
    // the business action. Expected duplicates succeed with zero inserted rows.
    return false;
  }
}

/** Resolve the account bound to an agent profile (null for legacy agents). */
export async function accountIdForAgent(agentId: number): Promise<number | null> {
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.agentId, agentId))
    .limit(1);
  return rows[0]?.id ?? null;
}
