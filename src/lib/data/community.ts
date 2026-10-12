import { createClient } from "@/lib/supabase/server";
import type { PublicPostRow, PostCommentRow } from "./types";

const FALLBACK_POSTS: PublicPostRow[] = [
  {
    id: "post-001",
    title: "تجربتي في الشمال التركي (طرابزون وأوزنجول) في أغسطس 2026",
    content:
      "السلام عليكم ورحمة الله.. حبيت أشارككم تجربتي وتكلفة 8 أيام مع عائلتي في طرابزون وأوزنجول. استأجرنا سيارة من المطار وكانت القيادة ممتعة وسهلة جداً. الفنادق كانت بمتوسط 450 ريال لليلة، والأجواء ماطرة وباردة نهاراً ومساءً. نصيحتي لكل مسافر: احرصوا على استخراج التأشيرة الإلكترونية من الموقع الحكومي الرسمي وتفادي المواقع الوسيطة التي تضاعف السعر!",
    user_id: "user-demo-1",
    author_name: "عبدالله الشمري",
    author_role: "traveler",
    agent_business_name: null,
    is_agent_verified: null,
    country_id: "country-tr",
    country_name_ar: "تركيا",
    country_name_en: "Turkey",
    city_id: "city-tzx",
    city_name_ar: "طرابزون",
    city_name_en: "Trabzon",
    trip_type: "package",
    tags: ["عائلي", "طبيعة", "تركيا", "نصائح_سفر"],
    media_urls: [],
    likes_count: 24,
    comments_count: 8,
    is_pinned: true,
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: "post-002",
    title: "مقارنة حقيقية: هل تكفي 5000 ريال لرحلة لشخصين في البوسنة؟",
    content:
      "كثير يسألون عن الميزانية.. نعم تكفي وزيادة إذا حجزت التذاكر مبكراً! السكن في سراييفو وموستار رخيص ونظيف جداً، والوجبات لشخصين تتراوح بين 40-70 مارك بوسني (حوالي 80-140 ريال). الشعب ودود جداً والمساجد والأكل الحلال متوفر بكل مكان. لا تفوتوا قضاء يومين في كونيتس!",
    user_id: "user-demo-2",
    author_name: "مروة سليم",
    author_role: "traveler",
    agent_business_name: null,
    is_agent_verified: null,
    country_id: "country-ba",
    country_name_ar: "البوسنة والهرسك",
    country_name_en: "Bosnia and Herzegovina",
    city_id: "city-sjj",
    city_name_ar: "سراييفو",
    city_name_en: "Sarajevo",
    trip_type: "package",
    tags: ["ميزانية", "البوسنة", "اقتصادي", "سياحة_أوروبا"],
    media_urls: [],
    likes_count: 39,
    comments_count: 14,
    is_pinned: false,
    created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 18).toISOString(),
  },
  {
    id: "post-003",
    title: "تنبيه مهم لوكلاء ومسافري بريطانيا بخصوص تصريح ETA الجديد",
    content:
      "تحديث رسمي لكافة المسافرين إلى لندن والمملكة المتحدة: تم تفعيل نظام التصريح الإلكتروني (UK ETA) بالكامل عبر التطبيق الرسمي. مدة المعالجة تأخذ من 24 إلى 72 ساعة، والرسوم رمزية (حوالي 60 ريال). لا تقبلوا عروض مكاتب تطلب مئات الريالات لطلب تصريح بسيط يستغرق 5 دقائق بنفسك!",
    user_id: "user-demo-agent-1",
    author_name: "وكالة آفاق الرحلة للسياحة",
    author_role: "agent",
    agent_business_name: "وكالة آفاق الرحلة المعتمدة",
    is_agent_verified: true,
    country_id: "country-gb",
    country_name_ar: "المملكة المتحدة",
    country_name_en: "United Kingdom",
    city_id: "city-lon",
    city_name_ar: "لندن",
    city_name_en: "London",
    trip_type: "flight",
    tags: ["تأشيرات", "تنبيه", "بريطانيا", "وكلاء_معتمدون"],
    media_urls: [],
    likes_count: 52,
    comments_count: 19,
    is_pinned: true,
    created_at: new Date(Date.now() - 3600000 * 36).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 36).toISOString(),
  },
  {
    id: "post-004",
    title: "أفضل جدول لزيارة جورجيا 6 أيام (تبليسي وباتومي وكازبيجي)",
    content:
      "جدول متوازن ومجرب بدون إرهاق:\nاليوم 1-2: تبليسي (الحمامات الكبريتية، التلفريك، متاتسميندا)\nاليوم 3: كازبيجي وجبال القوقاز المهيبة\nاليوم 4-6: قطار حديث إلى باتومي والاستمتاع بالبحر الأسود والدلافين والحديقة النباتية.\nسائقي السيارات متوفرين بأسعار مقبولة وتطبيقات النقل تعمل بكفاءة.",
    user_id: "user-demo-3",
    author_name: "سلطان العتيبي",
    author_role: "traveler",
    agent_business_name: null,
    is_agent_verified: null,
    country_id: "country-ge",
    country_name_ar: "جورجيا",
    country_name_en: "Georgia",
    city_id: "city-tbs",
    city_name_ar: "تبليسي",
    city_name_en: "Tbilisi",
    trip_type: "package",
    tags: ["جورجيا", "برامج_سياحية", "طبيعة"],
    media_urls: [],
    likes_count: 31,
    comments_count: 5,
    is_pinned: false,
    created_at: new Date(Date.now() - 3600000 * 60).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 60).toISOString(),
  },
];

const FALLBACK_COMMENTS: Record<string, PostCommentRow[]> = {
  "post-001": [
    {
      id: "c-101",
      post_id: "post-001",
      user_id: "user-commenter-1",
      author_name: "فهد الدوسري",
      content: "ما شاء الله تقرير ممتاز، هل تنصح بالقيادة بنفسي ولا أخذ سائق خاص؟",
      created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
    {
      id: "c-102",
      post_id: "post-001",
      user_id: "user-demo-1",
      author_name: "عبدالله الشمري",
      content: "أهلاً أخ فهد، إذا متعود على الطرق الجبلية فالقيادة سهلة وممتعة جداً وفرت علينا أكثر من نصف تكلفة السائق.",
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
  ],
  "post-003": [
    {
      id: "c-301",
      post_id: "post-003",
      user_id: "user-commenter-2",
      author_name: "خالد المحمد",
      content: "بارك الله فيكم على التوضيح والشفافية، كثير مكاتب كانت تبالغ في الأسعار.",
      created_at: new Date(Date.now() - 3600000 * 20).toISOString(),
    },
  ],
};

export async function listPostsServer(tag?: string, tripType?: string): Promise<PublicPostRow[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("public_posts")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (tripType) {
      query = query.eq("trip_type", tripType);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      return filterFallbackPosts(tag, tripType);
    }

    let results = data as PublicPostRow[];
    if (tag) {
      results = results.filter((p) => p.tags?.includes(tag));
    }
    return results;
  } catch {
    return filterFallbackPosts(tag, tripType);
  }
}

function filterFallbackPosts(tag?: string, tripType?: string): PublicPostRow[] {
  let list = [...FALLBACK_POSTS];
  if (tripType) {
    list = list.filter((p) => p.trip_type === tripType);
  }
  if (tag) {
    list = list.filter((p) => p.tags.includes(tag));
  }
  return list;
}

export async function getPostByIdServer(id: string): Promise<{
  post: PublicPostRow | null;
  comments: PostCommentRow[];
}> {
  try {
    const supabase = await createClient();
    const { data: post, error } = await supabase
      .from("public_posts")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !post) {
      const fb = FALLBACK_POSTS.find((p) => p.id === id);
      return {
        post: fb ?? null,
        comments: fb ? (FALLBACK_COMMENTS[fb.id] ?? []) : [],
      };
    }

    const { data: comments } = await supabase
      .from("post_comments")
      .select("id, post_id, user_id, content, created_at, users(display_name)")
      .eq("post_id", id)
      .order("created_at", { ascending: true });

    const formattedComments: PostCommentRow[] = (comments ?? []).map((c: any) => ({
      id: c.id,
      post_id: c.post_id,
      user_id: c.user_id,
      author_name: c.users?.display_name || "عضو صلة",
      content: c.content,
      created_at: c.created_at,
    }));

    return {
      post: post as PublicPostRow,
      comments: formattedComments,
    };
  } catch {
    const fb = FALLBACK_POSTS.find((p) => p.id === id);
    return {
      post: fb ?? null,
      comments: fb ? (FALLBACK_COMMENTS[fb.id] ?? []) : [],
    };
  }
}
