import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agentDocuments } from "@/db/schema";
import type { Agent } from "@/db/schema";
import {
  evaluatePublicAgentTrust,
  type PublicAgentEvidence,
} from "@/lib/public-agent";

export async function loadPublicAgentEvidence(
  agentIds: number[],
): Promise<Map<number, PublicAgentEvidence[]>> {
  const ids = [...new Set(agentIds.filter((id) => Number.isSafeInteger(id) && id > 0))];
  const grouped = new Map<number, PublicAgentEvidence[]>();
  if (ids.length === 0) return grouped;

  const rows = await db
    .select({
      agentId: agentDocuments.agentId,
      documentType: agentDocuments.documentType,
      status: agentDocuments.status,
      verifiedAt: agentDocuments.verifiedAt,
      expiresAt: agentDocuments.expiresAt,
    })
    .from(agentDocuments)
    .where(inArray(agentDocuments.agentId, ids));

  for (const row of rows) {
    const existing = grouped.get(row.agentId) ?? [];
    existing.push(row);
    grouped.set(row.agentId, existing);
  }
  return grouped;
}

export async function hasCurrentPublicAgentTrust(
  agent: Agent,
  observedAt = new Date(),
): Promise<boolean> {
  if (agent.verificationStatus !== "verified") return false;
  const evidence = await loadPublicAgentEvidence([agent.id]);
  return evaluatePublicAgentTrust(
    agent,
    evidence.get(agent.id) ?? [],
    observedAt,
  ).eligible;
}
