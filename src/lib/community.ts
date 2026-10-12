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
  return process.env.COMMUNITY_ENABLED !== "false";
}

const SEED_COMMUNITY_POSTS = [
  {
    id: 101,
    type: "experience" as CommunityPostType,
    title: "تجربتي في استخراج تأشيرة تركيا الإلكترونية لمصري حامل شنغن",
    body: "استخرجت التأشيرة الإلكترونية (eVisa) عبر البوابة الرسمية evisa.gov.tr خلال 5 دقائق فقط. الشرط الحاسم كان أن تكون تأشيرة الشنغن سارية ومستخدمة سابقاً، وطُلب مني في مطار القاهرة إبراز تذكرة العودة وحجز الفندق المطبوع. التجربة سلسة للغاية لمن يستوفي الشروط.",
    destinationCountry: "تركيا",
    destinationCity: "إسطنبول",
    topic: "تأشيرات",
    helpfulCount: 24,
    commentCount: 5,
    publishedAt: new Date("2026-03-24T12:00:00Z"),
    createdAt: new Date("2026-03-24T12:00:00Z"),
    author: {
      accountId: 1,
      displayName: "أحمد المهدي",
      role: "traveler",
      agentId: null,
      agentVerificationStatus: null,
    },
  },
  {
    id: 102,
    type: "guide" as CommunityPostType,
    title: "دليل الدخول لمطار تبليسي في جورجيا: نصائح مهمة لكاونتر الجوازات",
    body: "شرطة الحدود الجورجية تركز على 3 أوراق أساسية: 1) وثيقة التأمين الصحي المطبوعة باللغة الإنجليزية، 2) تذكرة العودة المؤكدة، 3) حجز الفندق. احتفظ بنسخ ورقية مطبوعة في حقيبة يدك لتفادي أي تأخير عند كاونتر الجوازات في مطار تبليسي.",
    destinationCountry: "جورجيا",
    destinationCity: "تبليسي",
    topic: "إجراءات_المطار",
    helpfulCount: 38,
    commentCount: 8,
    publishedAt: new Date("2026-03-22T09:00:00Z"),
    createdAt: new Date("2026-03-22T09:00:00Z"),
    author: {
      accountId: 2,
      displayName: "سارة كمال",
      role: "agent",
      agentId: 1,
      agentVerificationStatus: "verified",
    },
  },
  {
    id: 103,
    type: "question" as CommunityPostType,
    title: "هل استمارة IMUGA للمالديف تطبق على الأطفال أيضاً؟",
    body: "نخطط للسفر إلى المالديف عائلة من 4 أفراد (أنا وزوجتي وطفلان)، هل يلزم تعبئة استمارة IMUGA لكل طفل بشكل منفصل أم تكفي استمارة واحدة لرب الأسرة؟",
    destinationCountry: "المالديف",
    destinationCity: "ماليه",
    topic: "استفسارات_عائلية",
    helpfulCount: 15,
    commentCount: 3,
    publishedAt: new Date("2026-03-20T15:00:00Z"),
    createdAt: new Date("2026-03-20T15:00:00Z"),
    author: {
      accountId: 3,
      displayName: "محمد فؤاد",
      role: "traveler",
      agentId: null,
      agentVerificationStatus: null,
    },
  },
  {
    id: 104,
    type: "update" as CommunityPostType,
    title: "تحديث: بوابات العمرة والتأشيرة السياحية للسعودية لحاملي إقامات الخليج",
    body: "تم التأكيد من خلال منصة روح السعودية والتأشيرات الرسمية: حاملو إقامات دول مجلس التعاون الخليجي من المهن المعتمدة يحصلون على تأشيرة سياحية فورية صالحة للدخول المتعدد وأداء العمرة وزيارة كافة مدن المملكة.",
    destinationCountry: "المملكة العربية السعودية",
    destinationCity: "مكة المكرمة",
    topic: "عمرة_وسياحة",
    helpfulCount: 42,
    commentCount: 11,
    publishedAt: new Date("2026-03-18T18:00:00Z"),
    createdAt: new Date("2026-03-18T18:00:00Z"),
    author: {
      accountId: 4,
      displayName: "وكالة أفق الرحلات",
      role: "agent",
      agentId: 2,
      agentVerificationStatus: "verified",
    },
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

    if (rows.length > 0) {
      return rows;
    }
  } catch (error) {
    console.warn("DB community query fallback:", error);
  }

  // Graceful fallback to verified curated seed posts if DB has 0 rows or is offline
  if (params?.destinationCountry?.trim()) {
    const needle = params.destinationCountry.trim().toLowerCase();
    return SEED_COMMUNITY_POSTS.filter((p) =>
      p.destinationCountry.toLowerCase().includes(needle),
    );
  }

  return SEED_COMMUNITY_POSTS;
}
