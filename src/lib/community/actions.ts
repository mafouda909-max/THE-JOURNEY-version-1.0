"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface CreatePostInput {
  title: string;
  content: string;
  trip_type?: string;
  tags?: string[];
  country_id?: string;
  city_id?: string;
}

export async function createPostAction(input: CreatePostInput): Promise<{
  success: boolean;
  error?: string;
  postId?: string;
}> {
  if (!input.title || input.title.trim().length === 0) {
    return { success: false, error: "عنوان المنشور مطلوب" };
  }
  if (!input.content || input.content.trim().length === 0) {
    return { success: false, error: "محتوى المنشور مطلوب" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "يجب تسجيل الدخول لنشر مشاركة في مجتمع صلة" };
    }

    const { data, error } = await supabase
      .from("posts")
      .insert({
        user_id: user.id,
        title: input.title.trim(),
        content: input.content.trim(),
        trip_type: input.trip_type || null,
        tags: input.tags || [],
        country_id: input.country_id || null,
        city_id: input.city_id || null,
        status: "published",
      })
      .select("id")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/community");
    return { success: true, postId: data.id };
  } catch (err: any) {
    return { success: false, error: err.message || "حدث خطأ غير متوقع" };
  }
}

export async function addCommentAction(postId: string, content: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!content || content.trim().length === 0) {
    return { success: false, error: "محتوى التعليق مطلوب" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "يجب تسجيل الدخول لإضافة تعليق" };
    }

    const { error } = await supabase.from("post_comments").insert({
      post_id: postId,
      user_id: user.id,
      content: content.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/community/${postId}`);
    revalidatePath("/community");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "حدث خطأ غير متوقع" };
  }
}

export async function toggleLikeAction(postId: string): Promise<{
  success: boolean;
  liked?: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "يجب تسجيل الدخول للتفاعل مع المنشور" };
    }

    // Check existing like
    const { data: existing } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);
      revalidatePath("/community");
      return { success: true, liked: false };
    } else {
      await supabase.from("post_likes").insert({
        post_id: postId,
        user_id: user.id,
      });
      revalidatePath("/community");
      return { success: true, liked: true };
    }
  } catch (err: any) {
    return { success: false, error: err.message || "حدث خطأ أثناء التفاعل" };
  }
}
