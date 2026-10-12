"use client";

import { useState } from "react";
import type { PublicVisaGuideRow } from "@/lib/data/types";
import { VisaCard } from "./VisaCard";
import { Icon } from "@/components/ui/Icon";

const VISA_TYPES = [
  { id: "all", label: "كافة التأشيرات" },
  { id: "visa_free", label: "بدون تأشيرة (إعفاء)" },
  { id: "e_visa", label: "تأشيرة إلكترونية (e-Visa)" },
  { id: "eta", label: "تصريح سفر (ETA)" },
  { id: "embassy_visa", label: "تأشيرة سفارة" },
];

export function VisaExplorer({ initialGuides }: { initialGuides: PublicVisaGuideRow[] }) {
  const [guides] = useState<PublicVisaGuideRow[]>(initialGuides);
  const [selectedType, setSelectedType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = guides.filter((g) => {
    const matchType = selectedType === "all" || g.visa_type === selectedType;
    const matchSearch =
      !searchQuery ||
      g.title_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.destination_country_name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.summary_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.destination_country_name_en &&
        g.destination_country_name_en.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchType && matchSearch;
  });

  return (
    <div>
      {/* Search and Filters */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Icon
            name="search"
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن الدولة أو نوع التأشيرة (مثل: تركيا، جورجيا، بريطانيا...)"
            className="w-full rounded-xl border border-outline-variant bg-surface py-2.5 pr-10 pl-4 text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {VISA_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedType(t.id)}
              className={`rounded-lg px-3.5 py-2 text-label-sm font-semibold transition-colors ${
                selectedType === t.id
                  ? "bg-[#1A2B6D] text-white shadow-xs"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Verified Guarantee Banner */}
      <div className="mb-8 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-emerald-950">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
          <Icon name="verified_user" className="text-xl" />
        </span>
        <div className="text-body-sm leading-relaxed">
          <strong className="font-bold text-emerald-900 block">ضمان الموثوقية الحكومية:</strong>
          جميع بيانات التأشيرات في «صلة» تُراجع دورياً وتستند حصراً إلى البوابات الرسمية لوزارات الخارجية
          والسفارات، مع تزويدك برابط التقديم الحكومي المباشر لحمايتك من رسوم الوسطاء والمواقع غير المعتمدة.
        </div>
      </div>

      {/* Guides List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-outline-variant p-12 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-surface-container">
            <Icon name="travel_explore" className="text-2xl text-on-surface-variant" />
          </div>
          <h3 className="mt-4 text-title-md font-bold text-on-surface">لا توجد أدلة تأشيرة مطابقة</h3>
          <p className="mt-1 text-body-md text-on-surface-variant">
            جرب البحث باسم دولة أخرى أو اختر &quot;كافة التأشيرات&quot;.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((guide) => (
            <VisaCard key={guide.id} guide={guide} />
          ))}
        </div>
      )}
    </div>
  );
}
