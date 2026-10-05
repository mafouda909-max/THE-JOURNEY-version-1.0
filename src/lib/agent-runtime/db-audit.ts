import "server-only";

import { db } from "@/db";
import { auditLog } from "@/db/schema";
import type { AgentAuditEvent } from "./contracts";

function safeActor(event: AgentAuditEvent): string {
  const role = event.actor.role;
  const accountId = event.actor.accountId;
  const label =
    typeof accountId === "number" && Number.isInteger(accountId)
      ? `${role}:${accountId}`
      : role;
  return label.slice(0, 48);
}

function safeErrorCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return /^[A-Z0-9_.:-]{1,120}$/.test(value) ? value : "TOOL_EXECUTION_FAILED";
}

function safeReasons(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const reasons = value
    .filter((item): item is string => typeof item === "string")
    .slice(0, 5)
    .map((item) => item.slice(0, 180));
  return reasons.length > 0 ? reasons : undefined;
}

/**
 * Persist agent runtime events into SILA's existing audit_log without copying
 * request inputs, provider outputs, prompts, or other potentially sensitive
 * payloads into the audit trail.
 */
export async function persistAgentAuditEvent(
  event: AgentAuditEvent,
): Promise<void> {
  const metadata = event.metadata ?? {};
  const boundedMeta = {
    eventId: event.eventId.slice(0, 180),
    requestId: event.requestId.slice(0, 180),
    callId: event.callId?.slice(0, 180),
    toolName: event.toolName?.slice(0, 80),
    outcome: event.outcome,
    evidenceCount:
      typeof metadata.evidenceCount === "number"
        ? Math.max(0, Math.min(1000, Math.trunc(metadata.evidenceCount)))
        : undefined,
    reasons: safeReasons(metadata.reasons),
    errorCode: safeErrorCode(metadata.error),
  };

  await db.insert(auditLog).values({
    actor: safeActor(event),
    action: "agent_tool_runtime",
    targetType: "agent_run",
    targetId:
      typeof event.actor.accountId === "number" &&
      Number.isInteger(event.actor.accountId)
        ? event.actor.accountId
        : 0,
    reason: event.toolName
      ? `Agent runtime ${event.outcome}: ${event.toolName}`.slice(0, 240)
      : `Agent runtime ${event.outcome}`.slice(0, 240),
    prevState: null,
    newState: event.outcome.slice(0, 24),
    meta: JSON.stringify(boundedMeta),
  });
}
