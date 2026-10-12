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

export interface CommunityGuidelineTemplate {
  type: CommunityPostType;
  titleExample: string;
  description: string;
  tips: string[];
}

export const COMMUNITY_GUIDELINE_TEMPLATES: CommunityGuidelineTemplate[] = [
  {
    type: "experience",
    titleExample: "مثال: تجربتي في السفر العائلي إلى جورجيا في يونيو ومصاريف الإقامة",
    description: "شارك الخطوات الحقيقية، التكاليف الفعلية، والصعوبات التي واجهتك وكيف تعاملت معها.",
    tips: ["اذكر التواريخ التقريبية للرحلة", "وضح أسعار الإقامة والانتقالات", "أشر إلى أي متطلبات خاصة بالمطار"],
  },
  {
    type: "question",
    titleExample: "مثال: استفسار عن إجراءات الترانزيت الطويل في مطار الدوحة مع أطفال",
    description: "اطرح سؤالك بوضوح مع ذكر جنسيتك ووجهتك حتى يتمكن الأعضاء والوكلاء من إفادتك بدقة.",
    tips: ["حدد مدة الترانزيت وشركة الطيران", "وضح إذا كان الخروج من المطار مطلوباً"],
  },
  {
    type: "guide",
    titleExample: "مثال: دليل الأوراق المطلوبة لاستخراج تأشيرة شنغن لأول مرة",
    description: "لخص الخطوات المنطقية والتفاصيل العملية من واقع المعرفة الموثوقة لتسهيل التجربة على غيرك.",
    tips: ["اعتمد على المتطلبات الرسمية للسفارة", "رتب الخطوات بتسلسل زمني"],
  },
];

export async function listPublishedCommunityPosts(params?: {
  limit?: number;
  destinationCountry?: string;
}) {
  if (!isCommunityEnabled()) return [];

  const limit = Math.min(Math.max(params?.limit ?? 20, 1), 50);

  try {
    const conditions = [eq(communityPosts.status, "published")];
    if (params?.destinationCountry?.trim()) {
      conditions.push(
        eq(communityPosts.destinationCountry, params.destinationCountry.trim()),
      );
    }

    const rows = await db
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

    return rows;
  } catch (error) {
    console.warn("DB community query unavailable:", error);
    return [];
  }
}
