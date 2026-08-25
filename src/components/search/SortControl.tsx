"use client";

import { Select } from "@/components/ui/Input";
import type { SearchFilters, SortOption } from "@/lib/search/params";

export const SORT_LABELS: Record<SortOption, string> = {
  relevance: "الأكثر ملاءمة",
  newest: "الأحدث",
  price_asc: "السعر: من الأقل",
  price_desc: "السعر: من الأعلى",
  rating_desc: "التقييم: الأعلى",
};

/** Sort control — URL-driven (single source of truth). */
export function SortControl({
  filters,
  onChange,
}: {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
}) {
  return (
    <div className="w-44">
      <Select
        id="sort-control"
        label=""
        value={filters.sort}
        aria-label="ترتيب النتائج"
        onChange={(e) => onChange({ ...filters, sort: e.target.value as SortOption })}
      >
        {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
          <option key={s} value={s}>
            {SORT_LABELS[s]}
          </option>
        ))}
      </Select>
    </div>
  );
}
