"use client";

import { Input, Select } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { CURRENCIES, TRIP_TYPES, type SearchFilters } from "@/lib/search/params";
import { TRIP_TYPE_LABELS } from "./SearchModule";

export interface AirlineOption {
  id: string;
  name_ar: string;
}

/**
 * Shared filter form — progressive disclosure (SPEC §4.1).
 * Rendered inside the desktop sidebar AND the mobile bottom sheet.
 * Verified-toggle intentionally omitted: public_offers view is verified-only
 * by security model — a toggle would be decorative dead UI (product rule §15).
 */
export function FilterForm({
  filters,
  airlines,
  onChange,
}: {
  filters: SearchFilters;
  /** Phase C: sourced from airlines table via anon client. Empty → section hidden. */
  airlines: AirlineOption[];
  onChange: (next: SearchFilters) => void;
}) {
  const priceActive =
    filters.priceMin !== undefined || filters.priceMax !== undefined;

  return (
    <div className="space-y-6">
      {/* Trip type */}
      <fieldset>
        <legend className="mb-2 text-title-md text-on-surface">نوع الرحلة</legend>
        <div className="flex flex-wrap gap-2">
          {TRIP_TYPES.map((t) => {
            const on = filters.tripTypes.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange({
                    ...filters,
                    tripTypes: on
                      ? filters.tripTypes.filter((x) => x !== t)
                      : [...filters.tripTypes, t],
                  })
                }
                className={
                  "min-h-11 rounded-full px-4 text-label-lg transition-colors duration-100 " +
                  (on
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high")
                }
              >
                {TRIP_TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Route type */}
      <fieldset>
        <legend className="mb-2 text-title-md text-on-surface">المسار</legend>
        <div className="flex gap-2">
          {(["direct", "transit"] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={filters.routeType === r}
              onClick={() =>
                onChange({
                  ...filters,
                  routeType: filters.routeType === r ? undefined : r,
                })
              }
              className={
                "min-h-11 flex-1 rounded-full px-4 text-label-lg transition-colors duration-100 " +
                (filters.routeType === r
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high")
              }
            >
              {r === "direct" ? "مباشر" : "بمحطة تحويل"}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Airline (hidden until options exist — never a dead control) */}
      {airlines.length > 0 && (
        <Select
          id="filter-airline"
          label="شركة الطيران"
          value={filters.airlineId ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              airlineId: e.target.value || undefined,
            })
          }
        >
          <option value="">كل شركات الطيران</option>
          {airlines.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name_ar}
            </option>
          ))}
        </Select>
      )}

      {/* Price — honesty rule: currency required with bounds (AD-11) */}
      <fieldset>
        <legend className="mb-2 text-title-md text-on-surface">السعر</legend>
        {!priceActive && !filters.currency && (
          <p className="mb-2 flex items-start gap-1.5 rounded-sm bg-info-container px-3 py-2 text-label-md text-on-info-container">
            <Icon name="info" className="text-[16px]" />
            لتحديد نطاق سعري، اختر العملة أولًا — المقارنة تتم داخل كل عملة على حدة.
          </p>
        )}
        <div className="grid grid-cols-[1fr_1fr] gap-2">
          <Input
            id="filter-price-min"
            label="من"
            inputMode="numeric"
            dir="ltr"
            value={filters.priceMin ?? ""}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d]/g, "");
              onChange({
                ...filters,
                priceMin: v === "" ? undefined : Number(v),
                currency: filters.currency ?? "EGP",
              });
            }}
          />
          <Input
            id="filter-price-max"
            label="إلى"
            inputMode="numeric"
            dir="ltr"
            value={filters.priceMax ?? ""}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d]/g, "");
              onChange({
                ...filters,
                priceMax: v === "" ? undefined : Number(v),
                currency: filters.currency ?? "EGP",
              });
            }}
          />
        </div>
        <div className="mt-2">
          <Select
            id="filter-currency"
            label="العملة"
            value={filters.currency ?? ""}
            onChange={(e) => {
              const cur = e.target.value || undefined;
              onChange(
                cur
                  ? { ...filters, currency: cur }
                  : { ...filters, currency: undefined, priceMin: undefined, priceMax: undefined },
              );
            }}
          >
            <option value="">— اختر —</option>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </fieldset>

      {/* Validity preset */}
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={!!filters.expiringSoonOnly}
          onChange={(e) =>
            onChange({ ...filters, expiringSoonOnly: e.target.checked })
          }
          className="size-5 accent-primary"
        />
        <span className="text-body-md text-on-surface">ينتهي خلال أسبوع فقط</span>
      </label>
    </div>
  );
}
