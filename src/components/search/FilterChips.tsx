"use client";

import { Badge } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import {
  countActiveFilters,
  type SearchFilters,
} from "@/lib/search/params";
import { TRIP_TYPE_LABELS } from "./SearchModule";

const ROUTE_LABELS: Record<string, string> = {
  direct: "مباشر",
  transit: "بمحطة تحويل",
};

/**
 * Applied-filter chips — removable, rounded-full (§6 radius semantics).
 * Mutating a chip updates the URL via the shared onChange contract.
 */
export function FilterChips({
  filters,
  labels,
  onChange,
}: {
  filters: SearchFilters;
  /** id→display-name resolution for city/airline refs (Phase C injects RPC-backed map). */
  labels: { cities: Record<string, string>; airlines: Record<string, string> };
  onChange: (next: SearchFilters) => void;
}) {
  const n = countActiveFilters(filters);
  if (n === 0) return null;

  function remove(part: Partial<SearchFilters>) {
    onChange({ ...filters, ...part });
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      {filters.destinationCityId && (
        <Chip
          icon="location_on"
          label={`إلى: ${labels.cities[filters.destinationCityId] ?? "الوجهة"}`}
          onRemove={() => remove({ destinationCityId: undefined })}
        />
      )}
      {filters.originCityId && (
        <Chip
          icon="trip_origin"
          label={`من: ${labels.cities[filters.originCityId] ?? "المغادرة"}`}
          onRemove={() => remove({ originCityId: undefined })}
        />
      )}
      {filters.tripTypes.map((t) => (
        <Chip
          key={t}
          icon="luggage"
          label={TRIP_TYPE_LABELS[t]}
          onRemove={() =>
            remove({ tripTypes: filters.tripTypes.filter((x) => x !== t) })
          }
        />
      ))}
      {filters.airlineId && (
        <Chip
          icon="flight"
          label={labels.airlines[filters.airlineId] ?? "الناقل"}
          onRemove={() => remove({ airlineId: undefined })}
        />
      )}
      {filters.routeType && (
        <Chip
          icon="route"
          label={ROUTE_LABELS[filters.routeType]}
          onRemove={() => remove({ routeType: undefined })}
        />
      )}
      {(filters.priceMin !== undefined || filters.priceMax !== undefined) &&
        filters.currency && (
          <Chip
            icon="sell"
            label={`${filters.priceMin ?? 0}–${filters.priceMax ?? "∞"} ${filters.currency}`}
            ltr
            onRemove={() =>
              remove({ priceMin: undefined, priceMax: undefined })
            }
          />
        )}
      {filters.expiringSoonOnly && (
        <Chip
          icon="schedule"
          label="ينتهي قريبًا"
          onRemove={() => remove({ expiringSoonOnly: false })}
        />
      )}
      <button
        onClick={() =>
          onChange({ ...filters, ...emptyAll(filters) })
        }
        className="ms-1 min-h-9 rounded-full px-3 text-label-lg text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        مسح الكل ({n})
      </button>
    </div>
  );
}

function emptyAll(f: SearchFilters): Partial<SearchFilters> {
  return {
    destinationCityId: undefined,
    originCityId: undefined,
    tripTypes: [],
    airlineId: undefined,
    routeType: undefined,
    priceMin: undefined,
    priceMax: undefined,
    currency: undefined,
    expiringSoonOnly: false,
    sort: f.sort, // sort is not a "filter"
  };
}

function Chip({
  icon,
  label,
  ltr = false,
  onRemove,
}: {
  icon: string;
  label: string;
  /** Numeric ranges render LTR inside RTL text (bidi isolation). */
  ltr?: boolean;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center">
      <Badge tone="brand" icon={icon}>
        {ltr ? (
          <bdi>
            <span dir="ltr">{label}</span>
          </bdi>
        ) : (
          label
        )}
      </Badge>
      <button
        onClick={onRemove}
        aria-label={`إزالة: ${label}`}
        className="-ms-2 flex size-8 items-center justify-center rounded-full bg-primary-container text-on-primary-container hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon name="close" className="text-[16px]" />
      </button>
    </span>
  );
}
