import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, agents, communityComments, communityPosts, communityReports } from "@/db/schema";

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


/**
 * Returns comments awaiting human moderation on published posts.
 * Callers must enforce the admin session before exposing this queue.
 */
export async function listPendingCommunityComments(limit = 100) {
  if (!isCommunityEnabled()) return [];

  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
  return db
    .select({
      id: communityComments.id,
      postId: communityComments.postId,
      parentCommentId: communityComments.parentCommentId,
      body: communityComments.body,
      createdAt: communityComments.createdAt,
      author: {
        displayName: accounts.displayName,
        role: accounts.role,
      },
      post: {
        title: communityPosts.title,
      },
    })
    .from(communityComments)
    .innerJoin(accounts, eq(accounts.id, communityComments.authorAccountId))
    .innerJoin(communityPosts, eq(communityPosts.id, communityComments.postId))
    .where(
      and(
        eq(communityComments.status, "pending_review"),
        eq(communityPosts.status, "published"),
      ),
    )
    .orderBy(asc(communityComments.createdAt), asc(communityComments.id))
    .limit(safeLimit);
}


/**
 * Private moderator queue. The caller must enforce an administrator session.
 * Reports are not exposed through public community projections.
 */
export async function listPendingCommunityReports(limit = 100) {
  if (!isCommunityEnabled()) return [];

  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
  return db
    .select({
      id: communityReports.id,
      targetType: communityReports.targetType,
      postId: communityReports.postId,
      commentId: communityReports.commentId,
      category: communityReports.category,
      details: communityReports.details,
      createdAt: communityReports.createdAt,
      reporter: {
        displayName: accounts.displayName,
      },
      postTitle: communityPosts.title,
      commentBody: communityComments.body,
    })
    .from(communityReports)
    .innerJoin(accounts, eq(accounts.id, communityReports.reporterAccountId))
    .leftJoin(communityPosts, eq(communityPosts.id, communityReports.postId))
    .leftJoin(communityComments, eq(communityComments.id, communityReports.commentId))
    .where(eq(communityReports.status, "pending_review"))
    .orderBy(asc(communityReports.createdAt), asc(communityReports.id))
    .limit(safeLimit);
}
