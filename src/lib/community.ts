import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, agents, communityPosts } from "@/db/schema";

export type CommunityPostType = "question" | "experience" | "update" | "guide";

export const COMMUNITY_POST_TYPES: Array<{
  key: CommunityPostType;
  label: string;
}> = [
  { key: "question", label: "سؤال" },
  { key: "experience", label: "تجربة" },
  { key: "update", label: "تحديث" },
  { key: "guide", label: "دليل" },
];

export function isCommunityEnabled(): boolean {
  return process.env.COMMUNITY_ENABLED === "true";
}

export async function listPublishedCommunityPosts(params?: {
  limit?: number;
  destinationCountry?: string;
}) {
  if (!isCommunityEnabled()) return [];

  const limit = Math.min(Math.max(params?.limit ?? 20, 1), 50);
  const conditions = [eq(communityPosts.status, "published")];
  if (params?.destinationCountry?.trim()) {
    conditions.push(
      eq(communityPosts.destinationCountry, params.destinationCountry.trim()),
    );
  }

  return db
    .select({
      id: communityPosts.id,
      type: communityPosts.type,
      title: communityPosts.title,
      body: communityPosts.body,
      destinationCountry: communityPosts.destinationCountry,
      destinationCity: communityPosts.destinationCity,
      topic: communityPosts.topic,
      helpfulCount: communityPosts.helpfulCount,
      commentCount: communityPosts.commentCount,
      publishedAt: communityPosts.publishedAt,
      createdAt: communityPosts.createdAt,
      author: {
        accountId: accounts.id,
        displayName: accounts.displayName,
        role: accounts.role,
        agentId: accounts.agentId,
        agentVerificationStatus: agents.verificationStatus,
      },
    })
    .from(communityPosts)
    .innerJoin(accounts, eq(accounts.id, communityPosts.authorAccountId))
    .leftJoin(agents, eq(agents.id, accounts.agentId))
    .where(and(...conditions))
    .orderBy(desc(communityPosts.publishedAt), desc(communityPosts.createdAt))
    .limit(limit);
}
