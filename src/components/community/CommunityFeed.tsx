"use client";

import { useState } from "react";
import type { PublicPostRow } from "@/lib/data/types";
import { PostCard } from "./PostCard";
import { NewPostModal } from "./NewPostModal";
import { Icon } from "@/components/ui/Icon";

const CATEGORIES = [
  { id: "all", label: "الكل", icon: "dashboard" },
  { id: "package", label: "برامج سياحية", icon: "card_travel" },
  { id: "flight", label: "طيران وتذاكر", icon: "flight" },
  { id: "visa", label: "تأشيرات وإجراءات", icon: "assignment" },
  { id: "umrah", label: "عمرة وزيارة", icon: "mosque" },
];

export function CommunityFeed({ initialPosts }: { initialPosts: PublicPostRow[] }) {
  const [posts] = useState<PublicPostRow[]>(initialPosts);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredPosts = posts.filter((post) => {
    const matchCategory =
      selectedCategory === "all" || post.trip_type === selectedCategory;
    const matchSearch =
      !searchQuery ||
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchSearch;
  });

  return (
    <div>
      {/* Top Action Bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Icon
            name="search"
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث في تجارب المسافرين، الوجهات، والوسوم..."
            className="w-full rounded-xl border border-outline-variant bg-surface py-2.5 pr-10 pl-4 text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
          />
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1A2B6D] px-5 py-2.5 text-label-lg font-bold text-white shadow-sm hover:bg-[#1A2B6D]/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Icon name="add" className="text-xl" />
          <span>أضف تجربة جديدة</span>
        </button>
      </div>

      {/* Category Filter Chips */}
      <div className="mb-8 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-label-md font-medium transition-colors ${
              selectedCategory === cat.id
                ? "bg-[#1A2B6D] text-white shadow-xs"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <Icon name={cat.icon} className="text-base" />
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Feed List */}
      {filteredPosts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-outline-variant p-12 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-surface-container">
            <Icon name="travel_explore" className="text-2xl text-on-surface-variant" />
          </div>
          <h3 className="mt-4 text-title-md font-bold text-on-surface">لا توجد مشاركات مطابقة</h3>
          <p className="mt-1 text-body-md text-on-surface-variant">
            كن أول من يشارك تجربته السياحية في هذا التصنيف!
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1A2B6D] px-4 py-2 text-label-md font-bold text-white"
          >
            <Icon name="add" className="text-sm" />
            نشر تجربة الآن
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {/* New Post Modal */}
      <NewPostModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
