"use client";

import { useState, useTransition } from "react";
import type { PublicPostRow } from "@/lib/data/types";
import { Icon } from "@/components/ui/Icon";
import { toggleLikeAction } from "@/lib/community/actions";

export function PostCard({ post }: { post: PublicPostRow }) {
  const [likes, setLikes] = useState(post.likes_count);
  const [liked, setLiked] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleLike = () => {
    startTransition(async () => {
      // Optimistic update
      setLikes((prev) => (liked ? prev - 1 : prev + 1));
      setLiked((prev) => !prev);
      const res = await toggleLikeAction(post.id);
      if (!res.success) {
        // Revert on failure
        setLikes(post.likes_count);
        setLiked(false);
      }
    });
  };

  const isAgent = post.author_role === "agent";

  return (
    <article className="rounded-xl border border-outline-variant bg-surface p-5 shadow-xs transition-shadow hover:shadow-sm">
      {/* Author & Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-11 items-center justify-center rounded-full text-title-md font-bold ${
              isAgent
                ? "bg-[#1A2B6D] text-white"
                : "bg-primary-container text-on-primary-container"
            }`}
          >
            {post.author_name.slice(0, 1)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-title-sm font-bold text-on-surface">
                {post.agent_business_name || post.author_name}
              </span>
              {isAgent ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  <Icon name="verified" className="text-xs" />
                  وكيل معتمد
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  مسافر موثق
                </span>
              )}
            </div>
            <time className="text-label-sm text-on-surface-variant">
              {new Date(post.created_at).toLocaleDateString("ar-SA", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </div>
        </div>

        {post.country_name_ar && (
          <span className="inline-flex items-center gap-1 rounded-md bg-surface-container px-2.5 py-1 text-label-sm text-on-surface-variant">
            <Icon name="location_on" className="text-sm text-primary" />
            {post.city_name_ar ? `${post.city_name_ar}، ` : ""}
            {post.country_name_ar}
          </span>
        )}
      </div>

      {/* Post Title & Content */}
      <div className="mt-4">
        <h3 className="text-title-md font-bold text-on-surface">{post.title}</h3>
        <p className="mt-2 whitespace-pre-line text-body-md leading-relaxed text-on-surface-variant">
          {post.content}
        </p>
      </div>

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-surface-container-high px-2 py-0.5 text-label-sm text-primary hover:underline cursor-pointer"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer / Actions */}
      <div className="mt-5 flex items-center justify-between border-t border-outline-variant/60 pt-3">
        <div className="flex items-center gap-4">
          <button
            onClick={handleLike}
            disabled={isPending}
            className={`flex items-center gap-1.5 text-label-md transition-colors ${
              liked
                ? "text-red-600 font-bold"
                : "text-on-surface-variant hover:text-red-600"
            }`}
            aria-label="إعجاب"
          >
            <Icon
              name={liked ? "favorite" : "favorite_border"}
              className={`text-lg ${liked ? "fill-current" : ""}`}
            />
            <span className="tabular-nums">{likes}</span>
          </button>

          <span className="flex items-center gap-1.5 text-label-md text-on-surface-variant">
            <Icon name="chat_bubble_outline" className="text-lg" />
            <span className="tabular-nums">{post.comments_count}</span>
            <span className="hidden sm:inline">تعليقات</span>
          </span>
        </div>

        <button
          onClick={() => {
            if (navigator?.clipboard) {
              navigator.clipboard.writeText(window.location.href);
              alert("تم نسخ رابط المنشور");
            }
          }}
          className="flex items-center gap-1 text-label-sm text-on-surface-variant hover:text-primary"
        >
          <Icon name="share" className="text-sm" />
          مشاركة
        </button>
      </div>
    </article>
  );
}
