import { cache } from "react";
import { redirect } from "next/navigation";
import { and, count, desc, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  agentDocuments,
  agents,
  contactRequests,
  notifications,
  offers,
} from "@/db/schema";
import { accountFromCookies } from "@/lib/identity";
import type { AgentProfile } from "@/lib/agent-workspace";

export const workspaceAccount = cache(async () => {
  const account = await accountFromCookies();
  if (!account) redirect("/join");
  return account;
});

export const ownedAgent = cache(async (): Promise<AgentProfile | null> => {
  const account = await workspaceAccount();
  if (account.role !== "agent") redirect("/account");
  if (!account.agentId) return null;
  const [agent] = await db
    .select({
      id: agents.id,
      displayName: agents.displayName,
      latinName: agents.latinName,
      bio: agents.bio,
      city: agents.city,
      country: agents.country,
      licenseType: agents.licenseType,
      licenseNumber: agents.licenseNumber,
      verificationStatus: agents.verificationStatus,
    })
    .from(agents)
    .where(eq(agents.id, account.agentId))
    .limit(1);
  return agent ?? null;
});

export const agentWorkspaceCounts = cache(
  async (agentId: number, accountId: number) => {
    const [allOffers, liveOffers, requests, unread] = await Promise.all([
      db
        .select({ status: offers.status, total: count() })
        .from(offers)
        .where(eq(offers.agentId, agentId))
        .groupBy(offers.status),
      db
        .select({ total: count() })
        .from(offers)
        .where(
          and(
            eq(offers.agentId, agentId),
            eq(offers.status, "published"),
            or(isNull(offers.expiresAt), gt(offers.expiresAt, new Date())),
          ),
        ),
      db
        .select({ status: contactRequests.status, total: count() })
        .from(contactRequests)
        .where(eq(contactRequests.agentId, agentId))
        .groupBy(contactRequests.status),
      db
        .select({ total: count() })
        .from(notifications)
        .where(
          and(
            eq(notifications.accountId, accountId),
            isNull(notifications.readAt),
          ),
        ),
    ]);
    return {
      offers: allOffers.reduce((total, row) => total + row.total, 0),
      published: liveOffers[0]?.total ?? 0,
      pendingReview:
        allOffers.find((row) => row.status === "pending_review")?.total ?? 0,
      requests: requests.reduce((total, row) => total + row.total, 0),
      newRequests: requests.find((row) => row.status === "new")?.total ?? 0,
      unread: unread[0]?.total ?? 0,
    };
  },
);

export const WORKSPACE_PAGE_SIZE = 20;
export function workspacePage(value?: string) {
  const page = Number(value ?? 1);
  return Number.isSafeInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
}

export async function ownedOffers(
  agentId: number,
  limit = WORKSPACE_PAGE_SIZE,
  offset = 0,
) {
  return db
    .select()
    .from(offers)
    .where(eq(offers.agentId, agentId))
    .orderBy(desc(offers.createdAt), desc(offers.id))
    .limit(limit)
    .offset(offset);
}
export async function ownedRequests(
  agentId: number,
  limit = WORKSPACE_PAGE_SIZE,
  offset = 0,
) {
  return db
    .select()
    .from(contactRequests)
    .where(eq(contactRequests.agentId, agentId))
    .orderBy(desc(contactRequests.createdAt), desc(contactRequests.id))
    .limit(limit)
    .offset(offset);
}

export async function ownedVerificationSnapshot(agentId: number) {
  const rows = await db
    .select({
      id: agentDocuments.id,
      documentType: agentDocuments.documentType,
      originalName: agentDocuments.originalName,
      status: agentDocuments.status,
      rejectionReason: agentDocuments.rejectionReason,
      expiresAt: agentDocuments.expiresAt,
    })
    .from(agentDocuments)
    .where(eq(agentDocuments.agentId, agentId))
    .orderBy(desc(agentDocuments.createdAt), desc(agentDocuments.id));
  return {
    documents: rows.map((doc) => ({
      ...doc,
      expiresAt: doc.expiresAt?.toISOString() ?? null,
    })),
    observedAt: Date.now(),
  };
}
