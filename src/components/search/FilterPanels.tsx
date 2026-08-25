"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { FilterForm, type AirlineOption } from "./FilterForm";
import type { SearchFilters } from "@/lib/search/params";

/** Desktop filter sidebar — RIGHT side in RTL (BRAND_GUIDELINES §13.5). */
export function FilterSidebar({
  filters,
  airlines,
  onChange,
}: {
  filters: SearchFilters;
  airlines: AirlineOption[];
  onChange: (next: SearchFilters) => void;
}) {
  return (
    <aside
      aria-label="فلاتر البحث"
      className="hidden w-72 shrink-0 rounded-md bg-surface p-4 shadow-sm lg:block"
    >
      <h2 className="mb-4 flex items-center gap-2 text-title-md text-on-surface">
        <Icon name="tune" />
        الفلاتر
      </h2>
      <FilterForm filters={filters} airlines={airlines} onChange={onChange} />
    </aside>
  );
}

/**
 * Mobile entry point + bottom sheet (SPEC §4.1). Same FilterForm instance semantics.
 */
export function FilterBottomSheet({
  open,
  onOpenChange,
  filters,
  airlines,
  onChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filters: SearchFilters;
  airlines: AirlineOption[];
  onChange: (next: SearchFilters) => void;
}) {
  return (
    <div className="lg:hidden">
      <Button variant="secondary" onClick={() => onOpenChange(true)}>
        <Icon name="tune" />
        الفلاتر
      </Button>

      {open && (
        <BottomSheetImpl
          onClose={() => onOpenChange(false)}
          filters={filters}
          airlines={airlines}
          onChange={onChange}
        />
      )}
    </div>
  );
}

function BottomSheetImpl({
  onClose,
  filters,
  airlines,
  onChange,
}: {
  onClose: () => void;
  filters: SearchFilters;
  airlines: AirlineOption[];
  onChange: (next: SearchFilters) => void;
}) {
  return (
    <Sheet open onClose={onClose} title="الفلاتر">
      <FilterForm filters={filters} airlines={airlines} onChange={onChange} />
      <div className="sticky bottom-0 -mx-4 mt-6 border-t border-outline-variant bg-surface px-4 py-3">
        <Button className="w-full" onClick={onClose}>
          عرض النتائج
        </Button>
      </div>
    </Sheet>
  );
}
