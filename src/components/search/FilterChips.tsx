"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { resolveCityLabel } from "@/lib/data/places";
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
 * City refs resolve to Arabic labels via anon lookup (cached).
 */
export function FilterChips({
  filters,
  airlineLabels,
  onChange,
}: {
  filters: SearchFilters;
  /** id→name map for airlines (loaded once by the explorer). */
  airlineLabels: Record<string, string>;
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
          label={`إلى: `}
          asyncLabel={filters.destinationCityId}
          onRemove={() => remove({ destinationCityId: undefined })}
        />
      )}
      {filters.originCityId && (
        <Chip
          icon="trip_origin"
          label={`من: `}
          asyncLabel={filters.originCityId}
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
          label={airlineLabels[filters.airlineId] ?? "الناقل"}
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
  asyncLabel,
  onRemove,
}: {
  icon: string;
  label: string;
  /** Numeric ranges render LTR inside RTL text (bidi isolation). */
  ltr?: boolean;
  /** City ref resolved to Arabic label via anon lookup. */
  asyncLabel?: string;
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
          <>
            {label}
            {asyncLabel && <AsyncCityLabel ref_={asyncLabel} />}
          </>
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

function AsyncCityLabel({ ref_: refId }: { ref_: string }) {
  const [name, setName] = useState("");
  useEffect(() => {
    let cancelled = false;
    resolveCityLabel(refId).then((n) => !cancelled && setName(n));
    return () => {
      cancelled = true;
    };
  }, [refId]);
  return (
    <span className="font-semibold">
      {name || "…"}
    </span>
  );
}
