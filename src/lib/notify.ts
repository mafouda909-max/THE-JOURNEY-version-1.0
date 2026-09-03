import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, notifications } from "@/db/schema";

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
}): Promise<void> {
  try {
    await db.insert(notifications).values({
      accountId: params.accountId,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link ?? null,
      idempotencyKey: `${params.type}:${params.targetId ?? 0}:${dayStamp()}`,
    });
  } catch {
    /* unique-violation = already delivered for this event today */
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
