"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { createPostAction } from "@/lib/community/actions";

export function NewPostModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tripType, setTripType] = useState("package");
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const tags = tagInput
      .split(/[\s,،]+/)
      .map((t) => t.replace(/^#/, "").trim())
      .filter(Boolean);

    startTransition(async () => {
      const res = await createPostAction({
        title,
        content,
        trip_type: tripType,
        tags,
      });

      if (!res.success) {
        setError(res.error || "تعذر نشر المشاركة");
      } else {
        setTitle("");
        setContent("");
        setTagInput("");
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl bg-surface p-6 shadow-xl border border-outline-variant animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-outline-variant pb-4">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[#1A2B6D] text-white">
              <Icon name="edit_note" className="text-xl" />
            </span>
            <h2 className="text-title-lg font-bold text-on-surface">شارك تجربتك مع مجتمع صلة</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-body-sm text-red-700 flex items-center gap-2">
              <Icon name="error" className="text-sm shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-label-md font-medium text-on-surface mb-1">
              عنوان التجربة أو الاستفسار *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: رحلتي العائلية إلى البوسنة 7 أيام وتكلفتها"
              className="w-full rounded-lg border border-outline-variant bg-surface px-3.5 py-2.5 text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-label-md font-medium text-on-surface mb-1">
                نوع الرحلة
              </label>
              <select
                value={tripType}
                onChange={(e) => setTripType(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface focus:border-primary focus:outline-none"
              >
                <option value="package">برنامج متكامل (بكج)</option>
                <option value="flight">طيران</option>
                <option value="hotel">فنادق وإقامة</option>
                <option value="visa">تأشيرات وإجراءات</option>
                <option value="umrah">عمرة وزيارة</option>
                <option value="custom">مخصص</option>
              </select>
            </div>

            <div>
              <label className="block text-label-md font-medium text-on-surface mb-1">
                وسوم / كلمات مفتاحية
              </label>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="مثال: عائلي، ميزانية، تركيا"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-label-md font-medium text-on-surface mb-1">
              تفاصيل التجربة أو السؤال *
            </label>
            <textarea
              required
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="اكتب تفاصيل الرحلة، الفنادق، المواصلات، التكاليف، أو النصائح التي تود إفادة المسافرين بها..."
              className="w-full rounded-lg border border-outline-variant bg-surface p-3.5 text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-outline-variant pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-label-lg font-medium text-on-surface-variant hover:bg-surface-container"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1A2B6D] px-6 py-2.5 text-label-lg font-bold text-white hover:bg-[#1A2B6D]/90 disabled:opacity-50"
            >
              {isPending ? "جارٍ النشر..." : "نشر التجربة"}
              <Icon name="send" className="text-sm rtl:rotate-180" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
